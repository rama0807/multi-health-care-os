import { ApplyStaffLeaveDto, DecideStaffLeaveDto, LeaveBalanceEntry, StaffLeave, StaffLeaveSearchQuery } from '@medicore/types'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Prisma, StaffLeave as PrismaStaffLeave, User } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'
import { toDbDateOnly } from '../scheduling/availability.util'

import { LeaveTypesService } from './leave-types.service'
import { StaffRefService } from './staff-ref.service'

type LeaveWithStaff = PrismaStaffLeave & { staff: { employeeId: string; designation: string; user: Pick<User, 'firstName' | 'lastName'> } }

const LEAVE_WITH_STAFF_INCLUDE = {
  staff: { select: { employeeId: true, designation: true, user: { select: { firstName: true, lastName: true } } } },
} satisfies Prisma.StaffLeaveInclude

function inclusiveDays(startDate: Date, endDate: Date): number {
  return Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1
}

@Injectable()
export class StaffLeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly staffRef: StaffRefService,
    private readonly leaveTypesService: LeaveTypesService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async apply(organizationId: string, dto: ApplyStaffLeaveDto, staffId: string, actorUserId: string): Promise<StaffLeave> {
    await this.staffRef.requireStaff(organizationId, staffId)

    const startDate = new Date(dto.startDate)
    const endDate = new Date(dto.endDate)

    const overlapping = await this.prisma.staffLeave.findFirst({
      where: {
        staffId,
        organizationId,
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    })
    if (overlapping) {
      throw new ConflictException('This staff member already has a pending or approved leave request overlapping these dates')
    }

    const leave = await this.prisma.staffLeave.create({
      data: {
        staffId,
        organizationId,
        leaveType: dto.leaveType,
        startDate,
        endDate,
        reason: dto.reason,
        appliedByUserId: actorUserId,
      },
    })

    this.eventEmitter.emit('staff.leave.requested', { leaveId: leave.id, staffId, organizationId, userId: actorUserId })

    return this.toResponse(leave)
  }

  async approve(organizationId: string, leaveId: string, dto: DecideStaffLeaveDto, actorUserId: string): Promise<StaffLeave> {
    const leave = await this.requirePending(organizationId, leaveId)

    const updated = await this.prisma.staffLeave.update({
      where: { id: leave.id },
      data: { status: 'APPROVED', decidedByUserId: actorUserId, decidedAt: new Date(), decisionNote: dto.decisionNote },
    })

    this.eventEmitter.emit('staff.leave.approved', { leaveId: leave.id, staffId: leave.staffId, organizationId, userId: actorUserId })

    return this.toResponse(updated)
  }

  async reject(organizationId: string, leaveId: string, dto: DecideStaffLeaveDto, actorUserId: string): Promise<StaffLeave> {
    const leave = await this.requirePending(organizationId, leaveId)

    const updated = await this.prisma.staffLeave.update({
      where: { id: leave.id },
      data: { status: 'REJECTED', decidedByUserId: actorUserId, decidedAt: new Date(), decisionNote: dto.decisionNote },
    })

    this.eventEmitter.emit('staff.leave.rejected', { leaveId: leave.id, staffId: leave.staffId, organizationId, userId: actorUserId })

    return this.toResponse(updated)
  }

  async cancel(organizationId: string, leaveId: string, actorUserId: string): Promise<StaffLeave> {
    const leave = await this.requireLeave(organizationId, leaveId)

    if (leave.status !== 'PENDING' && leave.status !== 'APPROVED') {
      throw new ConflictException(`Cannot cancel a leave request that is already ${leave.status.toLowerCase()}`)
    }
    const today = toDbDateOnly(new Date())
    if (leave.status === 'APPROVED' && leave.startDate < today) {
      throw new ConflictException('Cannot cancel a leave that has already started')
    }

    const updated = await this.prisma.staffLeave.update({ where: { id: leave.id }, data: { status: 'CANCELLED' } })

    this.eventEmitter.emit('staff.leave.cancelled', { leaveId: leave.id, staffId: leave.staffId, organizationId, userId: actorUserId })

    return this.toResponse(updated)
  }

  async getById(organizationId: string, leaveId: string): Promise<StaffLeave> {
    const leave = await this.prisma.staffLeave.findFirst({ where: { id: leaveId, organizationId }, include: LEAVE_WITH_STAFF_INCLUDE })
    if (!leave) throw new NotFoundException('Leave request not found')
    return this.toResponseWithStaff(leave)
  }

  async list(organizationId: string, query: StaffLeaveSearchQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20

    const where: Prisma.StaffLeaveWhereInput = { organizationId }
    if (query.staffId) where.staffId = query.staffId
    if (query.status) where.status = query.status
    if (query.leaveType) where.leaveType = query.leaveType
    if (query.from) where.endDate = { gte: new Date(query.from) }
    if (query.to) where.startDate = { lte: new Date(query.to) }

    const [data, total] = await Promise.all([
      this.prisma.staffLeave.findMany({
        where,
        include: LEAVE_WITH_STAFF_INCLUDE,
        orderBy: { startDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.staffLeave.count({ where }),
    ])

    return {
      data: data.map((leave) => this.toResponseWithStaff(leave)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrev: page > 1 },
    }
  }

  /** annualDays (per the org's LeaveTypeConfig) minus the sum of approved leave day-spans starting in the given year. */
  async getBalance(organizationId: string, staffId: string, year: number): Promise<LeaveBalanceEntry[]> {
    await this.staffRef.requireStaff(organizationId, staffId)

    const configs = await this.leaveTypesService.findAllActive(organizationId)
    const yearStart = new Date(Date.UTC(year, 0, 1))
    const yearEnd = new Date(Date.UTC(year, 11, 31))

    const approvedLeaves = await this.prisma.staffLeave.findMany({
      where: { staffId, organizationId, status: 'APPROVED', startDate: { gte: yearStart, lte: yearEnd } },
    })

    return configs.map((config) => {
      const usedDays = approvedLeaves
        .filter((leave) => leave.leaveType === config.leaveType)
        .reduce((sum, leave) => sum + inclusiveDays(leave.startDate, leave.endDate), 0)

      return {
        leaveType: config.leaveType as unknown as LeaveBalanceEntry['leaveType'],
        isPaid: config.isPaid,
        annualDays: config.annualDays,
        usedDays,
        remainingDays: Math.max(0, config.annualDays - usedDays),
      }
    })
  }

  private async requirePending(organizationId: string, leaveId: string): Promise<PrismaStaffLeave> {
    const leave = await this.requireLeave(organizationId, leaveId)
    if (leave.status !== 'PENDING') throw new ConflictException(`Leave request is already ${leave.status.toLowerCase()}`)
    return leave
  }

  private async requireLeave(organizationId: string, leaveId: string): Promise<PrismaStaffLeave> {
    const leave = await this.prisma.staffLeave.findFirst({ where: { id: leaveId, organizationId } })
    if (!leave) throw new NotFoundException('Leave request not found')
    return leave
  }

  private toResponse(leave: PrismaStaffLeave): StaffLeave {
    return {
      id: leave.id,
      staffId: leave.staffId,
      organizationId: leave.organizationId,
      leaveType: leave.leaveType as unknown as StaffLeave['leaveType'],
      startDate: leave.startDate.toISOString().slice(0, 10),
      endDate: leave.endDate.toISOString().slice(0, 10),
      days: inclusiveDays(leave.startDate, leave.endDate),
      reason: leave.reason,
      status: leave.status as unknown as StaffLeave['status'],
      appliedByUserId: leave.appliedByUserId,
      decidedByUserId: leave.decidedByUserId,
      decidedAt: leave.decidedAt,
      decisionNote: leave.decisionNote,
      createdAt: leave.createdAt,
      updatedAt: leave.updatedAt,
    }
  }

  private toResponseWithStaff(leave: LeaveWithStaff): StaffLeave {
    return {
      ...this.toResponse(leave),
      staff: {
        id: leave.staffId,
        fullName: `${leave.staff.user.firstName} ${leave.staff.user.lastName}`,
        employeeId: leave.staff.employeeId,
        designation: leave.staff.designation,
      },
    }
  }
}
