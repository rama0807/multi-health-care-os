import {
  CreateEncounterDto,
  Encounter,
  EncounterQuery,
  EncounterStatus,
  EncounterWithDetails,
  JwtPayload,
  UpdateEncounterStatusDto,
} from '@medicore/types'
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import {
  Encounter as PrismaEncounter,
  EncounterStatus as PrismaEncounterStatus,
  EncounterType as PrismaEncounterType,
  Patient,
  Prisma,
} from '@prisma/client'

import { PermissionsService } from '../../common/permissions/permissions.service'
import { PrismaService } from '../../prisma/prisma.service'
import { DoctorRefService } from '../scheduling/doctor-ref.service'

/**
 * IN_PROGRESS is the only entry state (created that way). COMPLETED and
 * AMENDED can flip back and forth - a doctor may reopen a completed
 * encounter to correct/add something, which itself is recorded as an
 * amendment rather than silently rewriting a completed record.
 */
const ALLOWED_TRANSITIONS: Record<EncounterStatus, EncounterStatus[]> = {
  [EncounterStatus.IN_PROGRESS]: [EncounterStatus.COMPLETED],
  [EncounterStatus.COMPLETED]: [EncounterStatus.AMENDED],
  [EncounterStatus.AMENDED]: [EncounterStatus.COMPLETED],
}

type EncounterWithRelations = PrismaEncounter & {
  patient: Pick<Patient, 'id' | 'firstName' | 'lastName' | 'uhid'>
  doctor: { id: string; specialization: string; user: { firstName: string; lastName: string } }
}

const ENCOUNTER_WITH_RELATIONS_INCLUDE = {
  patient: { select: { id: true, firstName: true, lastName: true, uhid: true } },
  doctor: { select: { id: true, specialization: true, user: { select: { firstName: true, lastName: true } } } },
} satisfies Prisma.EncounterInclude

@Injectable()
export class EncountersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly doctorRef: DoctorRefService,
    private readonly permissionsService: PermissionsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(organizationId: string, query: EncounterQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20

    const where: Prisma.EncounterWhereInput = { organizationId }
    if (query.patientId) where.patientId = query.patientId
    if (query.doctorId) where.doctorId = query.doctorId
    if (query.status) where.status = query.status as unknown as PrismaEncounterStatus
    if (query.type) where.type = query.type as unknown as PrismaEncounterType

    const [data, total] = await Promise.all([
      this.prisma.encounter.findMany({
        where,
        include: ENCOUNTER_WITH_RELATIONS_INCLUDE,
        orderBy: { encounterDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.encounter.count({ where }),
    ])

    return {
      data: data.map((e) => this.toResponse(e)),
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

  async getById(organizationId: string, id: string): Promise<EncounterWithDetails> {
    const encounter = await this.requireEncounterWithRelations(organizationId, id)
    return this.toResponse(encounter)
  }

  async create(organizationId: string, dto: CreateEncounterDto, actorUserId?: string): Promise<Encounter> {
    await this.doctorRef.requireDoctor(organizationId, dto.doctorId)
    await this.requirePatient(organizationId, dto.patientId)

    if (dto.appointmentId) {
      const appointment = await this.prisma.appointment.findFirst({
        where: { id: dto.appointmentId, organizationId },
      })
      if (!appointment) throw new NotFoundException('Appointment not found')

      const existing = await this.prisma.encounter.findUnique({ where: { appointmentId: dto.appointmentId } })
      if (existing) throw new ConflictException('This appointment already has an encounter')
    }

    const encounter = await this.prisma.encounter.create({
      data: {
        patientId: dto.patientId,
        doctorId: dto.doctorId,
        appointmentId: dto.appointmentId,
        organizationId,
        type: dto.type as unknown as PrismaEncounterType,
        notes: dto.notes,
      },
    })

    this.eventEmitter.emit('encounter.created', {
      encounterId: encounter.id,
      doctorId: dto.doctorId,
      patientId: dto.patientId,
      organizationId,
      userId: actorUserId,
    })

    return this.toPlainResponse(encounter)
  }

  async updateStatus(
    organizationId: string,
    id: string,
    dto: UpdateEncounterStatusDto,
    actorUserId?: string,
  ): Promise<Encounter> {
    const encounter = await this.requireEncounter(organizationId, id)
    const currentStatus = encounter.status as unknown as EncounterStatus
    const nextStatus = dto.status

    if (currentStatus === nextStatus) {
      throw new ConflictException(`Encounter is already ${nextStatus}`)
    }
    const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? []
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(`Cannot transition an encounter from ${currentStatus} to ${nextStatus}`)
    }

    const updated = await this.prisma.encounter.update({
      where: { id },
      data: { status: nextStatus as unknown as PrismaEncounterStatus },
    })

    this.eventEmitter.emit('encounter.status_changed', {
      encounterId: id,
      doctorId: encounter.doctorId,
      patientId: encounter.patientId,
      organizationId,
      userId: actorUserId,
      fromStatus: currentStatus,
      toStatus: nextStatus,
    })

    return this.toPlainResponse(updated)
  }

  /** Used by the sibling clinical-note/vital/diagnosis/procedure/attachment
   * services in this module to validate the parent encounter without each
   * re-implementing the same lookup. */
  async requireEncounter(organizationId: string, id: string): Promise<PrismaEncounter> {
    const encounter = await this.prisma.encounter.findFirst({ where: { id, organizationId } })
    if (!encounter) throw new NotFoundException('Encounter not found')
    return encounter
  }

  /**
   * `medical_records.*` can be held at `.own` scope (a doctor managing only
   * encounters where they're the treating doctor). Shared by every
   * controller in this module (encounters, clinical notes, vitals,
   * diagnoses, procedures, attachments) instead of each re-implementing the
   * same own/all-scope check.
   */
  async assertOwnScopeOk(
    organizationId: string,
    encounterId: string,
    user: JwtPayload,
    action: string,
  ): Promise<void> {
    const scope = this.permissionsService.getScope(user, 'medical_records', action)
    if (scope !== 'own') return

    const encounter = await this.requireEncounter(organizationId, encounterId)
    const ownProfile = await this.doctorRef.findDoctorProfileForUser(organizationId, user.sub)
    if (!ownProfile || ownProfile.id !== encounter.doctorId) {
      throw new ForbiddenException('You can only access your own encounters')
    }
  }

  private async requireEncounterWithRelations(organizationId: string, id: string): Promise<EncounterWithRelations> {
    const encounter = await this.prisma.encounter.findFirst({
      where: { id, organizationId },
      include: ENCOUNTER_WITH_RELATIONS_INCLUDE,
    })
    if (!encounter) throw new NotFoundException('Encounter not found')
    return encounter as EncounterWithRelations
  }

  private async requirePatient(organizationId: string, patientId: string): Promise<Patient> {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, organizationId, deletedAt: null },
    })
    if (!patient) throw new NotFoundException('Patient not found')
    return patient
  }

  private toResponse(encounter: EncounterWithRelations): EncounterWithDetails {
    return {
      ...this.toPlainResponse(encounter),
      patient: {
        id: encounter.patient.id,
        fullName: `${encounter.patient.firstName} ${encounter.patient.lastName}`,
        uhid: encounter.patient.uhid,
      },
      doctor: {
        id: encounter.doctor.id,
        fullName: `${encounter.doctor.user.firstName} ${encounter.doctor.user.lastName}`,
        specialization: encounter.doctor.specialization,
      },
    }
  }

  private toPlainResponse(encounter: PrismaEncounter): Encounter {
    return {
      id: encounter.id,
      patientId: encounter.patientId,
      doctorId: encounter.doctorId,
      appointmentId: encounter.appointmentId,
      organizationId: encounter.organizationId,
      type: encounter.type as unknown as Encounter['type'],
      status: encounter.status as unknown as EncounterStatus,
      notes: encounter.notes,
      encounterDate: encounter.encounterDate,
      createdAt: encounter.createdAt,
      updatedAt: encounter.updatedAt,
    }
  }
}
