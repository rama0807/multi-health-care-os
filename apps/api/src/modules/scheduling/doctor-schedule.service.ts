import { CreateDoctorScheduleDto, DoctorSchedule, ScheduleShift, UpdateDoctorScheduleVersionDto, Weekday } from '@medicore/types'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Prisma, Weekday as PrismaWeekday } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { toDbDateOnly } from './availability.util'
import { DoctorRefService } from './doctor-ref.service'

type ScheduleWithDays = Prisma.DoctorScheduleGetPayload<{ include: { days: true } }>

@Injectable()
export class DoctorScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly doctorRef: DoctorRefService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getEffective(
    organizationId: string,
    doctorId: string,
    asOf: Date = new Date(),
  ): Promise<DoctorSchedule | null> {
    await this.doctorRef.requireDoctor(organizationId, doctorId)
    const schedule = await this.findEffectiveRow(organizationId, doctorId, asOf)
    return schedule ? this.toResponse(schedule) : null
  }

  async listVersions(organizationId: string, doctorId: string): Promise<DoctorSchedule[]> {
    await this.doctorRef.requireDoctor(organizationId, doctorId)
    const rows = await this.prisma.doctorSchedule.findMany({
      where: { doctorId, organizationId },
      include: { days: true },
      orderBy: { effectiveFrom: 'desc' },
    })
    return rows.map((row) => this.toResponse(row))
  }

  async createVersion(
    organizationId: string,
    doctorId: string,
    dto: CreateDoctorScheduleDto,
    actorUserId?: string,
  ): Promise<DoctorSchedule> {
    await this.doctorRef.requireDoctor(organizationId, doctorId)

    const effectiveFrom = new Date(dto.effectiveFrom)
    const conflict = await this.prisma.doctorSchedule.findUnique({
      where: { doctorId_effectiveFrom: { doctorId, effectiveFrom } },
    })
    if (conflict) {
      throw new ConflictException('A schedule version already exists with this effective date')
    }

    const schedule = await this.prisma.doctorSchedule.create({
      data: {
        doctorId,
        organizationId,
        effectiveFrom,
        days: {
          create: dto.days.map((day) => ({
            dayOfWeek: day.dayOfWeek as unknown as PrismaWeekday,
            isWorkingDay: day.isWorkingDay,
            shifts: day.shifts as unknown as Prisma.InputJsonValue,
          })),
        },
      },
      include: { days: true },
    })

    this.eventEmitter.emit('doctor.schedule.created', {
      doctorId,
      organizationId,
      userId: actorUserId,
      scheduleId: schedule.id,
    })

    return this.toResponse(schedule)
  }

  async setVersionActive(
    organizationId: string,
    doctorId: string,
    scheduleId: string,
    dto: UpdateDoctorScheduleVersionDto,
    actorUserId?: string,
  ): Promise<DoctorSchedule> {
    await this.doctorRef.requireDoctor(organizationId, doctorId)

    const existing = await this.prisma.doctorSchedule.findFirst({
      where: { id: scheduleId, doctorId, organizationId },
    })
    if (!existing) throw new NotFoundException('Schedule version not found')

    const updated = await this.prisma.doctorSchedule.update({
      where: { id: scheduleId },
      data: { isActive: dto.isActive },
      include: { days: true },
    })

    this.eventEmitter.emit('doctor.schedule.updated', {
      doctorId,
      organizationId,
      userId: actorUserId,
      scheduleId,
    })

    return this.toResponse(updated)
  }

  /** Internal - consumed by AvailabilityService, not exposed directly over HTTP. */
  async findEffectiveRow(
    organizationId: string,
    doctorId: string,
    asOf: Date,
  ): Promise<ScheduleWithDays | null> {
    return this.prisma.doctorSchedule.findFirst({
      where: { doctorId, organizationId, isActive: true, effectiveFrom: { lte: toDbDateOnly(asOf) } },
      include: { days: true },
      orderBy: { effectiveFrom: 'desc' },
    })
  }

  private toResponse(schedule: ScheduleWithDays): DoctorSchedule {
    return {
      id: schedule.id,
      doctorId: schedule.doctorId,
      organizationId: schedule.organizationId,
      effectiveFrom: schedule.effectiveFrom.toISOString().slice(0, 10),
      isActive: schedule.isActive,
      days: schedule.days.map((day) => ({
        id: day.id,
        dayOfWeek: day.dayOfWeek as unknown as Weekday,
        isWorkingDay: day.isWorkingDay,
        shifts: day.shifts as unknown as ScheduleShift[],
      })),
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
    }
  }
}
