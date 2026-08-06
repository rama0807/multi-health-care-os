import { AssignShiftRosterDto, BulkAssignShiftRosterDto, ShiftRoster, ShiftRosterQuery } from '@medicore/types'
import { Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Prisma, ShiftRoster as PrismaShiftRoster, Staff, User } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { ShiftsService } from './shifts.service'
import { StaffRefService } from './staff-ref.service'

type RosterWithRelations = PrismaShiftRoster & {
  staff: Staff & { user: Pick<User, 'firstName' | 'lastName'> }
  shift: Prisma.ShiftGetPayload<object> | null
}

const ROSTER_INCLUDE = {
  staff: { include: { user: { select: { firstName: true, lastName: true } } } },
  shift: true,
} satisfies Prisma.ShiftRosterInclude

@Injectable()
export class ShiftRosterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly staffRef: StaffRefService,
    private readonly shiftsService: ShiftsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** The "weekly roster" view - every assignment for a date range, optionally scoped to one staff/shift/department. */
  async list(organizationId: string, query: ShiftRosterQuery): Promise<ShiftRoster[]> {
    const where: Prisma.ShiftRosterWhereInput = {
      organizationId,
      date: { gte: new Date(query.from), lte: new Date(query.to) },
    }
    if (query.staffId) where.staffId = query.staffId
    if (query.shiftId) where.shiftId = query.shiftId
    if (query.departmentId) where.staff = { departmentId: query.departmentId }

    const rows = await this.prisma.shiftRoster.findMany({
      where,
      include: ROSTER_INCLUDE,
      orderBy: [{ date: 'asc' }, { staffId: 'asc' }],
    })
    return rows.map((row) => this.toResponse(row))
  }

  async assign(organizationId: string, dto: AssignShiftRosterDto, actorUserId?: string): Promise<ShiftRoster> {
    await this.staffRef.requireStaff(organizationId, dto.staffId)
    if (dto.shiftId) await this.shiftsService.requireShift(organizationId, dto.shiftId)

    const date = new Date(dto.date)
    const roster = await this.prisma.shiftRoster.upsert({
      where: { staffId_date: { staffId: dto.staffId, date } },
      create: {
        staffId: dto.staffId,
        organizationId,
        shiftId: dto.isOff ? null : dto.shiftId,
        date,
        isOff: dto.isOff,
        notes: dto.notes,
        createdByUserId: actorUserId,
      },
      update: {
        shiftId: dto.isOff ? null : dto.shiftId,
        isOff: dto.isOff,
        notes: dto.notes,
        createdByUserId: actorUserId,
      },
      include: ROSTER_INCLUDE,
    })

    // A day off is not an assignment worth telling anyone about; a real shift
    // is. `bulkAssign` routes through here, so one emit covers both paths.
    if (!dto.isOff) {
      this.eventEmitter.emit('staff.roster.assigned', {
        organizationId,
        shiftRosterId: roster.id,
        staffId: roster.staffId,
        shiftId: roster.shiftId,
        date: roster.date,
        userId: actorUserId,
      })
    }

    return this.toResponse(roster)
  }

  /** Assign the same shift (or day off) to several staff at once for one date - the "Staff assignment" bulk action. */
  async bulkAssign(
    organizationId: string,
    dto: BulkAssignShiftRosterDto,
    actorUserId?: string,
  ): Promise<ShiftRoster[]> {
    if (dto.shiftId) await this.shiftsService.requireShift(organizationId, dto.shiftId)

    const results: ShiftRoster[] = []
    for (const staffId of dto.staffIds) {
      results.push(
        await this.assign(
          organizationId,
          { staffId, date: dto.date, shiftId: dto.shiftId, isOff: dto.isOff },
          actorUserId,
        ),
      )
    }
    return results
  }

  async delete(organizationId: string, id: string): Promise<void> {
    const roster = await this.prisma.shiftRoster.findFirst({ where: { id, organizationId } })
    if (!roster) throw new NotFoundException('Roster entry not found')
    await this.prisma.shiftRoster.delete({ where: { id } })
  }

  /** Internal - consumed by AttendanceService to know which shift (if any) applies on a given staff/date. */
  async findForStaffAndDate(organizationId: string, staffId: string, date: Date): Promise<RosterWithRelations | null> {
    return this.prisma.shiftRoster.findFirst({
      where: { staffId, date, organizationId },
      include: ROSTER_INCLUDE,
    })
  }

  private toResponse(roster: RosterWithRelations): ShiftRoster {
    return {
      id: roster.id,
      staffId: roster.staffId,
      staff: {
        id: roster.staff.id,
        fullName: `${roster.staff.user.firstName} ${roster.staff.user.lastName}`,
        employeeId: roster.staff.employeeId,
        designation: roster.staff.designation,
      },
      shiftId: roster.shiftId,
      shift: roster.shift
        ? {
            id: roster.shift.id,
            organizationId: roster.shift.organizationId,
            name: roster.shift.name,
            code: roster.shift.code,
            startTime: roster.shift.startTime,
            endTime: roster.shift.endTime,
            breakMinutes: roster.shift.breakMinutes,
            gracePeriodMinutes: roster.shift.gracePeriodMinutes,
            isNightShift: roster.shift.isNightShift,
            isActive: roster.shift.isActive,
            standardMinutes: ShiftsService.standardMinutes(roster.shift),
            createdAt: roster.shift.createdAt,
            updatedAt: roster.shift.updatedAt,
          }
        : null,
      organizationId: roster.organizationId,
      date: roster.date.toISOString().slice(0, 10),
      isOff: roster.isOff,
      notes: roster.notes,
      createdByUserId: roster.createdByUserId,
      createdAt: roster.createdAt,
      updatedAt: roster.updatedAt,
    }
  }
}
