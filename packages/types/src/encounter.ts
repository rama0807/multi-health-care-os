import { z } from 'zod'

import { DiagnosisType, EncounterAttachmentType, EncounterStatus, EncounterType } from './enums'
import { optionalString } from './zod-helpers'

export interface Encounter {
  id: string
  patientId: string
  doctorId: string
  appointmentId: string | null
  organizationId: string
  type: EncounterType
  status: EncounterStatus
  notes: string | null
  encounterDate: Date
  createdAt: Date
  updatedAt: Date
}

export interface EncounterWithDetails extends Encounter {
  patient: {
    id: string
    fullName: string
    uhid: string
  }
  doctor: {
    id: string
    fullName: string
    specialization: string
  }
}

export const CreateEncounterSchema = z.object({
  patientId: z.string().cuid(),
  doctorId: z.string().cuid(),
  appointmentId: z.string().cuid().optional(),
  type: z.nativeEnum(EncounterType).default(EncounterType.OPD),
  notes: z.string().max(2000).optional(),
})

export type CreateEncounterDto = z.infer<typeof CreateEncounterSchema>

export const UpdateEncounterStatusSchema = z.object({
  status: z.nativeEnum(EncounterStatus),
})

export type UpdateEncounterStatusDto = z.infer<typeof UpdateEncounterStatusSchema>

export interface EncounterQuery {
  patientId?: string
  doctorId?: string
  status?: EncounterStatus
  type?: EncounterType
  page?: number
  limit?: number
}

// ─── Clinical Notes (append-only, versioned) ───────────────────────────────

export interface ClinicalNote {
  id: string
  encounterId: string
  version: number
  chiefComplaint: string | null
  historyOfPresentIllness: string | null
  pastMedicalHistory: string | null
  familyHistory: string | null
  surgicalHistory: string | null
  socialHistory: string | null
  allergies: string | null
  currentMedications: string | null
  createdByUserId: string
  createdAt: Date
}

export const CreateClinicalNoteSchema = z.object({
  chiefComplaint: z.string().max(2000).optional(),
  historyOfPresentIllness: z.string().max(4000).optional(),
  pastMedicalHistory: z.string().max(4000).optional(),
  familyHistory: z.string().max(4000).optional(),
  surgicalHistory: z.string().max(4000).optional(),
  socialHistory: z.string().max(4000).optional(),
  allergies: z.string().max(2000).optional(),
  currentMedications: z.string().max(2000).optional(),
})

export type CreateClinicalNoteDto = z.infer<typeof CreateClinicalNoteSchema>

// ─── Vitals ─────────────────────────────────────────────────────────────────

export interface Vital {
  id: string
  encounterId: string
  heightCm: number | null
  weightKg: number | null
  bmi: number | null
  bloodPressureSystolic: number | null
  bloodPressureDiastolic: number | null
  pulse: number | null
  temperatureCelsius: number | null
  respiratoryRate: number | null
  spo2: number | null
  recordedByUserId: string
  recordedAt: Date
}

export const RecordVitalSchema = z
  .object({
    heightCm: z.number().min(20).max(280).optional(),
    weightKg: z.number().min(0.5).max(400).optional(),
    bloodPressureSystolic: z.number().int().min(40).max(300).optional(),
    bloodPressureDiastolic: z.number().int().min(20).max(200).optional(),
    pulse: z.number().int().min(20).max(300).optional(),
    temperatureCelsius: z.number().min(30).max(45).optional(),
    respiratoryRate: z.number().int().min(5).max(80).optional(),
    spo2: z.number().int().min(0).max(100).optional(),
  })
  .refine((v) => Object.values(v).some((val) => val !== undefined), {
    message: 'At least one vital sign must be provided',
  })

export type RecordVitalDto = z.infer<typeof RecordVitalSchema>

// ─── Diagnoses ──────────────────────────────────────────────────────────────

export interface Diagnosis {
  id: string
  encounterId: string
  type: DiagnosisType
  description: string
  icdCode: string | null
  createdAt: Date
}

export const CreateDiagnosisSchema = z.object({
  type: z.nativeEnum(DiagnosisType).default(DiagnosisType.PRIMARY),
  description: z.string().min(1).max(500),
  icdCode: z.string().max(20).optional(),
})

export type CreateDiagnosisDto = z.infer<typeof CreateDiagnosisSchema>

// ─── Procedures ─────────────────────────────────────────────────────────────

export interface Procedure {
  id: string
  encounterId: string
  name: string
  notes: string | null
  performedAt: Date
  createdAt: Date
}

export const CreateProcedureSchema = z.object({
  name: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
  performedAt: optionalString(z.string().datetime()),
})

export type CreateProcedureDto = z.infer<typeof CreateProcedureSchema>

// ─── Attachments ────────────────────────────────────────────────────────────

export interface EncounterAttachment {
  id: string
  encounterId: string
  documentType: EncounterAttachmentType
  fileName: string
  fileUrl: string
  mimeType: string
  fileSizeBytes: number
  uploadedAt: Date
}
