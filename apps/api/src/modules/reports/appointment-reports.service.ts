import { AppointmentReport, DoctorUtilisationRow, ReportFilterQuery, ScheduleShift } from '@medicore/types'
import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'
import { toMinutes, weekdayOf } from '../scheduling/availability.util'

import {
  addDays,
  average,
  comparison,
  countSeries,
  minutesBetween,
  percentOf,
  resolveRange,
  toBreakdown,
  toPeriod,
  ResolvedRange,
} from './report-range.util'

/** Statuses that represent a settled outcome - the denominator for no-show rate. */
const TERMINAL_STATUSES: readonly string[] = ['COMPLETED', 'CANCELLED', 'NO_SHOW']

/**
 * Appointment reporting (Checkpoint 17.1). Honours `from`/`to`/`groupBy`
 * plus `doctorId`/`departmentId` (both are real `Appointment` columns) and
 * `hospitalId`, which is applied through the doctor's hospital since
 * `Appointment` itself has no hospital column.
 */
@Injectable()
export class AppointmentReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(organizationId: string, query: ReportFilterQuery = {}): Promise<AppointmentReport> {
    const range = resolveRange(query)
    const where = this.buildWhere(organizationId, query)
    const window = { gte: range.from, lt: range.to }

    const [appointments, previousTotal, statusGroups, typeGroups] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { ...where, scheduledAt: window },
        select: {
          id: true,
          doctorId: true,
          scheduledAt: true,
          durationMinutes: true,
          status: true,
          isWalkIn: true,
          encounter: { select: { createdAt: true } },
        },
      }),
      this.prisma.appointment.count({
        where: { ...where, scheduledAt: { gte: range.previousFrom, lt: range.previousTo } },
      }),
      this.prisma.appointment.groupBy({
        by: ['status'],
        where: { ...where, scheduledAt: window },
        _count: true,
      }),
      this.prisma.appointment.groupBy({
        by: ['type'],
        where: { ...where, scheduledAt: window },
        _count: true,
      }),
    ])

    const total = appointments.length
    const noShows = appointments.filter((a) => a.status === 'NO_SHOW')
    const walkIns = appointments.filter((a) => a.isWalkIn)
    const terminal = appointments.filter((a) => TERMINAL_STATUSES.includes(a.status)).length

    // `Encounter.createdAt` is when the consultation record was opened - the
    // closest thing this schema has to "consultation started". There is no
    // arrival/check-in column (TD-0051), so this is a scheduling delay, not a
    // waiting-room time, and negative values (seen early) are kept rather
    // than clamped so the mean stays honest.
    const delays = appointments
      .filter((a) => a.encounter)
      .map((a) => minutesBetween(a.scheduledAt, (a.encounter as { createdAt: Date }).createdAt))

    const doctorUtilisation = await this.buildDoctorUtilisation(organizationId, range, appointments)

    return {
      period: toPeriod(range),
      total,
      dailyTrend: countSeries(appointments, range, (a) => a.scheduledAt),
      byStatus: toBreakdown(statusGroups, (g) => g.status),
      byType: toBreakdown(typeGroups, (g) => g.type),
      doctorUtilisation,
      averageConsultationDelayMinutes: average(delays),
      consultationDelaySampleSize: delays.length,
      noShow: {
        count: noShows.length,
        ratePercent: percentOf(noShows.length, terminal),
        byDoctor: this.byDoctor(noShows, doctorUtilisation),
        trend: countSeries(noShows, range, (a) => a.scheduledAt),
      },
      walkIn: {
        count: walkIns.length,
        ratePercent: percentOf(walkIns.length, total),
        trend: countSeries(walkIns, range, (a) => a.scheduledAt),
      },
      totalComparison: comparison(total, previousTotal),
    }
  }

  /**
   * `hospitalId` filters through the doctor rather than the appointment -
   * `Appointment` has `departmentId` but no `hospitalId`, and a department
   * already belongs to exactly one hospital, so routing it through
   * `doctor.hospitalId` keeps the filter meaningful without a schema change.
   */
  private buildWhere(organizationId: string, query: ReportFilterQuery): Prisma.AppointmentWhereInput {
    return {
      organizationId,
      ...(query.doctorId ? { doctorId: query.doctorId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.hospitalId ? { doctor: { hospitalId: query.hospitalId } } : {}),
    }
  }

  private byDoctor(
    rows: Array<{ doctorId: string }>,
    doctors: DoctorUtilisationRow[],
  ): Array<{ label: string; count: number }> {
    const nameById = new Map(doctors.map((d) => [d.doctorId, d.doctorName]))
    const counts = new Map<string, number>()
    for (const row of rows) {
      const label = nameById.get(row.doctorId) ?? row.doctorId
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
  }

  /**
   * Utilisation = booked appointment minutes over scheduled availability
   * minutes for the same window. Availability is reconstructed from the same
   * `DoctorSchedule`/`DoctorScheduleDay` rows `AvailabilityService` reads, so
   * the denominator here and the slot generator can never disagree about what
   * a doctor's working week is.
   */
  private async buildDoctorUtilisation(
    organizationId: string,
    range: ResolvedRange,
    appointments: Array<{ doctorId: string; durationMinutes: number; status: string }>,
  ): Promise<DoctorUtilisationRow[]> {
    const doctorIds = [...new Set(appointments.map((a) => a.doctorId))]
    if (doctorIds.length === 0) return []

    const [doctors, schedules] = await Promise.all([
      this.prisma.doctor.findMany({
        where: { organizationId, id: { in: doctorIds } },
        select: {
          id: true,
          department: { select: { name: true } },
          user: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.doctorSchedule.findMany({
        where: { organizationId, doctorId: { in: doctorIds }, isActive: true, effectiveFrom: { lt: range.to } },
        select: {
          doctorId: true,
          effectiveFrom: true,
          days: { select: { dayOfWeek: true, isWorkingDay: true, shifts: true } },
        },
        orderBy: { effectiveFrom: 'desc' },
      }),
    ])

    // The schedule in force is the latest `effectiveFrom` at or before the
    // window - the same selection rule DoctorSchedule's own comment states.
    const scheduleByDoctor = new Map<string, (typeof schedules)[number]>()
    for (const schedule of schedules) {
      if (!scheduleByDoctor.has(schedule.doctorId)) scheduleByDoctor.set(schedule.doctorId, schedule)
    }

    const doctorMeta = new Map(doctors.map((d) => [d.id, d]))

    return doctorIds
      .map((doctorId) => {
        const own = appointments.filter((a) => a.doctorId === doctorId)
        const meta = doctorMeta.get(doctorId)
        const bookedMinutes = own.reduce((total, a) => total + a.durationMinutes, 0)
        const availableMinutes = this.availableMinutes(scheduleByDoctor.get(doctorId), range)

        return {
          doctorId,
          doctorName: meta ? `${meta.user.firstName} ${meta.user.lastName}` : doctorId,
          departmentName: meta?.department?.name ?? null,
          booked: own.length,
          completed: own.filter((a) => a.status === 'COMPLETED').length,
          cancelled: own.filter((a) => a.status === 'CANCELLED').length,
          noShow: own.filter((a) => a.status === 'NO_SHOW').length,
          bookedMinutes,
          utilisationPercent: availableMinutes > 0 ? percentOf(bookedMinutes, availableMinutes) : null,
        }
      })
      .sort((a, b) => b.booked - a.booked)
  }

  /**
   * Total scheduled working minutes across the window, walking the range one
   * day at a time and summing that weekday's shifts (breaks excluded - they
   * are not bookable, so counting them would understate utilisation).
   */
  private availableMinutes(
    // `dayOfWeek` is keyed as a plain string: Prisma's generated `Weekday`
    // and the `Weekday` in `@medicore/types` are two structurally identical
    // string enums that TypeScript still treats as distinct nominal types.
    schedule: { days: Array<{ dayOfWeek: string; isWorkingDay: boolean; shifts: unknown }> } | undefined,
    range: ResolvedRange,
  ): number {
    if (!schedule) return 0

    const minutesByWeekday = new Map<string, number>()
    for (const day of schedule.days) {
      if (!day.isWorkingDay) continue
      const shifts = (Array.isArray(day.shifts) ? day.shifts : []) as ScheduleShift[]
      const minutes = shifts.reduce((total, shift) => {
        const shiftMinutes = toMinutes(shift.endTime) - toMinutes(shift.startTime)
        const breakMinutes = (shift.breaks ?? []).reduce(
          (breaks, b) => breaks + (toMinutes(b.endTime) - toMinutes(b.startTime)),
          0,
        )
        return total + Math.max(0, shiftMinutes - breakMinutes)
      }, 0)
      minutesByWeekday.set(day.dayOfWeek, minutes)
    }

    let total = 0
    for (let cursor = new Date(range.from); cursor < range.to; cursor = addDays(cursor, 1)) {
      total += minutesByWeekday.get(weekdayOf(cursor)) ?? 0
    }
    return total
  }
}
