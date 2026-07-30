import { z } from 'zod'

import { BloodGroup, DocumentType, Gender } from './enums'

export interface Patient {
  id: string
  uhid: string
  firstName: string
  lastName: string
  fullName: string
  email: string | null
  phone: string
  dateOfBirth: Date
  age: number
  gender: Gender
  bloodGroup: BloodGroup | null
  address: string | null
  city: string | null
  state: string | null
  pincode: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  organizationId: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface PatientDocument {
  id: string
  patientId: string
  documentType: DocumentType
  fileName: string
  fileUrl: string
  mimeType: string
  fileSizeBytes: number
  uploadedAt: Date
}

export const CreatePatientSchema = z.object({
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  email: z.string().email().optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter valid Indian mobile number'),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  gender: z.nativeEnum(Gender),
  bloodGroup: z.nativeEnum(BloodGroup).optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(50).optional(),
  state: z.string().max(50).optional(),
  pincode: z.string().regex(/^\d{6}$/).optional(),
  emergencyContactName: z.string().max(50).optional(),
  emergencyContactPhone: z
    .string()
    .regex(/^[6-9]\d{9}$/)
    .optional(),
})

export type CreatePatientDto = z.infer<typeof CreatePatientSchema>

export const UpdatePatientSchema = CreatePatientSchema.partial()
export type UpdatePatientDto = z.infer<typeof UpdatePatientSchema>

export interface PatientSearchQuery {
  q?: string
  uhid?: string
  phone?: string
  page?: number
  limit?: number
}
