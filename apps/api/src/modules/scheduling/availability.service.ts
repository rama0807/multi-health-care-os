import {
  AvailableSlot,
  DoctorAvailabilityDashboardStats,
  DoctorAvailabilityResult,
  DoctorTodayStatus,
  LeaveType,
  ScheduleShift,
  UpcomingLeaveEntry,
} from '@medicore/types'
import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'

import {
  combineDateAndMinutes,
  isNowWithinShift,
  minutesSinceMidnight,
  overlapsAnyBreak,
  parseDateOnly,
  toDbDateOnly,
  toLocalDateString,
  toLocalIsoString,
  toMinutes,
  weekdayOf,
} from './availability.util'
import { DoctorRefService } from './doctor-ref.service'
import { DoctorScheduleService } from './doctor-schedule.service'

/**
 * Reusable availability engine: weekly schedule + approved-leave overlay ->
 * bookable slots. Deliberately does NOT know about Appointment records yet
 * — appointment-conflict subtraction is Milestone 5's job (see ADR-0006).
 * The public shape (getAvailableSlots(organizationId, doctorId, date,
 * duration)) is meant to stay stable across that addition.
 */
@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly doctorRef: DoctorRefService,
    private readonly scheduleService: DoctorScheduleService,
  ) {}

  async getAvailableSlots(
    organizationId: string,
    doctorId: string,
    dateStr: string,
    durationMinutesOverride?: number,
  ): Promise<DoctorAvailabilityResult> {
    await this.doctorRef.requireDoctor(organizationId, doctorId)
    const date = parseDateOnly(dateStr)

    const leave = await this.findApprovedLeaveOn(organizationId, doctorId, date)
    if (leave) {
      return { doctorId, date: dateStr, isWorkingDay: false, onLeave: true, leaveType: leave, slots: [] }
    }

    const day = await this.getScheduleDay(organizationId, doctorId, date)
    if (!day || !day.isWorkingDay) {
      return { doctorId, date: dateStr, isWorkingDay: false, onLeave: false, slots: [] }
    }

    const slots: AvailableSlot[] = []
    for (const shift of day.shifts) {
      const duration = durationMinutesOverride ?? shift.slotDurationMinutes
      if (!duration || duration <= 0) continue

      const shiftEnd = toMinutes(shift.endTime)
      for (let cursor = toMinutes(shift.startTime); cursor + duration <= shiftEnd; cursor += duration) {
        if (overlapsAnyBreak(shift, cursor, cursor + duration)) continue
        slots.push({
          start: toLocalIsoString(combineDateAndMinutes(date, cursor)),
          end: toLocalIsoString(combineDateAndMinutes(date, cursor + duration)),
        })
      }
    }

    return { doctorId, date: dateStr, isWorkingDay: true, onLeave: false, slots }
  }

  async getTodayStatus(organizationId: string, doctorId: string): Promise<DoctorTodayStatus> {
    await this.doctorRef.requireDoctor(organizationId, doctorId)
    const now = new Date()
    const dateStr = toLocalDateString(now)
    const today = parseDateOnly(dateStr)

    const leave = await this.findApprovedLeaveOn(organizationId, doctorId, today)
    if (leave) {
      return { doctorId, date: dateStr, isWorkingDay: false, onLeave: true, leaveType: leave, withinShiftNow: false }
    }

    const day = await this.getScheduleDay(organizationId, doctorId, today)
    if (!day || !day.isWorkingDay) {
      return { doctorId, date: dateStr, isWorkingDay: false, onLeave: false, withinShiftNow: false }
    }

    const nowMinutes = minutesSinceMidnight(now)
    const withinShiftNow = day.shifts.some((shift) => isNowWithinShift(shift, nowMinutes))
    const nextShiftStart = day.shifts
      .map((shift) => toMinutes(shift.startTime))
      .filter((start) => start > nowMinutes)
      .sort((a, b) => a - b)[0]

    return {
      doctorId,
      date: dateStr,
      isWorkingDay: true,
      onLeave: false,
      withinShiftNow,
      nextShiftStart:
        nextShiftStart !== undefined ? toLocalIsoString(combineDateAndMinutes(today, nextShiftStart)) : undefined,
    }
  }

  async getDashboardStats(organizationId: string): Promise<DoctorAvailabilityDashboardStats> {
    const now = new Date()
    const today = parseDateOnly(toLocalDateString(now))
    const dbToday = toDbDateOnly(today)
    const nowMinutes = minutesSinceMidnight(now)
    const weekday = weekdayOf(today)

    const activeDoctors = await this.prisma.doctor.findMany({
      where: { organizationId, isActive: true },
      select: { id: true },
    })
    const doctorIds = activeDoctors.map((d) => d.id)
    if (doctorIds.length === 0) {
      return { availableToday: 0, onLeaveToday: 0, offDutyToday: 0, upcomingLeave: [] }
    }

    const [todaysLeave, schedules, upcomingLeaveRows] = await Promise.all([
      this.prisma.doctorLeave.findMany({
        where: {
          doctorId: { in: doctorIds },
          organizationId,
          status: 'APPROVED',
          startDate: { lte: dbToday },
          endDate: { gte: dbToday },
        },
        select: { doctorId: true },
      }),
      // Ordered by effectiveFrom desc so the first row seen per doctorId
      // below is that doctor's best-matching (most recent, already-started)
      // version — see DoctorScheduleService for the same resolution rule.
      this.prisma.doctorSchedule.findMany({
        where: { doctorId: { in: doctorIds }, organizationId, isActive: true, effectiveFrom: { lte: dbToday } },
        include: { days: true },
        orderBy: { effectiveFrom: 'desc' },
      }),
      this.prisma.doctorLeave.findMany({
        where: { organizationId, status: 'APPROVED', startDate: { gt: dbToday } },
        include: { doctor: { include: { user: { select: { firstName: true, lastName: true } } } } },
        orderBy: { startDate: 'asc' },
        take: 10,
      }),
    ])

    const onLeaveSet = new Set(todaysLeave.map((l) => l.doctorId))
    const scheduleByDoctor = new Map<string, (typeof schedules)[number]>()
    for (const schedule of schedules) {
      if (!scheduleByDoctor.has(schedule.doctorId)) scheduleByDoctor.set(schedule.doctorId, schedule)
    }

    let availableToday = 0
    let offDutyToday = 0
    for (const doctorId of doctorIds) {
      if (onLeaveSet.has(doctorId)) continue

      const schedule = scheduleByDoctor.get(doctorId)
      const day = schedule?.days.find((d) => d.dayOfWeek === weekday)
      if (!day?.isWorkingDay) {
        offDutyToday++
        continue
      }

      availableToday++
      const shifts = day.shifts as unknown as ScheduleShift[]
      if (!shifts.some((shift) => isNowWithinShift(shift, nowMinutes))) offDutyToday++
    }

    const upcomingLeave: UpcomingLeaveEntry[] = upcomingLeaveRows.map((leave) => ({
      leaveId: leave.id,
      doctorId: leave.doctorId,
      doctorName: `${leave.doctor.user.firstName} ${leave.doctor.user.lastName}`,
      leaveType: leave.leaveType as unknown as LeaveType,
      startDate: leave.startDate.toISOString().slice(0, 10),
      endDate: leave.endDate.toISOString().slice(0, 10),
    }))

    return { availableToday, onLeaveToday: onLeaveSet.size, offDutyToday, upcomingLeave }
  }

  private async findApprovedLeaveOn(
    organizationId: string,
    doctorId: string,
    date: Date,
  ): Promise<LeaveType | null> {
    const dbDate = toDbDateOnly(date)
    const leave = await this.prisma.doctorLeave.findFirst({
      where: { doctorId, organizationId, status: 'APPROVED', startDate: { lte: dbDate }, endDate: { gte: dbDate } },
    })
    return leave ? (leave.leaveType as unknown as LeaveType) : null
  }

  private async getScheduleDay(organizationId: string, doctorId: string, date: Date) {
    const schedule = await this.scheduleService.findEffectiveRow(organizationId, doctorId, date)
    const weekday = weekdayOf(date)
    const day = schedule?.days.find((d) => d.dayOfWeek === weekday)
    if (!day) return null
    return { isWorkingDay: day.isWorkingDay, shifts: day.shifts as unknown as ScheduleShift[] }
  }
}
