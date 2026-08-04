import { z } from 'zod'

import {
  FallRiskLevel,
  IpdOrderCategory,
  IpdOrderStatus,
  NursingNoteType,
  NursingTaskPriority,
  NursingTaskStatus,
  PressureUlcerRiskLevel,
  ShiftType,
} from './enums'

// ─── Nursing Notes ──────────────────────────────────────────────────────────

export interface NursingNote {
  id: string
  admissionId: string
  organizationId: string
  type: NursingNoteType
  shift: ShiftType | null
  content: string
  isEscalated: boolean
  escalationReason: string | null
  createdByUserId: string
  createdAt: Date
}

export const CreateNursingNoteSchema = z.object({
  type: z.nativeEnum(NursingNoteType).default(NursingNoteType.GENERAL),
  shift: z.nativeEnum(ShiftType).optional(),
  content: z.string().min(1).max(5000),
  isEscalated: z.boolean().default(false),
  escalationReason: z.string().max(1000).optional(),
})

export type CreateNursingNoteDto = z.infer<typeof CreateNursingNoteSchema>

export interface NursingNoteQuery {
  type?: NursingNoteType
  isEscalated?: boolean
  page?: number
  limit?: number
}

// ─── Nursing Assessments (pain / fall risk / Braden / GCS / daily) ─────────

export interface NursingAssessment {
  id: string
  admissionId: string
  organizationId: string
  painScore: number | null
  fallRiskScore: number | null
  fallRiskLevel: FallRiskLevel | null
  bradenScore: number | null
  bradenRiskLevel: PressureUlcerRiskLevel | null
  gcsEye: number | null
  gcsVerbal: number | null
  gcsMotor: number | null
  gcsTotal: number | null
  generalNotes: string | null
  assessedByUserId: string
  assessedAt: Date
}

export const CreateNursingAssessmentSchema = z.object({
  painScore: z.number().int().min(0).max(10).optional(),
  fallRiskScore: z.number().int().min(0).max(125).optional(),
  bradenScore: z.number().int().min(6).max(23).optional(),
  gcsEye: z.number().int().min(1).max(4).optional(),
  gcsVerbal: z.number().int().min(1).max(5).optional(),
  gcsMotor: z.number().int().min(1).max(6).optional(),
  generalNotes: z.string().max(5000).optional(),
})

export type CreateNursingAssessmentDto = z.infer<typeof CreateNursingAssessmentSchema>

export interface NursingAssessmentQuery {
  page?: number
  limit?: number
}

// ─── Intake / Output Chart ──────────────────────────────────────────────────

export interface IntakeOutputRecord {
  id: string
  admissionId: string
  organizationId: string
  recordedAt: Date
  oralIntakeMl: number | null
  ivFluidIntakeMl: number | null
  otherIntakeMl: number | null
  urineOutputMl: number | null
  stoolOutputCount: number | null
  vomitusMl: number | null
  drainOutputMl: number | null
  otherOutputMl: number | null
  notes: string | null
  recordedByUserId: string
  /** Server-computed at read time from the intake/output fields above — not persisted (mirrors `Vital.bmi`'s computed-field precedent). */
  totalIntakeMl: number
  totalOutputMl: number
  balanceMl: number
}

export const CreateIntakeOutputSchema = z.object({
  oralIntakeMl: z.number().int().min(0).optional(),
  ivFluidIntakeMl: z.number().int().min(0).optional(),
  otherIntakeMl: z.number().int().min(0).optional(),
  urineOutputMl: z.number().int().min(0).optional(),
  stoolOutputCount: z.number().int().min(0).optional(),
  vomitusMl: z.number().int().min(0).optional(),
  drainOutputMl: z.number().int().min(0).optional(),
  otherOutputMl: z.number().int().min(0).optional(),
  notes: z.string().max(1000).optional(),
})

export type CreateIntakeOutputDto = z.infer<typeof CreateIntakeOutputSchema>

export interface IntakeOutputQuery {
  page?: number
  limit?: number
}

// ─── IPD Orders (diet / fluid / activity / oxygen / isolation) ────────────

export interface IpdOrder {
  id: string
  admissionId: string
  organizationId: string
  category: IpdOrderCategory
  instructions: string
  status: IpdOrderStatus
  orderedByUserId: string
  startedAt: Date
  discontinuedAt: Date | null
  discontinuedReason: string | null
  discontinuedByUserId: string | null
  createdAt: Date
}

export const CreateIpdOrderSchema = z.object({
  category: z.nativeEnum(IpdOrderCategory),
  instructions: z.string().min(1).max(2000),
})

export type CreateIpdOrderDto = z.infer<typeof CreateIpdOrderSchema>

export const DiscontinueIpdOrderSchema = z.object({
  reason: z.string().max(1000).optional(),
})

export type DiscontinueIpdOrderDto = z.infer<typeof DiscontinueIpdOrderSchema>

export interface IpdOrderQuery {
  category?: IpdOrderCategory
  status?: IpdOrderStatus
  page?: number
  limit?: number
}

// ─── Nursing Tasks ──────────────────────────────────────────────────────────

export interface NursingTask {
  id: string
  admissionId: string
  organizationId: string
  sourceOrderId: string | null
  title: string
  description: string | null
  priority: NursingTaskPriority
  dueAt: Date | null
  status: NursingTaskStatus
  assignedToUserId: string | null
  completedByUserId: string | null
  completedAt: Date | null
  completionNotes: string | null
  createdByUserId: string | null
  createdAt: Date
}

export interface NursingTaskWithDetails extends NursingTask {
  admission: { id: string; admissionNumber: string; patientId: string; patientName: string; wardName: string }
}

export const CreateNursingTaskSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  priority: z.nativeEnum(NursingTaskPriority).default(NursingTaskPriority.ROUTINE),
  dueAt: z.coerce.date().optional(),
  assignedToUserId: z.string().cuid().optional(),
  sourceOrderId: z.string().cuid().optional(),
})

export type CreateNursingTaskDto = z.infer<typeof CreateNursingTaskSchema>

export const UpdateNursingTaskStatusSchema = z.object({
  status: z.nativeEnum(NursingTaskStatus),
  completionNotes: z.string().max(2000).optional(),
})

export type UpdateNursingTaskStatusDto = z.infer<typeof UpdateNursingTaskStatusSchema>

export interface NursingTaskQuery {
  admissionId?: string
  status?: NursingTaskStatus
  priority?: NursingTaskPriority
  assignedToUserId?: string
  page?: number
  limit?: number
}
