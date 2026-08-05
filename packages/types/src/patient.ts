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
  headOfFamilyId: string | null
  mergedIntoId: string | null
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
  dob?: string
  gender?: Gender
  isActive?: boolean
  sortBy?: 'createdAt' | 'firstName' | 'lastName' | 'uhid'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export const CreatePatientDocumentSchema = z.object({
  documentType: z.nativeEnum(DocumentType),
})
export type CreatePatientDocumentDto = z.infer<typeof CreatePatientDocumentSchema>

export const DuplicateCheckSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})
export type DuplicateCheckDto = z.infer<typeof DuplicateCheckSchema>

export interface DuplicateMatch {
  patient: Patient
  confidence: number
  matchedFields: Array<'phone' | 'dateOfBirth' | 'firstName' | 'lastName'>
}

export interface DuplicateCheckResult {
  matches: DuplicateMatch[]
}

export type PatientTimelineEntryType =
  | 'REGISTRATION'
  | 'APPOINTMENT'
  | 'ADMISSION'
  | 'LAB_TEST'
  | 'RADIOLOGY'
  | 'PRESCRIPTION'
  | 'INVOICE'
  | 'AUDIT'

export interface PatientTimelineEntry {
  id: string
  type: PatientTimelineEntryType
  title: string
  description?: string
  occurredAt: Date
  metadata?: Record<string, unknown>
}

export interface PatientSummaryCounts {
  appointments: number
  admissions: number
  labTests: number
  radiologyOrders: number
  invoices: number
  medicalRecords: number
  prescriptions: number
  insuranceClaims: number
}

export interface PatientWithSummary extends Patient {
  summary: PatientSummaryCounts
}

// ─── Family linkage ─────────────────────────────────────────────────────────

export const LinkFamilyMemberSchema = z.object({
  headOfFamilyId: z.string().min(1),
})
export type LinkFamilyMemberDto = z.infer<typeof LinkFamilyMemberSchema>

export interface FamilyGroup {
  headOfFamily: Patient
  members: Patient[]
}

// ─── Patient merge ──────────────────────────────────────────────────────────

export const MergePatientsSchema = z.object({
  sourcePatientId: z.string().min(1),
  targetPatientId: z.string().min(1),
})
export type MergePatientsDto = z.infer<typeof MergePatientsSchema>

export interface PatientMergeResult {
  survivorPatientId: string
  mergedPatientId: string
  reassignedCounts: Record<string, number>
}

// ─── CSV import ─────────────────────────────────────────────────────────────

export interface CsvImportRowResult {
  row: number
  success: boolean
  patientId?: string
  uhid?: string
  error?: string
}

export interface CsvImportResult {
  total: number
  created: number
  failed: number
  results: CsvImportRowResult[]
}
