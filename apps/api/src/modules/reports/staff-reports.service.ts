import { ReportFilterQuery, StaffAttendanceRow, StaffReport } from '@medicore/types'
import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'
import { toDbDateOnly } from '../scheduling/availability.util'
import { ShiftsService } from '../staff/shifts.service'

import { countSeries, percentOf, resolveRange, toBreakdown, toPeriod } from './report-range.util'

/** Attendance statuses that mean the person actually showed up. */
const PRESENT_STATUSES: readonly string[] = ['PRESENT', 'LATE', 'HALF_DAY']

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** An attendance row carrying just enough to derive overtime. */
type AttendanceRow = {
  staffId: string
  date: Date
  status: string
  workedMinutes: number | null
  shift: { startTime: string; endTime: string; breakMinutes: number } | null
}

/**
 * Staff & attendance reporting (Checkpoint 17.1).
 *
 * Overtime deliberately reuses `ShiftsService.standardMinutes` - the same
 * rostered-shift rule `PayrollService` applies - instead of assuming a fixed
 * workday. A second definition here would let payroll prep and the staff
 * report disagree about the same person's month, which is exactly the kind
 * of duplicated business logic this milestone is not allowed to introduce.
 *
 * `Attendance.date` is a `@db.Date` column, so every comparison goes through
 * `toDbDateOnly` - the helper the attendance module writes with - so a report
 * can never straddle a row by an hour of timezone offset.
 */
@Injectable()
export class StaffReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(organizationId: string, query: ReportFilterQuery = {}): Promise<StaffReport> {
    const range = resolveRange(query)
    const dateWindow = { gte: toDbDateOnly(range.from), lt: toDbDateOnly(range.to) }

    const staffScope: Prisma.StaffWhereInput = {
      organizationId,
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.hospitalId ? { hospitalId: query.hospitalId } : {}),
    }

    const [totalStaff, activeStaff, staff, attendance, statusGroups, leaves, pendingLeaveRequests, departments] =
      await Promise.all([
        this.prisma.staff.count({ where: staffScope }),
        this.prisma.staff.count({ where: { ...staffScope, employmentStatus: 'ACTIVE' } }),
        this.prisma.staff.findMany({
          where: staffScope,
          select: {
            id: true,
            employeeId: true,
            department: { select: { name: true } },
            user: { select: { firstName: true, lastName: true } },
          },
        }),
        this.prisma.attendance.findMany({
          where: { organizationId, date: dateWindow, staff: staffScope },
          select: {
            staffId: true,
            date: true,
            status: true,
            workedMinutes: true,
            shift: { select: { startTime: true, endTime: true, breakMinutes: true } },
          },
        }),
        this.prisma.attendance.groupBy({
          by: ['status'],
          where: { organizationId, date: dateWindow, staff: staffScope },
          _count: true,
        }),
        this.prisma.staffLeave.findMany({
          where: {
            organizationId,
            status: 'APPROVED',
            staff: staffScope,
            startDate: { lt: toDbDateOnly(range.to) },
            endDate: { gte: toDbDateOnly(range.from) },
          },
          select: { staffId: true, leaveType: true, startDate: true, endDate: true },
        }),
        this.prisma.staffLeave.count({ where: { organizationId, status: 'PENDING', staff: staffScope } }),
        this.prisma.staff.groupBy({
          by: ['departmentId'],
          where: { ...staffScope, employmentStatus: 'ACTIVE' },
          _count: true,
        }),
      ])

    const present = attendance.filter((a) => PRESENT_STATUSES.includes(a.status))

    return {
      period: toPeriod(range),
      totalStaff,
      activeStaff,
      attendanceByStatus: toBreakdown(statusGroups, (g) => g.status),
      attendanceTrend: countSeries(present, range, (a) => a.date),
      overallAttendanceRatePercent: percentOf(present.length, attendance.length),
      totalOvertimeMinutes: attendance.reduce((total, row) => total + this.overtimeMinutes(row), 0),
      leaveByType: this.countLeaveByType(leaves),
      leaveDaysTaken: this.countLeaveDays(leaves, range.from, range.to),
      pendingLeaveRequests,
      departmentStrength: await this.buildDepartmentStrength(departments),
      staff: this.buildStaffRows(staff, attendance),
    }
  }

  /**
   * Overtime is only defined against a rostered shift - an attendance row
   * with no shift has no standard to exceed, so it contributes zero rather
   * than being measured against an invented default day.
   */
  private overtimeMinutes(row: AttendanceRow): number {
    if (!row.shift || row.workedMinutes === null) return 0
    return Math.max(0, row.workedMinutes - ShiftsService.standardMinutes(row.shift))
  }

  private countLeaveByType(leaves: Array<{ leaveType: string }>): Array<{ label: string; count: number }> {
    const counts = new Map<string, number>()
    for (const leave of leaves) counts.set(leave.leaveType, (counts.get(leave.leaveType) ?? 0) + 1)
    return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
  }

  /**
   * Leave days are clipped to the reporting window - a two-week leave that
   * starts before the window contributes only the days that fall inside it,
   * so two adjacent monthly reports sum to the same total as one report over
   * the combined span.
   */
  private countLeaveDays(leaves: Array<{ startDate: Date; endDate: Date }>, from: Date, to: Date): number {
    let days = 0
    for (const leave of leaves) {
      const start = leave.startDate > from ? leave.startDate : from
      // `endDate` is inclusive, `to` is exclusive - push the former out by a
      // day before clipping so a single-day leave counts as one, not zero.
      const endExclusive = new Date(leave.endDate.getTime() + MS_PER_DAY)
      const end = endExclusive < to ? endExclusive : to
      days += Math.max(0, Math.round((end.getTime() - start.getTime()) / MS_PER_DAY))
    }
    return days
  }

  private async buildDepartmentStrength(
    groups: Array<{ departmentId: string | null; _count: number }>,
  ): Promise<Array<{ label: string; count: number }>> {
    const ids = groups.map((g) => g.departmentId).filter((id): id is string => !!id)
    const departments = ids.length
      ? await this.prisma.department.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
      : []
    const nameById = new Map(departments.map((d) => [d.id, d.name]))

    return groups
      .map((group) => ({
        // Staff with no department are a real category, not an error - they
        // are shown as "Unassigned" rather than dropped from the headcount.
        label: group.departmentId ? (nameById.get(group.departmentId) ?? 'Unknown') : 'Unassigned',
        count: group._count,
      }))
      .sort((a, b) => b.count - a.count)
  }

  private buildStaffRows(
    staff: Array<{
      id: string
      employeeId: string
      department: { name: string } | null
      user: { firstName: string; lastName: string }
    }>,
    attendance: AttendanceRow[],
  ): StaffAttendanceRow[] {
    return staff
      .map((member) => {
        const own = attendance.filter((a) => a.staffId === member.id)
        const countOf = (status: string) => own.filter((a) => a.status === status).length
        const present = own.filter((a) => PRESENT_STATUSES.includes(a.status)).length

        return {
          staffId: member.id,
          employeeId: member.employeeId,
          staffName: `${member.user.firstName} ${member.user.lastName}`,
          departmentName: member.department?.name ?? null,
          present: countOf('PRESENT'),
          late: countOf('LATE'),
          absent: countOf('ABSENT'),
          onLeave: countOf('ON_LEAVE'),
          workedMinutes: own.reduce((total, a) => total + (a.workedMinutes ?? 0), 0),
          overtimeMinutes: own.reduce((total, row) => total + this.overtimeMinutes(row), 0),
          attendanceRatePercent: percentOf(present, own.length),
        }
      })
      // Staff with no attendance rows in the window carry no signal - listing
      // them as 0% present would read as absenteeism rather than "not rostered".
      .filter((row) => row.present + row.late + row.absent + row.onLeave > 0)
      .sort((a, b) => b.attendanceRatePercent - a.attendanceRatePercent)
  }
}
