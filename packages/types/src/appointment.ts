import { z } from 'zod'

import { AppointmentStatus, AppointmentType, RecurrenceFrequency } from './enums'

export interface Appointment {
  id: string
  appointmentNumber: string
  patientId: string
  doctorId: string
  departmentId: string | null
  organizationId: string
  scheduledAt: Date
  durationMinutes: number
  type: AppointmentType
  status: AppointmentStatus
  chiefComplaint: string | null
  notes: string | null
  roomNumber: string | null
  isWalkIn: boolean
  recurrenceGroupId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface TimeSlot {
  startTime: string
  endTime: string
  isAvailable: boolean
  appointmentId?: string
}

export const CreateAppointmentSchema = z.object({
  patientId: z.string().cuid(),
  doctorId: z.string().cuid(),
  departmentId: z.string().cuid().optional(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(5).max(240).default(15),
  type: z.nativeEnum(AppointmentType).default(AppointmentType.OPD),
  chiefComplaint: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
  roomNumber: z.string().max(100).optional(),
})

export type CreateAppointmentDto = z.infer<typeof CreateAppointmentSchema>

export const UpdateAppointmentStatusSchema = z.object({
  status: z.nativeEnum(AppointmentStatus),
  notes: z.string().max(1000).optional(),
})

export type UpdateAppointmentStatusDto = z.infer<typeof UpdateAppointmentStatusSchema>

export interface AppointmentQuery {
  date?: string
  doctorId?: string
  patientId?: string
  status?: AppointmentStatus
  type?: AppointmentType
  page?: number
  limit?: number
}

export interface AppointmentWithDetails extends Appointment {
  patient: {
    id: string
    fullName: string
    uhid: string
    phone: string
  }
  doctor: {
    id: string
    fullName: string
    specialization: string
  }
  department: { id: string; name: string } | null
}

export const CreateWalkInAppointmentSchema = z.object({
  patientId: z.string().cuid(),
  doctorId: z.string().cuid(),
  departmentId: z.string().cuid().optional(),
  durationMinutes: z.number().int().min(5).max(240).default(15),
  type: z.nativeEnum(AppointmentType).default(AppointmentType.OPD),
  chiefComplaint: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
})

export type CreateWalkInAppointmentDto = z.infer<typeof CreateWalkInAppointmentSchema>

export const CreateRecurringAppointmentSchema = z
  .object({
    patientId: z.string().cuid(),
    doctorId: z.string().cuid(),
    departmentId: z.string().cuid().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format: HH:mm'),
    frequency: z.nativeEnum(RecurrenceFrequency),
    occurrences: z.number().int().min(2).max(52),
    durationMinutes: z.number().int().min(5).max(240).default(15),
    type: z.nativeEnum(AppointmentType).default(AppointmentType.OPD),
    chiefComplaint: z.string().max(500).optional(),
    notes: z.string().max(1000).optional(),
  })
  .refine((dto) => !(dto.frequency === RecurrenceFrequency.WEEKLY && dto.occurrences > 26), {
    message: 'Weekly recurrences are capped at 26 occurrences (~6 months)',
    path: ['occurrences'],
  })

export type CreateRecurringAppointmentDto = z.infer<typeof CreateRecurringAppointmentSchema>

export interface RecurringBookingFailure {
  scheduledAt: string
  reason: string
}

export interface RecurringBookingResult {
  recurrenceGroupId: string
  booked: Appointment[]
  failed: RecurringBookingFailure[]
}
