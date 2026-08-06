import { z } from 'zod'

import { AttendanceStatus } from './enums'
import { StaffSummary } from './shift'
import { optionalString } from './zod-helpers'

export interface Attendance {
  id: string
  staffId: string
  staff?: StaffSummary
  shiftId: string | null
  organizationId: string
  date: string
  clockInAt: Date | null
  clockOutAt: Date | null
  status: AttendanceStatus
  workedMinutes: number | null
  lateByMinutes: number | null
  notes: string | null
  isCorrected: boolean
  correctedByUserId: string | null
  correctionReason: string | null
  correctedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export const ClockInSchema = z.object({
  staffId: z.string().min(1).optional(),
  notes: z.string().max(500).optional(),
})

export type ClockInDto = z.infer<typeof ClockInSchema>

export const ClockOutSchema = z.object({
  staffId: z.string().min(1).optional(),
  notes: z.string().max(500).optional(),
})

export type ClockOutDto = z.infer<typeof ClockOutSchema>

export const MarkAttendanceSchema = z.object({
  staffId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  status: z.nativeEnum(AttendanceStatus),
  clockInAt: optionalString(z.string().datetime()),
  clockOutAt: optionalString(z.string().datetime()),
  notes: z.string().max(500).optional(),
})

export type MarkAttendanceDto = z.infer<typeof MarkAttendanceSchema>

export const CorrectAttendanceSchema = z.object({
  status: z.nativeEnum(AttendanceStatus).optional(),
  clockInAt: z.string().datetime().nullable().optional(),
  clockOutAt: z.string().datetime().nullable().optional(),
  correctionReason: z.string().min(1).max(500),
})

export type CorrectAttendanceDto = z.infer<typeof CorrectAttendanceSchema>

export interface AttendanceSearchQuery {
  staffId?: string
  departmentId?: string
  status?: AttendanceStatus
  from?: string
  to?: string
  page?: number
  limit?: number
}

export interface AttendanceCalendarDay {
  date: string
  status: AttendanceStatus
  clockInAt: Date | null
  clockOutAt: Date | null
  workedMinutes: number | null
}

export interface AttendanceDashboardStats {
  presentToday: number
  lateToday: number
  halfDayToday: number
  absentToday: number
  onLeaveToday: number
  totalStaff: number
}
