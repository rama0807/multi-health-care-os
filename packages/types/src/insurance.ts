import { z } from 'zod'

import {
  ClaimDocumentType,
  ClaimPaymentStatus,
  InsuranceClaimStatus,
  InsuranceNetworkType,
  InsuranceProviderType,
  PatientInsuranceStatus,
  PatientInsuranceType,
  PreAuthorizationStatus,
} from './enums'

// ─── Insurance Providers (Insurance Company / TPA / Corporate) ────────────

export interface InsuranceProvider {
  id: string
  organizationId: string
  name: string
  code: string
  type: InsuranceProviderType
  contactPerson: string | null
  email: string | null
  phone: string | null
  address: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export const CreateInsuranceProviderSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50),
  type: z.nativeEnum(InsuranceProviderType).default(InsuranceProviderType.INSURANCE_COMPANY),
  contactPerson: z.string().max(200).optional(),
  email: z.string().email().max(200).optional(),
  phone: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
})

export type CreateInsuranceProviderDto = z.infer<typeof CreateInsuranceProviderSchema>

export const UpdateInsuranceProviderSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  code: z.string().min(1).max(50).optional(),
  type: z.nativeEnum(InsuranceProviderType).optional(),
  contactPerson: z.string().max(200).optional(),
  email: z.string().email().max(200).optional(),
  phone: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
})

export type UpdateInsuranceProviderDto = z.infer<typeof UpdateInsuranceProviderSchema>

export interface InsuranceProviderQuery {
  search?: string
  type?: InsuranceProviderType
  isActive?: boolean
  page?: number
  limit?: number
}

// ─── Insurance Plans ───────────────────────────────────────────────────────

export interface InsurancePlan {
  id: string
  organizationId: string
  providerId: string
  name: string
  code: string
  coveragePercent: string
  coPayPercent: string
  deductible: string
  annualLimit: string | null
  perVisitLimit: string | null
  networkType: InsuranceNetworkType
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface InsurancePlanWithProvider extends InsurancePlan {
  provider: { id: string; name: string; code: string }
}

export const CreateInsurancePlanSchema = z.object({
  providerId: z.string().cuid(),
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50),
  coveragePercent: z.number().min(0).max(100).default(100),
  coPayPercent: z.number().min(0).max(100).default(0),
  deductible: z.number().min(0).default(0),
  annualLimit: z.number().min(0).optional(),
  perVisitLimit: z.number().min(0).optional(),
  networkType: z.nativeEnum(InsuranceNetworkType).default(InsuranceNetworkType.CASHLESS),
})

export type CreateInsurancePlanDto = z.infer<typeof CreateInsurancePlanSchema>

export const UpdateInsurancePlanSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  code: z.string().min(1).max(50).optional(),
  coveragePercent: z.number().min(0).max(100).optional(),
  coPayPercent: z.number().min(0).max(100).optional(),
  deductible: z.number().min(0).optional(),
  annualLimit: z.number().min(0).optional(),
  perVisitLimit: z.number().min(0).optional(),
  networkType: z.nativeEnum(InsuranceNetworkType).optional(),
  isActive: z.boolean().optional(),
})

export type UpdateInsurancePlanDto = z.infer<typeof UpdateInsurancePlanSchema>

export interface InsurancePlanQuery {
  providerId?: string
  networkType?: InsuranceNetworkType
  isActive?: boolean
  page?: number
  limit?: number
}

// ─── Patient Coverage ──────────────────────────────────────────────────────

export interface PatientInsurance {
  id: string
  organizationId: string
  patientId: string
  providerId: string
  planId: string
  type: PatientInsuranceType
  memberId: string
  policyNumber: string
  effectiveDate: Date
  expiryDate: Date | null
  coveragePercent: string | null
  status: PatientInsuranceStatus
  createdAt: Date
  updatedAt: Date
}

export interface PatientInsuranceWithDetails extends PatientInsurance {
  provider: { id: string; name: string; code: string }
  plan: { id: string; name: string; code: string; coveragePercent: string; coPayPercent: string }
}

export const CreatePatientInsuranceSchema = z.object({
  providerId: z.string().cuid(),
  planId: z.string().cuid(),
  type: z.nativeEnum(PatientInsuranceType).default(PatientInsuranceType.PRIMARY),
  memberId: z.string().min(1).max(100),
  policyNumber: z.string().min(1).max(100),
  effectiveDate: z.coerce.date(),
  expiryDate: z.coerce.date().optional(),
  coveragePercent: z.number().min(0).max(100).optional(),
})

export type CreatePatientInsuranceDto = z.infer<typeof CreatePatientInsuranceSchema>

export const UpdatePatientInsuranceSchema = z.object({
  memberId: z.string().min(1).max(100).optional(),
  policyNumber: z.string().min(1).max(100).optional(),
  effectiveDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
  coveragePercent: z.number().min(0).max(100).optional(),
  status: z.nativeEnum(PatientInsuranceStatus).optional(),
})

export type UpdatePatientInsuranceDto = z.infer<typeof UpdatePatientInsuranceSchema>

export interface PatientInsuranceQuery {
  patientId?: string
  status?: PatientInsuranceStatus
  page?: number
  limit?: number
}

// ─── Pre-Authorization ─────────────────────────────────────────────────────

export interface PreAuthAttachment {
  id: string
  preAuthorizationId: string
  fileName: string
  fileUrl: string
  mimeType: string
  size: number
  uploadedByUserId: string
  createdAt: Date
}

export interface PreAuthorization {
  id: string
  authNumber: string
  organizationId: string
  patientId: string
  encounterId: string
  patientInsuranceId: string
  status: PreAuthorizationStatus
  clinicalNotes: string | null
  doctorNotes: string | null
  requestedAmount: string
  approvedAmount: string | null
  rejectionReason: string | null
  submittedAt: Date | null
  decidedAt: Date | null
  decidedByUserId: string | null
  createdByUserId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface PreAuthorizationWithDetails extends PreAuthorization {
  patient: { id: string; fullName: string; uhid: string }
  patientInsurance: {
    id: string
    memberId: string
    policyNumber: string
    provider: { id: string; name: string }
  }
  attachments: PreAuthAttachment[]
}

export const CreatePreAuthorizationSchema = z.object({
  encounterId: z.string().cuid(),
  patientInsuranceId: z.string().cuid(),
  requestedAmount: z.number().positive(),
  clinicalNotes: z.string().max(2000).optional(),
  doctorNotes: z.string().max(2000).optional(),
})

export type CreatePreAuthorizationDto = z.infer<typeof CreatePreAuthorizationSchema>

export const DecidePreAuthorizationSchema = z.object({
  status: z.enum(['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED']),
  approvedAmount: z.number().nonnegative().optional(),
  rejectionReason: z.string().max(1000).optional(),
})

export type DecidePreAuthorizationDto = z.infer<typeof DecidePreAuthorizationSchema>

export const CancelPreAuthorizationSchema = z.object({
  reason: z.string().max(500).optional(),
})

export type CancelPreAuthorizationDto = z.infer<typeof CancelPreAuthorizationSchema>

export interface PreAuthorizationQuery {
  patientId?: string
  encounterId?: string
  status?: PreAuthorizationStatus
  page?: number
  limit?: number
}

// ─── Claims ────────────────────────────────────────────────────────────────

export interface ClaimDocument {
  id: string
  claimId: string
  organizationId: string
  type: ClaimDocumentType
  fileName: string
  fileUrl: string
  autoAttached: boolean
  uploadedByUserId: string | null
  createdAt: Date
}

export interface InsuranceClaim {
  id: string
  claimNumber: string
  patientId: string
  invoiceId: string
  encounterId: string
  organizationId: string
  providerId: string | null
  planId: string | null
  patientInsuranceId: string | null
  preAuthorizationId: string | null
  insuranceProvider: string
  policyNumber: string
  membershipId: string | null
  claimedAmount: string
  approvedAmount: string | null
  rejectedAmount: string | null
  insuranceShare: string | null
  patientShare: string | null
  adjustmentAmount: string
  writeOffAmount: string
  outstandingAmount: string | null
  paymentStatus: ClaimPaymentStatus
  status: InsuranceClaimStatus
  rejectionReason: string | null
  submittedAt: Date | null
  settledAt: Date | null
  closedAt: Date | null
  createdByUserId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface InsuranceClaimWithDetails extends InsuranceClaim {
  patient: { id: string; fullName: string; uhid: string }
  invoice: { id: string; invoiceNumber: string; totalAmount: string; balanceDue: string }
  documents: ClaimDocument[]
}

/**
 * "Every claim must reference Patient, Encounter, Invoice, Insurance" — the
 * patient is derived from the invoice/encounter (both already belong to one
 * patient), not passed separately.
 */
export const CreateInsuranceClaimSchema = z.object({
  encounterId: z.string().cuid(),
  invoiceId: z.string().cuid(),
  patientInsuranceId: z.string().cuid(),
  preAuthorizationId: z.string().cuid().optional(),
  claimedAmount: z.number().positive(),
})

export type CreateInsuranceClaimDto = z.infer<typeof CreateInsuranceClaimSchema>

export const DecideClaimSchema = z.object({
  status: z.enum(['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED']),
  approvedAmount: z.number().nonnegative().optional(),
  rejectionReason: z.string().max(1000).optional(),
})

export type DecideClaimDto = z.infer<typeof DecideClaimSchema>

export const SettleClaimSchema = z.object({
  insuranceShare: z.number().nonnegative(),
  patientShare: z.number().nonnegative().default(0),
  adjustmentAmount: z.number().nonnegative().default(0),
  writeOffAmount: z.number().nonnegative().default(0),
})

export type SettleClaimDto = z.infer<typeof SettleClaimSchema>

export const CloseClaimSchema = z.object({
  reason: z.string().max(500).optional(),
})

export type CloseClaimDto = z.infer<typeof CloseClaimSchema>

export const UploadClaimDocumentMetaSchema = z.object({
  type: z.nativeEnum(ClaimDocumentType).default(ClaimDocumentType.MANUAL_UPLOAD),
})

export type UploadClaimDocumentMetaDto = z.infer<typeof UploadClaimDocumentMetaSchema>

export interface InsuranceClaimQuery {
  patientId?: string
  encounterId?: string
  status?: InsuranceClaimStatus
  page?: number
  limit?: number
  sortBy?: 'createdAt' | 'claimedAmount' | 'settledAt'
  sortOrder?: 'asc' | 'desc'
}

// ─── Dashboard ─────────────────────────────────────────────────────────────

export interface InsuranceDashboardStats {
  todaysClaims: number
  pendingApproval: number
  rejectedClaims: number
  settledClaims: number
  insuranceRevenue: string
  outstandingClaims: string
}
