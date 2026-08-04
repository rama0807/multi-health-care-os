import { PayrollSummaryEntry, PayrollSummaryQuery, PayrollSummaryResponse } from '@medicore/types'
import { BadRequestException, Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { HolidaysService } from './holidays.service'
import { LeaveTypesService } from './leave-types.service'
import { ShiftsService } from './shifts.service'

/**
 * Payroll *preparation* only — attendance/leave summaries, a derived per-day
 * rate for overtime and unpaid-leave deduction, and an export. No pay-run,
 * payslip, or disbursement processing (deliberately out of scope this
 * milestone — see TECH_DEBT). The per-day rate uses the common Indian
 * payroll convention `monthlySalary / 30`, regardless of the month's actual
 * length — a disclosed, standard approximation, not a fabricated one.
 */
@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly holidaysService: HolidaysService,
    private readonly leaveTypesService: LeaveTypesService,
  ) {}

  async getSummary(organizationId: string, query: PayrollSummaryQuery): Promise<PayrollSummaryResponse> {
    if (!/^\d{4}-\d{2}$/.test(query.month)) throw new BadRequestException('"month" must be in YYYY-MM format')

    const [year, monthNum] = query.month.split('-').map(Number)
    const from = new Date(Date.UTC(year, monthNum - 1, 1))
    const to = new Date(Date.UTC(year, monthNum, 0))
    const totalDays = to.getUTCDate()

    const where: Prisma.StaffWhereInput = { organizationId, employmentStatus: { not: 'TERMINATED' } }
    if (query.departmentId) where.departmentId = query.departmentId
    if (query.staffId) where.id = query.staffId

    const [staffList, holidays, leaveConfigs] = await Promise.all([
      this.prisma.staff.findMany({
        where,
        include: { user: { select: { firstName: true, lastName: true } }, department: { select: { name: true } } },
      }),
      this.holidaysService.findInRange(organizationId, from, to),
      this.leaveTypesService.findAllActive(organizationId),
    ])
    const paidByLeaveType = new Map(leaveConfigs.map((c) => [c.leaveType, c.isPaid]))
    const holidayDays = holidays.length

    const entries = await Promise.all(
      staffList.map(async (staff) => {
        const [attendanceRows, rosterOffDays, approvedLeaves] = await Promise.all([
          this.prisma.attendance.findMany({
            where: { staffId: staff.id, organizationId, date: { gte: from, lte: to } },
            include: { shift: true },
          }),
          this.prisma.shiftRoster.count({
            where: { staffId: staff.id, organizationId, isOff: true, date: { gte: from, lte: to } },
          }),
          this.prisma.staffLeave.findMany({
            where: {
              staffId: staff.id,
              organizationId,
              status: 'APPROVED',
              startDate: { lte: to },
              endDate: { gte: from },
            },
          }),
        ])

        const daysPresent = attendanceRows.filter((a) => a.status === 'PRESENT').length
        const daysLate = attendanceRows.filter((a) => a.status === 'LATE').length
        const daysHalfDay = attendanceRows.filter((a) => a.status === 'HALF_DAY').length
        const daysAbsent = attendanceRows.filter((a) => a.status === 'ABSENT').length

        let paidLeaveDays = 0
        let unpaidLeaveDays = 0
        for (const leave of approvedLeaves) {
          const overlapStart = leave.startDate > from ? leave.startDate : from
          const overlapEnd = leave.endDate < to ? leave.endDate : to
          const days = Math.round((overlapEnd.getTime() - overlapStart.getTime()) / 86_400_000) + 1
          if (paidByLeaveType.get(leave.leaveType) ?? true) paidLeaveDays += days
          else unpaidLeaveDays += days
        }

        let overtimeMinutes = 0
        const perDayRate = staff.monthlySalary ? Number(staff.monthlySalary) / 30 : null
        let overtimeAmount = perDayRate ? 0 : null

        for (const row of attendanceRows) {
          if (!row.shift || row.workedMinutes === null) continue
          const standard = ShiftsService.standardMinutes(row.shift)
          const extra = Math.max(0, row.workedMinutes - standard)
          overtimeMinutes += extra
          if (perDayRate !== null && overtimeAmount !== null) {
            overtimeAmount += extra * (perDayRate / standard)
          }
        }

        const netPayableDays = Math.min(
          totalDays,
          daysPresent + daysLate + daysHalfDay * 0.5 + paidLeaveDays + holidayDays + rosterOffDays,
        )

        const entry: PayrollSummaryEntry = {
          staffId: staff.id,
          employeeId: staff.employeeId,
          fullName: `${staff.user.firstName} ${staff.user.lastName}`,
          departmentName: staff.department?.name ?? null,
          designation: staff.designation,
          totalDays,
          daysPresent,
          daysLate,
          daysHalfDay,
          daysAbsent,
          paidLeaveDays,
          unpaidLeaveDays,
          holidayDays,
          weekOffDays: rosterOffDays,
          overtimeMinutes,
          overtimeAmount: overtimeAmount === null ? null : Math.round(overtimeAmount * 100) / 100,
          leaveDeductionAmount: perDayRate === null ? null : Math.round(unpaidLeaveDays * perDayRate * 100) / 100,
          netPayableDays,
        }
        return entry
      }),
    )

    return { month: query.month, generatedAt: new Date(), entries }
  }

  toCsv(response: PayrollSummaryResponse): string {
    const header = [
      'Employee ID',
      'Name',
      'Department',
      'Designation',
      'Total Days',
      'Present',
      'Late',
      'Half Day',
      'Absent',
      'Paid Leave',
      'Unpaid Leave',
      'Holidays',
      'Week Off',
      'Overtime (mins)',
      'Overtime Amount',
      'Leave Deduction',
      'Net Payable Days',
    ]

    const rows = response.entries.map((e) => [
      e.employeeId,
      e.fullName,
      e.departmentName ?? '',
      e.designation,
      e.totalDays,
      e.daysPresent,
      e.daysLate,
      e.daysHalfDay,
      e.daysAbsent,
      e.paidLeaveDays,
      e.unpaidLeaveDays,
      e.holidayDays,
      e.weekOffDays,
      e.overtimeMinutes,
      e.overtimeAmount ?? '',
      e.leaveDeductionAmount ?? '',
      e.netPayableDays,
    ])

    const escape = (value: unknown) => {
      const str = String(value)
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
    }

    return [header, ...rows].map((row) => row.map(escape).join(',')).join('\n')
  }
}
