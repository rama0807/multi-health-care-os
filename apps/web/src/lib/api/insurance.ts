import type {
  CancelPreAuthorizationDto,
  ClaimDocument,
  CloseClaimDto,
  CreateInsuranceClaimDto,
  CreateInsurancePlanDto,
  CreateInsuranceProviderDto,
  CreatePatientInsuranceDto,
  CreatePreAuthorizationDto,
  DecideClaimDto,
  DecidePreAuthorizationDto,
  InsuranceClaimQuery,
  InsuranceClaimWithDetails,
  InsuranceDashboardStats,
  InsurancePlanQuery,
  InsurancePlanWithProvider,
  InsuranceProvider,
  InsuranceProviderQuery,
  PaginatedResponse,
  PatientInsuranceWithDetails,
  PreAuthorizationQuery,
  PreAuthorizationWithDetails,
  SettleClaimDto,
  UpdateInsurancePlanDto,
  UpdateInsuranceProviderDto,
  UpdatePatientInsuranceDto,
} from '@medicore/types'

import { apiClient } from './client'

// ─── Dashboard ─────────────────────────────────────────────────────────────

export async function getInsuranceDashboardStats(): Promise<InsuranceDashboardStats> {
  const { data } = await apiClient.get<{ data: InsuranceDashboardStats }>('/insurance/dashboard-stats')
  return data.data
}

// ─── Providers ─────────────────────────────────────────────────────────────

export async function listInsuranceProviders(query: InsuranceProviderQuery = {}): Promise<PaginatedResponse<InsuranceProvider>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<InsuranceProvider> }>('/insurance/providers', { params: query })
  return data.data
}

export async function getInsuranceProvider(id: string): Promise<InsuranceProvider> {
  const { data } = await apiClient.get<{ data: InsuranceProvider }>(`/insurance/providers/${id}`)
  return data.data
}

export async function createInsuranceProvider(dto: CreateInsuranceProviderDto): Promise<InsuranceProvider> {
  const { data } = await apiClient.post<{ data: InsuranceProvider }>('/insurance/providers', dto)
  return data.data
}

export async function updateInsuranceProvider(id: string, dto: UpdateInsuranceProviderDto): Promise<InsuranceProvider> {
  const { data } = await apiClient.patch<{ data: InsuranceProvider }>(`/insurance/providers/${id}`, dto)
  return data.data
}

// ─── Plans ─────────────────────────────────────────────────────────────────

export async function listInsurancePlans(query: InsurancePlanQuery = {}): Promise<PaginatedResponse<InsurancePlanWithProvider>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<InsurancePlanWithProvider> }>('/insurance/plans', { params: query })
  return data.data
}

export async function getInsurancePlan(id: string): Promise<InsurancePlanWithProvider> {
  const { data } = await apiClient.get<{ data: InsurancePlanWithProvider }>(`/insurance/plans/${id}`)
  return data.data
}

export async function createInsurancePlan(dto: CreateInsurancePlanDto): Promise<InsurancePlanWithProvider> {
  const { data } = await apiClient.post<{ data: InsurancePlanWithProvider }>('/insurance/plans', dto)
  return data.data
}

export async function updateInsurancePlan(id: string, dto: UpdateInsurancePlanDto): Promise<InsurancePlanWithProvider> {
  const { data } = await apiClient.patch<{ data: InsurancePlanWithProvider }>(`/insurance/plans/${id}`, dto)
  return data.data
}

// ─── Patient Coverage ──────────────────────────────────────────────────────

export async function listPatientCoverages(patientId: string): Promise<PatientInsuranceWithDetails[]> {
  const { data } = await apiClient.get<{ data: PatientInsuranceWithDetails[] }>(`/insurance/patients/${patientId}/coverages`)
  return data.data
}

export async function createPatientCoverage(
  patientId: string,
  dto: CreatePatientInsuranceDto,
): Promise<PatientInsuranceWithDetails> {
  const { data } = await apiClient.post<{ data: PatientInsuranceWithDetails }>(`/insurance/patients/${patientId}/coverages`, dto)
  return data.data
}

export async function updatePatientCoverage(
  patientId: string,
  id: string,
  dto: UpdatePatientInsuranceDto,
): Promise<PatientInsuranceWithDetails> {
  const { data } = await apiClient.patch<{ data: PatientInsuranceWithDetails }>(
    `/insurance/patients/${patientId}/coverages/${id}`,
    dto,
  )
  return data.data
}

// ─── Pre-Authorization ─────────────────────────────────────────────────────

export async function listPreAuthorizations(
  query: PreAuthorizationQuery = {},
): Promise<PaginatedResponse<PreAuthorizationWithDetails>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<PreAuthorizationWithDetails> }>('/insurance/preauth', {
    params: query,
  })
  return data.data
}

export async function getPreAuthorization(id: string): Promise<PreAuthorizationWithDetails> {
  const { data } = await apiClient.get<{ data: PreAuthorizationWithDetails }>(`/insurance/preauth/${id}`)
  return data.data
}

export async function createPreAuthorization(dto: CreatePreAuthorizationDto): Promise<PreAuthorizationWithDetails> {
  const { data } = await apiClient.post<{ data: PreAuthorizationWithDetails }>('/insurance/preauth', dto)
  return data.data
}

export async function submitPreAuthorization(id: string): Promise<PreAuthorizationWithDetails> {
  const { data } = await apiClient.post<{ data: PreAuthorizationWithDetails }>(`/insurance/preauth/${id}/submit`, {})
  return data.data
}

export async function markPreAuthorizationUnderReview(id: string): Promise<PreAuthorizationWithDetails> {
  const { data } = await apiClient.post<{ data: PreAuthorizationWithDetails }>(`/insurance/preauth/${id}/review`, {})
  return data.data
}

export async function decidePreAuthorization(id: string, dto: DecidePreAuthorizationDto): Promise<PreAuthorizationWithDetails> {
  const { data } = await apiClient.post<{ data: PreAuthorizationWithDetails }>(`/insurance/preauth/${id}/decide`, dto)
  return data.data
}

export async function cancelPreAuthorization(id: string, dto: CancelPreAuthorizationDto): Promise<PreAuthorizationWithDetails> {
  const { data } = await apiClient.post<{ data: PreAuthorizationWithDetails }>(`/insurance/preauth/${id}/cancel`, dto)
  return data.data
}

export async function uploadPreAuthAttachment(id: string, file: File): Promise<PreAuthorizationWithDetails> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await apiClient.post<{ data: PreAuthorizationWithDetails }>(`/insurance/preauth/${id}/attachments`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.data
}

// ─── Claims ────────────────────────────────────────────────────────────────

export async function listInsuranceClaims(query: InsuranceClaimQuery = {}): Promise<PaginatedResponse<InsuranceClaimWithDetails>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<InsuranceClaimWithDetails> }>('/insurance/claims', {
    params: query,
  })
  return data.data
}

export async function getInsuranceClaim(id: string): Promise<InsuranceClaimWithDetails> {
  const { data } = await apiClient.get<{ data: InsuranceClaimWithDetails }>(`/insurance/claims/${id}`)
  return data.data
}

export async function createInsuranceClaim(dto: CreateInsuranceClaimDto): Promise<InsuranceClaimWithDetails> {
  const { data } = await apiClient.post<{ data: InsuranceClaimWithDetails }>('/insurance/claims', dto)
  return data.data
}

export async function submitInsuranceClaim(id: string): Promise<InsuranceClaimWithDetails> {
  const { data } = await apiClient.post<{ data: InsuranceClaimWithDetails }>(`/insurance/claims/${id}/submit`, {})
  return data.data
}

export async function markInsuranceClaimUnderReview(id: string): Promise<InsuranceClaimWithDetails> {
  const { data } = await apiClient.post<{ data: InsuranceClaimWithDetails }>(`/insurance/claims/${id}/review`, {})
  return data.data
}

export async function decideInsuranceClaim(id: string, dto: DecideClaimDto): Promise<InsuranceClaimWithDetails> {
  const { data } = await apiClient.post<{ data: InsuranceClaimWithDetails }>(`/insurance/claims/${id}/decide`, dto)
  return data.data
}

export async function settleInsuranceClaim(id: string, dto: SettleClaimDto): Promise<InsuranceClaimWithDetails> {
  const { data } = await apiClient.post<{ data: InsuranceClaimWithDetails }>(`/insurance/claims/${id}/settle`, dto)
  return data.data
}

export async function closeInsuranceClaim(id: string, dto: CloseClaimDto): Promise<InsuranceClaimWithDetails> {
  const { data } = await apiClient.post<{ data: InsuranceClaimWithDetails }>(`/insurance/claims/${id}/close`, dto)
  return data.data
}

export async function uploadClaimDocument(id: string, file: File, type?: string): Promise<ClaimDocument> {
  const form = new FormData()
  form.append('file', file)
  if (type) form.append('type', type)
  const { data } = await apiClient.post<{ data: ClaimDocument }>(`/insurance/claims/${id}/documents`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.data
}
