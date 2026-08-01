import { z } from 'zod'

import { LeaveStatus, LeaveType } from './enums'

export const ApplyLeaveSchema = z
  .object({
    doctorId: z.string().min(1),
    leaveType: z.nativeEnum(LeaveType),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
    reason: z.string().max(1000).optional(),
  })
  .refine((dto) => dto.startDate <= dto.endDate, {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  })

export type ApplyLeaveDto = z.infer<typeof ApplyLeaveSchema>

export const DecideLeaveSchema = z.object({
  decisionNote: z.string().max(1000).optional(),
})

export type DecideLeaveDto = z.infer<typeof DecideLeaveSchema>

export interface DoctorLeave {
  id: string
  doctorId: string
  organizationId: string
  leaveType: LeaveType
  startDate: string
  endDate: string
  reason: string | null
  status: LeaveStatus
  appliedByUserId: string
  decidedByUserId: string | null
  decidedAt: Date | null
  decisionNote: string | null
  createdAt: Date
  updatedAt: Date
}

export interface DoctorLeaveWithDoctor extends DoctorLeave {
  doctor: {
    id: string
    fullName: string
  }
}

export interface LeaveSearchQuery {
  doctorId?: string
  status?: LeaveStatus
  from?: string
  to?: string
  page?: number
  limit?: number
}
