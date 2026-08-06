import {
  Attendance,
  AttendanceDashboardStats,
  AttendanceSearchQuery,
  ClockInDto,
  ClockOutDto,
  CorrectAttendanceDto,
  MarkAttendanceDto,
} from '@medicore/types'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Attendance as PrismaAttendance, Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'
import { combineDateAndMinutes, toDbDateOnly, toMinutes } from '../scheduling/availability.util'

import { ShiftRosterService } from './shift-roster.service'
import { ShiftsService } from './shifts.service'
import { StaffRefService } from './staff-ref.service'

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly staffRef: StaffRefService,
    private readonly shiftRoster: ShiftRosterService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async clockIn(organizationId: string, staffId: string, actorUserId?: string, dto?: ClockInDto): Promise<Attendance> {
    await this.staffRef.requireStaff(organizationId, staffId)

    const now = new Date()
    const date = toDbDateOnly(now)
    const existing = await this.prisma.attendance.findUnique({ where: { staffId_date: { staffId, date } } })
    if (existing?.clockInAt) throw new ConflictException('Already clocked in for today')

    const roster = await this.shiftRoster.findForStaffAndDate(organizationId, staffId, date)
    const shift = roster?.shift ?? null

    let status: PrismaAttendance['status'] = 'PRESENT'
    let lateByMinutes: number | null = null

    if (roster?.isOff) {
      status = 'WEEK_OFF'
    } else if (shift) {
      const shiftStart = combineDateAndMinutes(date, toMinutes(shift.startTime))
      const graceMs = shift.gracePeriodMinutes * 60_000
      if (now.getTime() > shiftStart.getTime() + graceMs) {
        lateByMinutes = Math.round((now.getTime() - shiftStart.getTime()) / 60_000)
        status = 'LATE'
      }
    }

    const attendance = await this.prisma.attendance.upsert({
      where: { staffId_date: { staffId, date } },
      create: {
        staffId,
        organizationId,
        shiftId: shift?.id ?? null,
        date,
        clockInAt: now,
        status,
        lateByMinutes,
        notes: dto?.notes,
      },
      update: { shiftId: shift?.id ?? null, clockInAt: now, status, lateByMinutes, notes: dto?.notes },
    })

    this.eventEmitter.emit('staff.attendance.clocked_in', {
      attendanceId: attendance.id,
      staffId,
      organizationId,
      userId: actorUserId,
    })

    return this.toResponse(attendance)
  }

  async clockOut(organizationId: string, staffId: string, actorUserId?: string, dto?: ClockOutDto): Promise<Attendance> {
    await this.staffRef.requireStaff(organizationId, staffId)

    const date = toDbDateOnly(new Date())
    const existing = await this.prisma.attendance.findUnique({ where: { staffId_date: { staffId, date } } })
    if (!existing?.clockInAt) throw new NotFoundException('No clock-in record found for today')
    if (existing.clockOutAt) throw new ConflictException('Already clocked out for today')

    const now = new Date()
    const shift = existing.shiftId ? await this.prisma.shift.findUnique({ where: { id: existing.shiftId } }) : null

    const rawMinutes = Math.round((now.getTime() - existing.clockInAt.getTime()) / 60_000)
    const workedMinutes = Math.max(0, shift ? rawMinutes - shift.breakMinutes : rawMinutes)

    let status = existing.status
    if (shift && existing.status !== 'WEEK_OFF') {
      const standard = ShiftsService.standardMinutes(shift)
      status = workedMinutes < standard / 2 ? 'HALF_DAY' : existing.lateByMinutes ? 'LATE' : 'PRESENT'
    }

    const attendance = await this.prisma.attendance.update({
      where: { id: existing.id },
      data: { clockOutAt: now, workedMinutes, status, notes: dto?.notes ?? existing.notes },
    })

    this.eventEmitter.emit('staff.attendance.clocked_out', {
      attendanceId: attendance.id,
      staffId,
      organizationId,
      userId: actorUserId,
    })

    return this.toResponse(attendance)
  }

  /** HR manually recording a day's attendance without a real clock-in/out (backdated marking, holiday, leave day). */
  async mark(organizationId: string, dto: MarkAttendanceDto, actorUserId?: string): Promise<Attendance> {
    await this.staffRef.requireStaff(organizationId, dto.staffId)
    const date = toDbDateOnly(new Date(dto.date))

    const attendance = await this.prisma.attendance.upsert({
      where: { staffId_date: { staffId: dto.staffId, date } },
      create: {
        staffId: dto.staffId,
        organizationId,
        date,
        status: dto.status,
        clockInAt: dto.clockInAt ? new Date(dto.clockInAt) : undefined,
        clockOutAt: dto.clockOutAt ? new Date(dto.clockOutAt) : undefined,
        notes: dto.notes,
      },
      update: {
        status: dto.status,
        clockInAt: dto.clockInAt ? new Date(dto.clockInAt) : undefined,
        clockOutAt: dto.clockOutAt ? new Date(dto.clockOutAt) : undefined,
        notes: dto.notes,
      },
    })

    this.eventEmitter.emit('staff.attendance.marked', {
      attendanceId: attendance.id,
      staffId: dto.staffId,
      organizationId,
      userId: actorUserId,
    })

    return this.toResponse(attendance)
  }

  async correct(organizationId: string, id: string, dto: CorrectAttendanceDto, actorUserId?: string): Promise<Attendance> {
    const existing = await this.prisma.attendance.findFirst({ where: { id, organizationId } })
    if (!existing) throw new NotFoundException('Attendance record not found')

    const clockInAt = dto.clockInAt === undefined ? existing.clockInAt : dto.clockInAt ? new Date(dto.clockInAt) : null
    const clockOutAt =
      dto.clockOutAt === undefined ? existing.clockOutAt : dto.clockOutAt ? new Date(dto.clockOutAt) : null

    const shift = existing.shiftId ? await this.prisma.shift.findUnique({ where: { id: existing.shiftId } }) : null
    const workedMinutes =
      clockInAt && clockOutAt
        ? Math.max(
            0,
            Math.round((clockOutAt.getTime() - clockInAt.getTime()) / 60_000) - (shift?.breakMinutes ?? 0),
          )
        : existing.workedMinutes

    const attendance = await this.prisma.attendance.update({
      where: { id },
      data: {
        status: dto.status ?? existing.status,
        clockInAt,
        clockOutAt,
        workedMinutes,
        isCorrected: true,
        correctedByUserId: actorUserId,
        correctionReason: dto.correctionReason,
        correctedAt: new Date(),
      },
    })

    this.eventEmitter.emit('staff.attendance.corrected', {
      attendanceId: attendance.id,
      staffId: attendance.staffId,
      organizationId,
      userId: actorUserId,
    })

    return this.toResponse(attendance)
  }

  async list(organizationId: string, query: AttendanceSearchQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20

    const where: Prisma.AttendanceWhereInput = { organizationId }
    if (query.staffId) where.staffId = query.staffId
    if (query.departmentId) where.staff = { departmentId: query.departmentId }
    if (query.status) where.status = query.status
    if (query.from) where.date = { ...(where.date as object), gte: toDbDateOnly(new Date(query.from)) }
    if (query.to) where.date = { ...(where.date as object), lte: toDbDateOnly(new Date(query.to)) }

    const [data, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.attendance.count({ where }),
    ])

    return {
      data: data.map((row) => ({
        ...this.toResponse(row),
        staff: {
          id: row.staffId,
          fullName: `${row.staff.user.firstName} ${row.staff.user.lastName}`,
          employeeId: row.staff.employeeId,
          designation: row.staff.designation,
        },
      })),
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

  /** One calendar month of attendance for a single staff member - only days with a recorded row are returned. */
  async calendar(organizationId: string, staffId: string, month: string): Promise<Attendance[]> {
    await this.staffRef.requireStaff(organizationId, staffId)
    const [year, monthNum] = month.split('-').map(Number)
    const from = new Date(Date.UTC(year, monthNum - 1, 1))
    const to = new Date(Date.UTC(year, monthNum, 0))

    const rows = await this.prisma.attendance.findMany({
      where: { staffId, organizationId, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
    })
    return rows.map((row) => this.toResponse(row))
  }

  async getDashboardStats(organizationId: string): Promise<AttendanceDashboardStats> {
    const date = toDbDateOnly(new Date())
    const [rows, totalStaff] = await Promise.all([
      this.prisma.attendance.groupBy({ by: ['status'], where: { organizationId, date }, _count: true }),
      this.prisma.staff.count({ where: { organizationId, employmentStatus: 'ACTIVE' } }),
    ])

    const countOf = (status: string) => rows.find((r) => r.status === status)?._count ?? 0

    return {
      presentToday: countOf('PRESENT'),
      lateToday: countOf('LATE'),
      halfDayToday: countOf('HALF_DAY'),
      absentToday: countOf('ABSENT'),
      onLeaveToday: countOf('ON_LEAVE'),
      totalStaff,
    }
  }

  private toResponse(attendance: PrismaAttendance): Attendance {
    return {
      id: attendance.id,
      staffId: attendance.staffId,
      shiftId: attendance.shiftId,
      organizationId: attendance.organizationId,
      date: attendance.date.toISOString().slice(0, 10),
      clockInAt: attendance.clockInAt,
      clockOutAt: attendance.clockOutAt,
      status: attendance.status as unknown as Attendance['status'],
      workedMinutes: attendance.workedMinutes,
      lateByMinutes: attendance.lateByMinutes,
      notes: attendance.notes,
      isCorrected: attendance.isCorrected,
      correctedByUserId: attendance.correctedByUserId,
      correctionReason: attendance.correctionReason,
      correctedAt: attendance.correctedAt,
      createdAt: attendance.createdAt,
      updatedAt: attendance.updatedAt,
    }
  }
}
