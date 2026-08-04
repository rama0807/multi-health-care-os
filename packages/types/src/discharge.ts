import { z } from 'zod'

import { DischargeChecklistItemKey } from './enums'

// ─── Discharge Approval ─────────────────────────────────────────────────────

export const ApproveDischargeSchema = z.object({
  dischargeCondition: z.string().max(500).optional(),
  expectedDischargeAt: z.coerce.date().optional(),
})

export type ApproveDischargeDto = z.infer<typeof ApproveDischargeSchema>

// ─── Nursing Discharge Checklist ────────────────────────────────────────────

export interface DischargeChecklistItem {
  id: string
  admissionId: string
  organizationId: string
  itemKey: DischargeChecklistItemKey
  completed: boolean
  completedByUserId: string | null
  completedAt: Date | null
  notes: string | null
  createdAt: Date
}

export const DISCHARGE_CHECKLIST_LABELS: Record<DischargeChecklistItemKey, string> = {
  [DischargeChecklistItemKey.VITALS_STABLE]: 'Vitals stable for discharge',
  [DischargeChecklistItemKey.MEDICATION_RECONCILIATION_DONE]: 'Medication reconciliation completed',
  [DischargeChecklistItemKey.PATIENT_EDUCATION_GIVEN]: 'Patient/family education given',
  [DischargeChecklistItemKey.BELONGINGS_RETURNED]: 'Patient belongings returned',
  [DischargeChecklistItemKey.WOUND_CARE_INSTRUCTIONS_GIVEN]: 'Wound care instructions given (if applicable)',
  [DischargeChecklistItemKey.EQUIPMENT_RETURNED]: 'Hospital equipment returned',
  [DischargeChecklistItemKey.FOLLOWUP_EXPLAINED]: 'Follow-up plan explained to patient',
  [DischargeChecklistItemKey.TRANSPORT_ARRANGED]: 'Transport arranged',
}

export const UpdateDischargeChecklistItemSchema = z.object({
  completed: z.boolean(),
  notes: z.string().max(1000).optional(),
})

export type UpdateDischargeChecklistItemDto = z.infer<typeof UpdateDischargeChecklistItemSchema>

// ─── Discharge Summary ──────────────────────────────────────────────────────

export interface DischargeSummary {
  id: string
  admissionId: string
  organizationId: string
  finalDiagnosis: string
  courseInHospital: string | null
  proceduresPerformed: string | null
  conditionAtDischarge: string | null
  medicationReconciliation: string | null
  followUpInstructions: string | null
  followUpAppointmentAt: Date | null
  followUpDoctorId: string | null
  dischargePrescriptionId: string | null
  preparedByUserId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface DischargeSummaryWithDetails extends DischargeSummary {
  followUpDoctor: { id: string; fullName: string; specialization: string } | null
  dischargePrescription: { id: string; prescriptionNumber: string } | null
}

export const UpsertDischargeSummarySchema = z.object({
  finalDiagnosis: z.string().min(1).max(2000),
  courseInHospital: z.string().max(5000).optional(),
  proceduresPerformed: z.string().max(2000).optional(),
  conditionAtDischarge: z.string().max(1000).optional(),
  medicationReconciliation: z.string().max(3000).optional(),
  followUpInstructions: z.string().max(3000).optional(),
  followUpAppointmentAt: z.coerce.date().optional(),
  followUpDoctorId: z.string().cuid().optional(),
  dischargePrescriptionId: z.string().cuid().optional(),
})

export type UpsertDischargeSummaryDto = z.infer<typeof UpsertDischargeSummarySchema>

// ─── Finalize Discharge ─────────────────────────────────────────────────────

export const CompleteDischargeSchema = z.object({
  dischargeNotes: z.string().max(2000).optional(),
  dischargeCondition: z.string().max(500).optional(),
})

export type CompleteDischargeDto = z.infer<typeof CompleteDischargeSchema>
