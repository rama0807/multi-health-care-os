import { z } from 'zod'

import { LeaveStatus, LeaveType } from './enums'
import { StaffSummary } from './shift'

export interface LeaveTypeConfig {
  id: string
  organizationId: string
  leaveType: LeaveType
  annualDays: number
  isPaid: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export const UpsertLeaveTypeConfigSchema = z.object({
  leaveType: z.nativeEnum(LeaveType),
  annualDays: z.number().int().min(0).max(365),
  isPaid: z.boolean().default(true),
  isActive: z.boolean().default(true),
})

export type UpsertLeaveTypeConfigDto = z.infer<typeof UpsertLeaveTypeConfigSchema>

export interface StaffLeave {
  id: string
  staffId: string
  staff?: StaffSummary
  organizationId: string
  leaveType: LeaveType
  startDate: string
  endDate: string
  days: number
  reason: string | null
  status: LeaveStatus
  appliedByUserId: string
  decidedByUserId: string | null
  decidedAt: Date | null
  decisionNote: string | null
  createdAt: Date
  updatedAt: Date
}

export const ApplyStaffLeaveSchema = z
  .object({
    staffId: z.string().min(1).optional(),
    leaveType: z.nativeEnum(LeaveType),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
    reason: z.string().max(1000).optional(),
  })
  .refine((dto) => dto.startDate <= dto.endDate, {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  })

export type ApplyStaffLeaveDto = z.infer<typeof ApplyStaffLeaveSchema>

export const DecideStaffLeaveSchema = z.object({
  decisionNote: z.string().max(1000).optional(),
})

export type DecideStaffLeaveDto = z.infer<typeof DecideStaffLeaveSchema>

export interface StaffLeaveSearchQuery {
  staffId?: string
  status?: LeaveStatus
  leaveType?: LeaveType
  from?: string
  to?: string
  page?: number
  limit?: number
}

export interface LeaveBalanceEntry {
  leaveType: LeaveType
  isPaid: boolean
  annualDays: number
  usedDays: number
  remainingDays: number
}

export interface Holiday {
  id: string
  organizationId: string
  name: string
  date: string
  isOptional: boolean
  createdAt: Date
  updatedAt: Date
}

export const UpsertHolidaySchema = z.object({
  name: z.string().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  isOptional: z.boolean().default(false),
})

export type UpsertHolidayDto = z.infer<typeof UpsertHolidaySchema>
