import {
  ApplyLeaveDto,
  DecideLeaveDto,
  DoctorLeave,
  DoctorLeaveWithDoctor,
  LeaveSearchQuery,
  LeaveStatus,
  LeaveType,
} from '@medicore/types'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { DoctorLeave as PrismaDoctorLeave, LeaveType as PrismaLeaveType, Prisma, User } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { toDbDateOnly } from './availability.util'
import { DoctorRefService } from './doctor-ref.service'

type LeaveWithDoctor = PrismaDoctorLeave & { doctor: { user: Pick<User, 'firstName' | 'lastName'> } }

const LEAVE_WITH_DOCTOR_INCLUDE = {
  doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
} satisfies Prisma.DoctorLeaveInclude

@Injectable()
export class DoctorLeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly doctorRef: DoctorRefService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async apply(organizationId: string, dto: ApplyLeaveDto, actorUserId: string): Promise<DoctorLeave> {
    await this.doctorRef.requireDoctor(organizationId, dto.doctorId)

    const startDate = new Date(dto.startDate)
    const endDate = new Date(dto.endDate)

    const overlapping = await this.prisma.doctorLeave.findFirst({
      where: {
        doctorId: dto.doctorId,
        organizationId,
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    })
    if (overlapping) {
      throw new ConflictException(
        'This doctor already has a pending or approved leave request overlapping these dates',
      )
    }

    const leave = await this.prisma.doctorLeave.create({
      data: {
        doctorId: dto.doctorId,
        organizationId,
        leaveType: dto.leaveType as unknown as PrismaLeaveType,
        startDate,
        endDate,
        reason: dto.reason,
        appliedByUserId: actorUserId,
      },
    })

    this.eventEmitter.emit('doctor.leave.requested', {
      leaveId: leave.id,
      doctorId: dto.doctorId,
      organizationId,
      userId: actorUserId,
    })

    return this.toResponse(leave)
  }

  async approve(
    organizationId: string,
    leaveId: string,
    dto: DecideLeaveDto,
    actorUserId: string,
  ): Promise<DoctorLeave> {
    const leave = await this.requirePending(organizationId, leaveId)

    const updated = await this.prisma.doctorLeave.update({
      where: { id: leave.id },
      data: {
        status: 'APPROVED',
        decidedByUserId: actorUserId,
        decidedAt: new Date(),
        decisionNote: dto.decisionNote,
      },
    })

    this.eventEmitter.emit('doctor.leave.approved', {
      leaveId: leave.id,
      doctorId: leave.doctorId,
      organizationId,
      userId: actorUserId,
    })

    return this.toResponse(updated)
  }

  async reject(
    organizationId: string,
    leaveId: string,
    dto: DecideLeaveDto,
    actorUserId: string,
  ): Promise<DoctorLeave> {
    const leave = await this.requirePending(organizationId, leaveId)

    const updated = await this.prisma.doctorLeave.update({
      where: { id: leave.id },
      data: {
        status: 'REJECTED',
        decidedByUserId: actorUserId,
        decidedAt: new Date(),
        decisionNote: dto.decisionNote,
      },
    })

    this.eventEmitter.emit('doctor.leave.rejected', {
      leaveId: leave.id,
      doctorId: leave.doctorId,
      organizationId,
      userId: actorUserId,
    })

    return this.toResponse(updated)
  }

  async cancel(organizationId: string, leaveId: string, actorUserId: string): Promise<DoctorLeave> {
    const leave = await this.requireLeave(organizationId, leaveId)

    if (leave.status !== 'PENDING' && leave.status !== 'APPROVED') {
      throw new ConflictException(`Cannot cancel a leave request that is already ${leave.status.toLowerCase()}`)
    }
    const today = toDbDateOnly(new Date())
    if (leave.status === 'APPROVED' && leave.startDate < today) {
      throw new ConflictException('Cannot cancel a leave that has already started')
    }

    const updated = await this.prisma.doctorLeave.update({
      where: { id: leave.id },
      data: { status: 'CANCELLED' },
    })

    this.eventEmitter.emit('doctor.leave.cancelled', {
      leaveId: leave.id,
      doctorId: leave.doctorId,
      organizationId,
      userId: actorUserId,
    })

    return this.toResponse(updated)
  }

  async getById(organizationId: string, leaveId: string): Promise<DoctorLeaveWithDoctor> {
    const leave = await this.prisma.doctorLeave.findFirst({
      where: { id: leaveId, organizationId },
      include: LEAVE_WITH_DOCTOR_INCLUDE,
    })
    if (!leave) throw new NotFoundException('Leave request not found')
    return this.toResponseWithDoctor(leave)
  }

  async list(organizationId: string, query: LeaveSearchQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20

    const where: Prisma.DoctorLeaveWhereInput = { organizationId }
    if (query.doctorId) where.doctorId = query.doctorId
    if (query.status) where.status = query.status as unknown as Prisma.EnumLeaveStatusFilter
    // "from"/"to" filter to leave requests whose date range intersects
    // [from, to] - a leave starting before `to` and ending after `from`.
    if (query.from) where.endDate = { gte: new Date(query.from) }
    if (query.to) where.startDate = { lte: new Date(query.to) }

    const [data, total] = await Promise.all([
      this.prisma.doctorLeave.findMany({
        where,
        include: LEAVE_WITH_DOCTOR_INCLUDE,
        orderBy: { startDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.doctorLeave.count({ where }),
    ])

    return {
      data: data.map((leave) => this.toResponseWithDoctor(leave)),
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

  async listUpcoming(organizationId: string, limit = 10): Promise<DoctorLeaveWithDoctor[]> {
    const today = toDbDateOnly(new Date())
    const leaves = await this.prisma.doctorLeave.findMany({
      where: { organizationId, status: 'APPROVED', startDate: { gt: today } },
      include: LEAVE_WITH_DOCTOR_INCLUDE,
      orderBy: { startDate: 'asc' },
      take: Math.min(limit, 100),
    })
    return leaves.map((leave) => this.toResponseWithDoctor(leave))
  }

  private async requirePending(organizationId: string, leaveId: string): Promise<PrismaDoctorLeave> {
    const leave = await this.requireLeave(organizationId, leaveId)
    if (leave.status !== 'PENDING') {
      throw new ConflictException(`Leave request is already ${leave.status.toLowerCase()}`)
    }
    return leave
  }

  private async requireLeave(organizationId: string, leaveId: string): Promise<PrismaDoctorLeave> {
    const leave = await this.prisma.doctorLeave.findFirst({ where: { id: leaveId, organizationId } })
    if (!leave) throw new NotFoundException('Leave request not found')
    return leave
  }

  private toResponse(leave: PrismaDoctorLeave): DoctorLeave {
    return {
      id: leave.id,
      doctorId: leave.doctorId,
      organizationId: leave.organizationId,
      leaveType: leave.leaveType as unknown as LeaveType,
      startDate: leave.startDate.toISOString().slice(0, 10),
      endDate: leave.endDate.toISOString().slice(0, 10),
      reason: leave.reason,
      status: leave.status as unknown as LeaveStatus,
      appliedByUserId: leave.appliedByUserId,
      decidedByUserId: leave.decidedByUserId,
      decidedAt: leave.decidedAt,
      decisionNote: leave.decisionNote,
      createdAt: leave.createdAt,
      updatedAt: leave.updatedAt,
    }
  }

  private toResponseWithDoctor(leave: LeaveWithDoctor): DoctorLeaveWithDoctor {
    return {
      ...this.toResponse(leave),
      doctor: {
        id: leave.doctorId,
        fullName: `${leave.doctor.user.firstName} ${leave.doctor.user.lastName}`,
      },
    }
  }
}
