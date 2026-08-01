import { z } from 'zod'

import { Weekday } from './enums'

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

export const ScheduleBreakSchema = z
  .object({
    startTime: z.string().regex(TIME_REGEX, 'Format: HH:mm'),
    endTime: z.string().regex(TIME_REGEX, 'Format: HH:mm'),
  })
  .refine((b) => b.startTime < b.endTime, { message: 'Break end time must be after start time' })

export type ScheduleBreak = z.infer<typeof ScheduleBreakSchema>

export const ScheduleShiftSchema = z
  .object({
    startTime: z.string().regex(TIME_REGEX, 'Format: HH:mm'),
    endTime: z.string().regex(TIME_REGEX, 'Format: HH:mm'),
    slotDurationMinutes: z.number().int().min(5).max(240),
    breaks: z.array(ScheduleBreakSchema).default([]),
  })
  .refine((s) => s.startTime < s.endTime, { message: 'Shift end time must be after start time' })
  .refine((s) => s.breaks.every((b) => b.startTime >= s.startTime && b.endTime <= s.endTime), {
    message: 'Breaks must fall within the shift window',
    path: ['breaks'],
  })

export type ScheduleShift = z.infer<typeof ScheduleShiftSchema>

export const ScheduleDaySchema = z
  .object({
    dayOfWeek: z.nativeEnum(Weekday),
    isWorkingDay: z.boolean(),
    shifts: z.array(ScheduleShiftSchema).default([]),
  })
  .refine((d) => !d.isWorkingDay || d.shifts.length > 0, {
    message: 'A working day needs at least one shift',
    path: ['shifts'],
  })
  .refine((d) => d.isWorkingDay || d.shifts.length === 0, {
    message: 'A non-working day cannot have shifts',
    path: ['shifts'],
  })

export type ScheduleDay = z.infer<typeof ScheduleDaySchema>

export const WEEKDAY_ORDER: Weekday[] = [
  Weekday.SUNDAY,
  Weekday.MONDAY,
  Weekday.TUESDAY,
  Weekday.WEDNESDAY,
  Weekday.THURSDAY,
  Weekday.FRIDAY,
  Weekday.SATURDAY,
]

export const CreateDoctorScheduleSchema = z.object({
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  days: z
    .array(ScheduleDaySchema)
    .length(7, 'Exactly one entry per day of the week is required')
    .refine((days) => new Set(days.map((d) => d.dayOfWeek)).size === 7, {
      message: 'Each day of the week must appear exactly once',
    }),
})

export type CreateDoctorScheduleDto = z.infer<typeof CreateDoctorScheduleSchema>

export const UpdateDoctorScheduleVersionSchema = z.object({
  isActive: z.boolean(),
})

export type UpdateDoctorScheduleVersionDto = z.infer<typeof UpdateDoctorScheduleVersionSchema>

export interface DoctorScheduleDay {
  id: string
  dayOfWeek: Weekday
  isWorkingDay: boolean
  shifts: ScheduleShift[]
}

export interface DoctorSchedule {
  id: string
  doctorId: string
  organizationId: string
  effectiveFrom: string
  isActive: boolean
  days: DoctorScheduleDay[]
  createdAt: Date
  updatedAt: Date
}
