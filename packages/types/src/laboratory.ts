import { z } from 'zod'

import { AbnormalType, LabTestStatus, Priority } from './enums'

// ─── Catalog ───────────────────────────────────────────────────────────────

/**
 * Org-configurable catalog of orderable lab tests - see ADR-0012. A catalog
 * item may define a numeric reference range (`referenceRangeLow`/`High`,
 * used for automatic abnormal-value flagging), a free-text range (for
 * qualitative tests such as "Negative"/"Non-reactive"), or both.
 */
export interface LabTestCatalogItem {
  id: string
  organizationId: string
  testCode: string
  testName: string
  category: string
  unit: string | null
  referenceRangeLow: number | null
  referenceRangeHigh: number | null
  referenceRangeText: string | null
  criticalLow: number | null
  criticalHigh: number | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export const CreateLabCatalogItemSchema = z
  .object({
    testCode: z.string().min(1).max(50),
    testName: z.string().min(1).max(200),
    category: z.string().min(1).max(100),
    unit: z.string().max(50).optional(),
    referenceRangeLow: z.number().optional(),
    referenceRangeHigh: z.number().optional(),
    referenceRangeText: z.string().max(200).optional(),
    criticalLow: z.number().optional(),
    criticalHigh: z.number().optional(),
  })
  .refine(
    (v) => v.referenceRangeLow !== undefined || v.referenceRangeHigh !== undefined || Boolean(v.referenceRangeText),
    { message: 'Provide a numeric reference range (low/high) and/or a text reference range' },
  )

export type CreateLabCatalogItemDto = z.infer<typeof CreateLabCatalogItemSchema>

export const UpdateLabCatalogItemSchema = z.object({
  testName: z.string().min(1).max(200).optional(),
  category: z.string().min(1).max(100).optional(),
  unit: z.string().max(50).optional(),
  referenceRangeLow: z.number().nullable().optional(),
  referenceRangeHigh: z.number().nullable().optional(),
  referenceRangeText: z.string().max(200).nullable().optional(),
  criticalLow: z.number().nullable().optional(),
  criticalHigh: z.number().nullable().optional(),
  isActive: z.boolean().optional(),
})

export type UpdateLabCatalogItemDto = z.infer<typeof UpdateLabCatalogItemSchema>

export interface LabTestCatalogQuery {
  category?: string
  isActive?: boolean
  search?: string
}

// ─── Lab orders ────────────────────────────────────────────────────────────

export interface LabTestItem {
  id: string
  labTestId: string
  catalogItemId: string | null
  testName: string
  testCode: string
  category: string
  result: string | null
  unit: string | null
  referenceRange: string | null
  referenceRangeLow: number | null
  referenceRangeHigh: number | null
  criticalLow: number | null
  criticalHigh: number | null
  isAbnormal: boolean
  abnormalType: AbnormalType | null
  interpretation: string | null
  createdAt: Date
}

export interface LabTest {
  id: string
  labOrderNumber: string
  patientId: string
  doctorId: string
  appointmentId: string | null
  encounterId: string | null
  organizationId: string
  status: LabTestStatus
  priority: Priority
  sampleCollectedBy: string | null
  sampleCollectedAt: Date | null
  reportedAt: Date | null
  reportFileUrl: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export interface LabTestWithItems extends LabTest {
  items: LabTestItem[]
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

export const CreateLabOrderItemSchema = z
  .object({
    catalogItemId: z.string().cuid().optional(),
    testName: z.string().min(1).max(200).optional(),
    testCode: z.string().max(50).optional(),
    category: z.string().max(100).optional(),
    unit: z.string().max(50).optional(),
    referenceRange: z.string().max(200).optional(),
    referenceRangeLow: z.number().optional(),
    referenceRangeHigh: z.number().optional(),
    criticalLow: z.number().optional(),
    criticalHigh: z.number().optional(),
  })
  .refine((v) => Boolean(v.catalogItemId) || Boolean(v.testName), {
    message: 'Provide either a catalogItemId or an ad-hoc testName',
    path: ['testName'],
  })

export type CreateLabOrderItemDto = z.infer<typeof CreateLabOrderItemSchema>

export const CreateLabOrderSchema = z.object({
  encounterId: z.string().cuid(),
  priority: z.nativeEnum(Priority).default(Priority.ROUTINE),
  notes: z.string().max(2000).optional(),
  items: z.array(CreateLabOrderItemSchema).min(1, 'At least one test is required'),
})

export type CreateLabOrderDto = z.infer<typeof CreateLabOrderSchema>

export const RecordSampleCollectionSchema = z.object({
  notes: z.string().max(500).optional(),
})

export type RecordSampleCollectionDto = z.infer<typeof RecordSampleCollectionSchema>

export const EnterLabResultItemSchema = z.object({
  itemId: z.string().cuid(),
  result: z.string().min(1).max(500),
  /**
   * Only honored for a non-numeric ("qualitative") result - a numeric
   * result is always auto-flagged server-side and this is ignored for it.
   * See `abnormal-flagging.ts`.
   */
  isAbnormalOverride: z.boolean().optional(),
  interpretation: z.string().max(500).optional(),
})

export const EnterLabResultsSchema = z.object({
  items: z.array(EnterLabResultItemSchema).min(1, 'At least one result is required'),
})

export type EnterLabResultsDto = z.infer<typeof EnterLabResultsSchema>

export const UpdateLabTestStatusSchema = z.object({
  status: z.nativeEnum(LabTestStatus),
})

export type UpdateLabTestStatusDto = z.infer<typeof UpdateLabTestStatusSchema>

export interface LabTestQuery {
  patientId?: string
  doctorId?: string
  encounterId?: string
  status?: LabTestStatus
  priority?: Priority
  page?: number
  limit?: number
}
