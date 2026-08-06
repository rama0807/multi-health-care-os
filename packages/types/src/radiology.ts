import { z } from 'zod'

import { Priority, RadiologyAttachmentType, RadiologyStatus } from './enums'

// ─── Catalog ───────────────────────────────────────────────────────────────

/**
 * Org-configurable catalog of orderable radiology studies (Milestone 8,
 * ADR-0013) - mirrors LabTestCatalogItem's role. Unlike lab tests, a
 * radiology order has no per-item structured results, so the catalog exists
 * purely to standardize ordering (name/code/price/duration/contrast) rather
 * than to drive abnormal-value logic.
 */
export interface RadiologyCatalogItem {
  id: string
  organizationId: string
  code: string
  name: string
  category: string
  modality: string
  bodyPart: string
  contrastRequired: boolean
  price: string
  estimatedDurationMinutes: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export const CreateRadiologyCatalogItemSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
  modality: z.string().min(1).max(50),
  bodyPart: z.string().min(1).max(100),
  contrastRequired: z.boolean().default(false),
  price: z.number().nonnegative(),
  estimatedDurationMinutes: z.number().int().positive(),
})

export type CreateRadiologyCatalogItemDto = z.infer<typeof CreateRadiologyCatalogItemSchema>

export const UpdateRadiologyCatalogItemSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  category: z.string().min(1).max(100).optional(),
  modality: z.string().min(1).max(50).optional(),
  bodyPart: z.string().min(1).max(100).optional(),
  contrastRequired: z.boolean().optional(),
  price: z.number().nonnegative().optional(),
  estimatedDurationMinutes: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
})

export type UpdateRadiologyCatalogItemDto = z.infer<typeof UpdateRadiologyCatalogItemSchema>

export interface RadiologyCatalogQuery {
  category?: string
  modality?: string
  isActive?: boolean
  search?: string
}

// ─── Orders ────────────────────────────────────────────────────────────────

export interface RadiologyOrder {
  id: string
  orderNumber: string
  patientId: string
  doctorId: string
  encounterId: string | null
  catalogItemId: string | null
  organizationId: string
  modality: string
  bodyPart: string
  clinicalIndication: string | null
  status: RadiologyStatus
  priority: Priority
  scheduledAt: Date | null
  room: string | null
  machine: string | null
  technicianUserId: string | null
  radiologistDoctorId: string | null
  durationMinutes: number | null
  technique: string | null
  findings: string | null
  impression: string | null
  recommendations: string | null
  reportFileUrl: string | null
  reportedBy: string | null
  reportedAt: Date | null
  verifiedByUserId: string | null
  verifiedAt: Date | null
  releasedByUserId: string | null
  releasedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface RadiologyOrderWithDetails extends RadiologyOrder {
  patient: { id: string; fullName: string; uhid: string }
  doctor: { id: string; fullName: string; specialization: string }
  radiologist: { id: string; fullName: string; specialization: string } | null
  reports: RadiologyReport[]
  attachments: RadiologyAttachment[]
}

export const CreateRadiologyOrderSchema = z
  .object({
    encounterId: z.string().cuid(),
    catalogItemId: z.string().cuid().optional(),
    modality: z.string().max(50).optional(),
    bodyPart: z.string().max(100).optional(),
    clinicalIndication: z.string().max(2000).optional(),
    priority: z.nativeEnum(Priority).default(Priority.ROUTINE),
  })
  .refine((v) => Boolean(v.catalogItemId) || (Boolean(v.modality) && Boolean(v.bodyPart)), {
    message: 'Provide either a catalogItemId or an ad-hoc modality + bodyPart',
    path: ['modality'],
  })

export type CreateRadiologyOrderDto = z.infer<typeof CreateRadiologyOrderSchema>

export const UpdateRadiologyOrderSchema = z.object({
  clinicalIndication: z.string().max(2000).optional(),
  priority: z.nativeEnum(Priority).optional(),
})

export type UpdateRadiologyOrderDto = z.infer<typeof UpdateRadiologyOrderSchema>

export const ScheduleRadiologyOrderSchema = z.object({
  scheduledAt: z.coerce.date(),
  room: z.string().max(50).optional(),
  machine: z.string().max(100).optional(),
  technicianUserId: z.string().cuid().optional(),
  radiologistDoctorId: z.string().cuid().optional(),
  durationMinutes: z.number().int().positive().optional(),
})

export type ScheduleRadiologyOrderDto = z.infer<typeof ScheduleRadiologyOrderSchema>

export const UpdateRadiologyStatusSchema = z.object({
  status: z.nativeEnum(RadiologyStatus),
  reason: z.string().max(500).optional(),
})

export type UpdateRadiologyStatusDto = z.infer<typeof UpdateRadiologyStatusSchema>

export interface RadiologyOrderQuery {
  patientId?: string
  doctorId?: string
  encounterId?: string
  status?: RadiologyStatus
  priority?: Priority
  modality?: string
  page?: number
  limit?: number
  sortBy?: 'scheduledAt' | 'createdAt' | 'priority'
  sortOrder?: 'asc' | 'desc'
}

// ─── Reports ───────────────────────────────────────────────────────────────

/**
 * Append-only, versioned report content - mirrors ClinicalNote's "never
 * overwrite" pattern. `RadiologyOrder` denormalizes the latest version's
 * content directly onto itself for cheap list/queue reads.
 */
export interface RadiologyReport {
  id: string
  radiologyOrderId: string
  version: number
  clinicalIndication: string | null
  technique: string | null
  findings: string | null
  impression: string | null
  recommendations: string | null
  createdByUserId: string | null
  createdAt: Date
}

export const CreateRadiologyReportSchema = z.object({
  clinicalIndication: z.string().max(2000).optional(),
  technique: z.string().max(2000).optional(),
  findings: z.string().max(5000).optional(),
  impression: z.string().max(2000).optional(),
  recommendations: z.string().max(2000).optional(),
})

export type CreateRadiologyReportDto = z.infer<typeof CreateRadiologyReportSchema>

// ─── Attachments ───────────────────────────────────────────────────────────

export interface RadiologyAttachment {
  id: string
  radiologyOrderId: string
  organizationId: string
  type: RadiologyAttachmentType
  fileName: string | null
  fileUrl: string | null
  mimeType: string | null
  fileSizeBytes: number | null
  metadata: Record<string, unknown> | null
  uploadedByUserId: string | null
  uploadedAt: Date
}

/**
 * `EXTERNAL_IMAGING`/`DICOM_PLACEHOLDER` attachments are metadata-only (no
 * real file) - e.g. an accession number or study instance UID referencing an
 * outside PACS. `IMAGE`/`PDF` require an actual uploaded file, validated
 * separately by the controller/service (multipart upload, not this schema).
 */
export const CreateExternalRadiologyAttachmentSchema = z.object({
  type: z.enum([RadiologyAttachmentType.EXTERNAL_IMAGING, RadiologyAttachmentType.DICOM_PLACEHOLDER]),
  metadata: z
    .object({
      externalUrl: z.string().url().optional(),
      accessionNumber: z.string().max(100).optional(),
      studyInstanceUid: z.string().max(200).optional(),
      notes: z.string().max(500).optional(),
    })
    .refine((v) => Boolean(v.externalUrl) || Boolean(v.accessionNumber) || Boolean(v.studyInstanceUid), {
      message: 'Provide at least an external URL, accession number, or study instance UID',
    }),
})

export type CreateExternalRadiologyAttachmentDto = z.infer<typeof CreateExternalRadiologyAttachmentSchema>
