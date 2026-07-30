import { z } from 'zod'

import { AppointmentStatus, AppointmentType } from './enums'

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
})

export type CreateAppointmentDto = z.infer<typeof CreateAppointmentSchema>

export const UpdateAppointmentStatusSchema = z.object({
  status: z.nativeEnum(AppointmentStatus),
  notes: z.string().optional(),
})

export interface AppointmentQuery {
  date?: string
  doctorId?: string
  patientId?: string
  status?: AppointmentStatus
  type?: AppointmentType
  page?: number
  limit?: number
}
