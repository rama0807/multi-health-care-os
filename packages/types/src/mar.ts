import { z } from 'zod'

import { MedicationAdministrationStatus, MedicationAdministrationType } from './enums'

// ─── Medication Administration Record (MAR) ────────────────────────────────

export interface MedicationAdministration {
  id: string
  admissionId: string
  prescriptionItemId: string
  organizationId: string
  type: MedicationAdministrationType
  scheduledAt: Date
  administeredAt: Date | null
  status: MedicationAdministrationStatus
  doseGiven: string | null
  route: string | null
  notes: string | null
  barcodeVerified: boolean
  scannedCode: string | null
  administeredByUserId: string | null
  nurseSignature: string | null
  createdByUserId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface MedicationAdministrationWithDetails extends MedicationAdministration {
  prescriptionItem: {
    id: string
    medicationName: string
    dosage: string
    route: string
    frequency: string
  }
}

export const GenerateScheduledDosesSchema = z.object({
  prescriptionItemId: z.string().cuid(),
  /** Local times of day, e.g. ["08:00", "14:00", "20:00"] - one scheduled row per time per day for `days`. */
  times: z.array(z.string().regex(/^\d{2}:\d{2}$/)).min(1),
  days: z.number().int().min(1).max(30).default(1),
  route: z.string().max(100).optional(),
  startDate: z.coerce.date().optional(),
})

export type GenerateScheduledDosesDto = z.infer<typeof GenerateScheduledDosesSchema>

export const CreateAdHocDoseSchema = z.object({
  prescriptionItemId: z.string().cuid(),
  type: z.nativeEnum(MedicationAdministrationType).refine((t) => t !== MedicationAdministrationType.SCHEDULED, {
    message: 'Ad hoc doses must be PRN or STAT',
  }),
  scheduledAt: z.coerce.date().optional(),
  route: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
})

export type CreateAdHocDoseDto = z.infer<typeof CreateAdHocDoseSchema>

export const AdministerDoseSchema = z.object({
  doseGiven: z.string().max(200).optional(),
  route: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
  barcodeVerified: z.boolean().default(false),
  scannedCode: z.string().max(200).optional(),
  nurseSignature: z.string().min(1).max(200),
})

export type AdministerDoseDto = z.infer<typeof AdministerDoseSchema>

export const RecordDoseExceptionSchema = z.object({
  notes: z.string().min(1).max(1000),
  nurseSignature: z.string().min(1).max(200),
})

export type RecordDoseExceptionDto = z.infer<typeof RecordDoseExceptionSchema>

export interface MedicationAdministrationQuery {
  prescriptionItemId?: string
  type?: MedicationAdministrationType
  status?: MedicationAdministrationStatus
  page?: number
  limit?: number
}
