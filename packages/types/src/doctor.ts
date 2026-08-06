import { z } from 'zod'

import { UpcomingLeaveEntry } from './doctor-availability'
import { DoctorAvailabilityStatus } from './enums'
import { optionalString } from './zod-helpers'

export interface DoctorHospitalSummary {
  id: string
  name: string
  code: string
}

export interface DoctorDepartmentSummary {
  id: string
  name: string
  code: string
}

export interface Doctor {
  id: string
  userId: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  phone: string | null
  registrationNumber: string
  specialization: string
  subSpecialization: string | null
  qualification: string
  experienceYears: number
  languagesSpoken: string[]
  bio: string | null
  consultationFee: number
  availabilityStatus: DoctorAvailabilityStatus
  joiningDate: Date
  hospitalId: string
  hospital: DoctorHospitalSummary | null
  departmentId: string | null
  department: DoctorDepartmentSummary | null
  organizationId: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export const CreateDoctorSchema = z.object({
  // Account fields - used to create (or link to) the doctor's login.
  email: z.string().email(),
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  phone: optionalString(z.string().regex(/^[6-9]\d{9}$/, 'Enter valid Indian mobile number')),

  // Professional profile fields.
  registrationNumber: z.string().min(1).max(50),
  specialization: z.string().min(2).max(100),
  subSpecialization: z.string().max(100).optional(),
  qualification: z.string().min(2).max(200),
  experienceYears: z.number().int().min(0).max(70),
  languagesSpoken: z.array(z.string().min(1).max(50)).default([]),
  bio: z.string().max(2000).optional(),
  consultationFee: z.number().nonnegative(),
  availabilityStatus: z.nativeEnum(DoctorAvailabilityStatus).default(DoctorAvailabilityStatus.AVAILABLE),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  hospitalId: z.string().min(1),
  departmentId: optionalString(z.string().min(1)),
})

export type CreateDoctorDto = z.infer<typeof CreateDoctorSchema>

export const UpdateDoctorSchema = CreateDoctorSchema.omit({
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
}).partial()

export type UpdateDoctorDto = z.infer<typeof UpdateDoctorSchema>

export interface DoctorSearchQuery {
  q?: string
  specialization?: string
  departmentId?: string
  hospitalId?: string
  language?: string
  availabilityStatus?: DoctorAvailabilityStatus
  isActive?: boolean
  sortBy?: 'createdAt' | 'firstName' | 'specialization' | 'experienceYears'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface DoctorDashboardStats {
  totalDoctors: number
  activeDoctors: number
  availableToday: number
  onLeaveToday: number
  offDutyToday: number
  upcomingLeave: UpcomingLeaveEntry[]
}

export interface DoctorSummaryCounts {
  appointments: number
  patients: number
  prescriptions: number
  labTests: number
  radiologyOrders: number
}

export interface DoctorWithSummary extends Doctor {
  summary: DoctorSummaryCounts
}
