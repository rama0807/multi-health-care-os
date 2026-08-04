import { z } from 'zod'

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

export interface Shift {
  id: string
  organizationId: string
  name: string
  code: string
  startTime: string
  endTime: string
  breakMinutes: number
  gracePeriodMinutes: number
  isNightShift: boolean
  isActive: boolean
  // Derived, not stored — (endTime - startTime), crossing midnight for a
  // night shift, minus breakMinutes.
  standardMinutes: number
  createdAt: Date
  updatedAt: Date
}

export const CreateShiftSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(20),
  startTime: z.string().regex(TIME_REGEX, 'Format: HH:mm'),
  endTime: z.string().regex(TIME_REGEX, 'Format: HH:mm'),
  breakMinutes: z.number().int().min(0).max(480).default(0),
  gracePeriodMinutes: z.number().int().min(0).max(120).default(15),
  isNightShift: z.boolean().default(false),
})

export type CreateShiftDto = z.infer<typeof CreateShiftSchema>

export const UpdateShiftSchema = CreateShiftSchema.partial().extend({
  isActive: z.boolean().optional(),
})

export type UpdateShiftDto = z.infer<typeof UpdateShiftSchema>

export interface ShiftSearchQuery {
  isActive?: boolean
  page?: number
  limit?: number
}

export interface StaffSummary {
  id: string
  fullName: string
  employeeId: string
  designation: string
}

export interface ShiftRoster {
  id: string
  staffId: string
  staff: StaffSummary
  shiftId: string | null
  shift: Shift | null
  organizationId: string
  date: string
  isOff: boolean
  notes: string | null
  createdByUserId: string | null
  createdAt: Date
  updatedAt: Date
}

export const AssignShiftRosterSchema = z
  .object({
    staffId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
    shiftId: z.string().min(1).optional(),
    isOff: z.boolean().default(false),
    notes: z.string().max(500).optional(),
  })
  .refine((dto) => dto.isOff || !!dto.shiftId, {
    message: 'A working day roster entry needs a shift',
    path: ['shiftId'],
  })

export type AssignShiftRosterDto = z.infer<typeof AssignShiftRosterSchema>

/** Bulk-assign one shift (or a day off) across several staff for one date — the "Staff assignment" workflow. */
export const BulkAssignShiftRosterSchema = z.object({
  staffIds: z.array(z.string().min(1)).min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  shiftId: z.string().min(1).optional(),
  isOff: z.boolean().default(false),
})

export type BulkAssignShiftRosterDto = z.infer<typeof BulkAssignShiftRosterSchema>

export interface ShiftRosterQuery {
  staffId?: string
  shiftId?: string
  departmentId?: string
  from: string
  to: string
}
