import {
  Appointment,
  AppointmentQuery,
  AppointmentStatus,
  AppointmentType,
  AppointmentWithDetails,
  AvailableSlot,
  CreateAppointmentDto,
  CreateRecurringAppointmentDto,
  CreateWalkInAppointmentDto,
  RecurrenceFrequency,
  RecurringBookingResult,
  UpdateAppointmentStatusDto,
} from '@medicore/types'
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import {
  Appointment as PrismaAppointment,
  AppointmentStatus as PrismaAppointmentStatus,
  AppointmentType as PrismaAppointmentType,
  Doctor,
  Patient,
  Prisma,
} from '@prisma/client'
import { nanoid } from 'nanoid'

import { BackgroundTaskService } from '../../common/background/background-task.service'
import { EmailService } from '../../common/email/email.service'
import { appointmentConfirmedTemplate } from '../../common/email/email.templates'
import { PrismaService } from '../../prisma/prisma.service'
import { AvailabilityService } from '../scheduling/availability.service'
import { parseDateOnly, toLocalDateString, toLocalIsoString } from '../scheduling/availability.util'
import { DoctorRefService } from '../scheduling/doctor-ref.service'

/**
 * Only forward transitions are valid, plus CANCELLED/NO_SHOW as an exit from
 * any non-terminal state — see ADR-0006. COMPLETED/CANCELLED/NO_SHOW have no
 * entry here and are therefore terminal (empty allowed-next-set).
 */
const ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  [AppointmentStatus.SCHEDULED]: [AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
  [AppointmentStatus.CONFIRMED]: [AppointmentStatus.ARRIVED, AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
  [AppointmentStatus.ARRIVED]: [
    AppointmentStatus.IN_CONSULTATION,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
  ],
  [AppointmentStatus.IN_CONSULTATION]: [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED],
  [AppointmentStatus.COMPLETED]: [],
  [AppointmentStatus.CANCELLED]: [],
  [AppointmentStatus.NO_SHOW]: [],
}

type AppointmentWithRelations = PrismaAppointment & {
  patient: Pick<Patient, 'id' | 'firstName' | 'lastName' | 'uhid' | 'phone' | 'email'>
  doctor: { id: string; specialization: string; user: { firstName: string; lastName: string } }
  department: { id: string; name: string } | null
}

const APPOINTMENT_WITH_RELATIONS_INCLUDE = {
  patient: { select: { id: true, firstName: true, lastName: true, uhid: true, phone: true, email: true } },
  doctor: { select: { id: true, specialization: true, user: { select: { firstName: true, lastName: true } } } },
  department: { select: { id: true, name: true } },
} satisfies Prisma.AppointmentInclude

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly background: BackgroundTaskService,
    private readonly prisma: PrismaService,
    private readonly doctorRef: DoctorRefService,
    private readonly availabilityService: AvailabilityService,
    private readonly emailService: EmailService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getAvailableSlotsForBooking(
    organizationId: string,
    doctorId: string,
    dateStr: string,
    durationMinutes = 15,
  ): Promise<AvailableSlot[]> {
    const availability = await this.availabilityService.getAvailableSlots(
      organizationId,
      doctorId,
      dateStr,
      durationMinutes,
    )
    if (!availability.isWorkingDay || availability.onLeave) return []

    const date = parseDateOnly(dateStr)
    const dayStart = new Date(date)
    const dayEnd = new Date(date)
    dayEnd.setDate(dayEnd.getDate() + 1)

    const existing = await this.prisma.appointment.findMany({
      where: {
        doctorId,
        organizationId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        scheduledAt: { gte: dayStart, lt: dayEnd },
      },
      select: { scheduledAt: true, durationMinutes: true },
    })

    return availability.slots.filter((slot) => {
      const slotStart = new Date(slot.start)
      const slotEnd = new Date(slot.end)
      return !existing.some((appt) => {
        const apptStart = appt.scheduledAt
        const apptEnd = new Date(apptStart.getTime() + appt.durationMinutes * 60_000)
        return slotStart < apptEnd && slotEnd > apptStart
      })
    })
  }

  async list(organizationId: string, query: AppointmentQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20

    const where: Prisma.AppointmentWhereInput = { organizationId }
    if (query.doctorId) where.doctorId = query.doctorId
    if (query.patientId) where.patientId = query.patientId
    if (query.status) where.status = query.status as unknown as PrismaAppointmentStatus
    if (query.type) where.type = query.type as unknown as PrismaAppointmentType
    if (query.date) {
      const date = parseDateOnly(query.date)
      const nextDay = new Date(date)
      nextDay.setDate(nextDay.getDate() + 1)
      where.scheduledAt = { gte: date, lt: nextDay }
    }

    const [data, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        include: APPOINTMENT_WITH_RELATIONS_INCLUDE,
        orderBy: { scheduledAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.appointment.count({ where }),
    ])

    return {
      data: data.map((a) => this.toResponse(a)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    }
  }

  async getById(organizationId: string, id: string): Promise<AppointmentWithDetails> {
    const appointment = await this.requireAppointment(organizationId, id)
    return this.toResponse(appointment)
  }

  async create(organizationId: string, dto: CreateAppointmentDto, actorUserId?: string): Promise<Appointment> {
    const doctor = await this.doctorRef.requireDoctor(organizationId, dto.doctorId)
    const patient = await this.requirePatient(organizationId, dto.patientId)
    if (dto.departmentId) await this.requireDepartment(organizationId, dto.departmentId)

    return this.bookSlot({
      organizationId,
      doctor,
      patient,
      departmentId: dto.departmentId,
      scheduledAt: new Date(dto.scheduledAt),
      durationMinutes: dto.durationMinutes,
      type: dto.type,
      chiefComplaint: dto.chiefComplaint,
      notes: dto.notes,
      isWalkIn: false,
      recurrenceGroupId: null,
      actorUserId,
    })
  }

  /**
   * A walk-in still goes through the exact same conflict-checked booking
   * path as a normal appointment (see ADR-0007) — the only difference is
   * the slot is chosen automatically (the doctor's earliest available slot
   * at/after right now, today) instead of by the caller.
   */
  async createWalkIn(
    organizationId: string,
    dto: CreateWalkInAppointmentDto,
    actorUserId?: string,
  ): Promise<Appointment> {
    const doctor = await this.doctorRef.requireDoctor(organizationId, dto.doctorId)
    const patient = await this.requirePatient(organizationId, dto.patientId)
    if (dto.departmentId) await this.requireDepartment(organizationId, dto.departmentId)

    const now = new Date()
    const todayStr = toLocalDateString(now)
    const nowIso = toLocalIsoString(now)
    const slots = await this.getAvailableSlotsForBooking(organizationId, dto.doctorId, todayStr, dto.durationMinutes)
    const nextSlot = slots.filter((s) => s.start >= nowIso).sort((a, b) => a.start.localeCompare(b.start))[0]
    if (!nextSlot) {
      throw new ConflictException('No available walk-in slot for this doctor for the rest of today')
    }

    return this.bookSlot({
      organizationId,
      doctor,
      patient,
      departmentId: dto.departmentId,
      scheduledAt: new Date(nextSlot.start),
      durationMinutes: dto.durationMinutes,
      type: dto.type,
      chiefComplaint: dto.chiefComplaint,
      notes: dto.notes,
      isWalkIn: true,
      recurrenceGroupId: null,
      actorUserId,
    })
  }

  /**
   * Materializes every occurrence as an independent row up front, sharing
   * one `recurrenceGroupId` (see ADR-0007) — no background job, no
   * recurrence-rule expansion at read time. Each occurrence goes through
   * the same conflict check as a one-off booking; a conflicting occurrence
   * is reported as failed rather than aborting the whole batch or silently
   * skipping it.
   */
  async createRecurring(
    organizationId: string,
    dto: CreateRecurringAppointmentDto,
    actorUserId?: string,
  ): Promise<RecurringBookingResult> {
    const doctor = await this.doctorRef.requireDoctor(organizationId, dto.doctorId)
    const patient = await this.requirePatient(organizationId, dto.patientId)
    if (dto.departmentId) await this.requireDepartment(organizationId, dto.departmentId)

    const recurrenceGroupId = nanoid()
    const stepDays = dto.frequency === RecurrenceFrequency.WEEKLY ? 7 : 1
    const firstOccurrence = new Date(`${dto.startDate}T${dto.time}:00`)

    const booked: Appointment[] = []
    const failed: RecurringBookingResult['failed'] = []

    for (let i = 0; i < dto.occurrences; i++) {
      const scheduledAt = new Date(firstOccurrence)
      scheduledAt.setDate(scheduledAt.getDate() + i * stepDays)

      try {
        const appointment = await this.bookSlot({
          organizationId,
          doctor,
          patient,
          departmentId: dto.departmentId,
          scheduledAt,
          durationMinutes: dto.durationMinutes,
          type: dto.type,
          chiefComplaint: dto.chiefComplaint,
          notes: dto.notes,
          isWalkIn: false,
          recurrenceGroupId,
          actorUserId,
        })
        booked.push(appointment)
      } catch (error) {
        failed.push({
          scheduledAt: toLocalIsoString(scheduledAt),
          reason: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return { recurrenceGroupId, booked, failed }
  }

  private async bookSlot(params: {
    organizationId: string
    doctor: Doctor
    patient: Patient
    departmentId?: string
    scheduledAt: Date
    durationMinutes: number
    type: AppointmentType
    chiefComplaint?: string
    notes?: string
    isWalkIn: boolean
    recurrenceGroupId: string | null
    actorUserId?: string
  }): Promise<Appointment> {
    const dateStr = toLocalDateString(params.scheduledAt)
    const requestedStartIso = toLocalIsoString(params.scheduledAt)

    const slots = await this.getAvailableSlotsForBooking(
      params.organizationId,
      params.doctor.id,
      dateStr,
      params.durationMinutes,
    )
    if (!slots.some((s) => s.start === requestedStartIso)) {
      throw new ConflictException(
        'This doctor is not available at the requested time — it may be outside their schedule, during a break, on leave, or already booked',
      )
    }

    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: params.organizationId } })
    const settings = (org.settings ?? {}) as Record<string, unknown>
    const prefix = typeof settings.uhidPrefix === 'string' ? settings.uhidPrefix : 'MED'

    const appointment = await this.prisma.$transaction(async (tx) => {
      const appointmentNumber = await this.generateAppointmentNumber(tx, params.organizationId, prefix)
      return tx.appointment.create({
        data: {
          appointmentNumber,
          patientId: params.patient.id,
          doctorId: params.doctor.id,
          departmentId: params.departmentId,
          organizationId: params.organizationId,
          scheduledAt: params.scheduledAt,
          durationMinutes: params.durationMinutes,
          type: params.type as unknown as PrismaAppointmentType,
          chiefComplaint: params.chiefComplaint,
          notes: params.notes,
          isWalkIn: params.isWalkIn,
          recurrenceGroupId: params.recurrenceGroupId,
        },
      })
    })

    this.eventEmitter.emit('appointment.created', {
      appointmentId: appointment.id,
      doctorId: params.doctor.id,
      patientId: params.patient.id,
      organizationId: params.organizationId,
      userId: params.actorUserId,
    })

    const patientEmail = params.patient.email
    if (patientEmail) {
      const doctorName = await this.doctorFullName(params.doctor.id)
      const { subject, html } = appointmentConfirmedTemplate(
        params.patient.firstName,
        doctorName,
        params.scheduledAt,
        appointment.appointmentNumber,
      )
      // Off the request path (Milestone 19.3). This previously swallowed every
      // failure with `.catch(() => undefined)` — a confirmation that never
      // arrived left no trace anywhere. It is now logged and counted.
      this.background.run('appointments.confirmation_email', () =>
        this.emailService.send({ to: patientEmail, subject, html }),
      )
    }

    return this.toPlainResponse(appointment)
  }

  async updateStatus(
    organizationId: string,
    id: string,
    dto: UpdateAppointmentStatusDto,
    actorUserId?: string,
  ): Promise<Appointment> {
    const appointment = await this.requireAppointment(organizationId, id)
    const currentStatus = appointment.status as unknown as AppointmentStatus
    const nextStatus = dto.status

    if (currentStatus === nextStatus) {
      throw new ConflictException(`Appointment is already ${nextStatus}`)
    }
    const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? []
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(`Cannot transition an appointment from ${currentStatus} to ${nextStatus}`)
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: nextStatus as unknown as PrismaAppointmentStatus,
        notes: dto.notes ?? appointment.notes,
      },
    })

    this.eventEmitter.emit('appointment.status_changed', {
      appointmentId: id,
      doctorId: appointment.doctorId,
      patientId: appointment.patientId,
      organizationId,
      userId: actorUserId,
      fromStatus: currentStatus,
      toStatus: nextStatus,
    })

    return this.toPlainResponse(updated)
  }

  private async doctorFullName(doctorId: string): Promise<string> {
    const doctor = await this.prisma.doctor.findUniqueOrThrow({
      where: { id: doctorId },
      select: { user: { select: { firstName: true, lastName: true } } },
    })
    return `${doctor.user.firstName} ${doctor.user.lastName}`
  }

  private async requirePatient(organizationId: string, patientId: string): Promise<Patient> {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, organizationId, deletedAt: null },
    })
    if (!patient) throw new NotFoundException('Patient not found')
    return patient
  }

  private async requireDepartment(organizationId: string, departmentId: string): Promise<void> {
    const department = await this.prisma.department.findFirst({ where: { id: departmentId, organizationId } })
    if (!department) throw new NotFoundException('Department not found')
  }

  private async requireAppointment(organizationId: string, id: string): Promise<AppointmentWithRelations> {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, organizationId },
      include: APPOINTMENT_WITH_RELATIONS_INCLUDE,
    })
    if (!appointment) throw new NotFoundException('Appointment not found')
    return appointment as AppointmentWithRelations
  }

  private async generateAppointmentNumber(
    tx: Prisma.TransactionClient,
    organizationId: string,
    prefix: string,
  ): Promise<string> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId} || ':appointment')::bigint)`

    const year = new Date().getFullYear()
    const yearStart = new Date(Date.UTC(year, 0, 1))
    const count = await tx.appointment.count({ where: { organizationId, createdAt: { gte: yearStart } } })

    return `APT-${prefix}-${year}-${String(count + 1).padStart(6, '0')}`
  }

  private toResponse(appointment: AppointmentWithRelations): AppointmentWithDetails {
    return {
      ...this.toPlainResponse(appointment),
      patient: {
        id: appointment.patient.id,
        fullName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
        uhid: appointment.patient.uhid,
        phone: appointment.patient.phone,
      },
      doctor: {
        id: appointment.doctor.id,
        fullName: `${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`,
        specialization: appointment.doctor.specialization,
      },
      department: appointment.department,
    }
  }

  private toPlainResponse(appointment: PrismaAppointment): Appointment {
    return {
      id: appointment.id,
      appointmentNumber: appointment.appointmentNumber,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      departmentId: appointment.departmentId,
      organizationId: appointment.organizationId,
      scheduledAt: appointment.scheduledAt,
      durationMinutes: appointment.durationMinutes,
      type: appointment.type as unknown as Appointment['type'],
      status: appointment.status as unknown as AppointmentStatus,
      chiefComplaint: appointment.chiefComplaint,
      notes: appointment.notes,
      roomNumber: appointment.roomNumber,
      isWalkIn: appointment.isWalkIn,
      recurrenceGroupId: appointment.recurrenceGroupId,
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt,
    }
  }
}
