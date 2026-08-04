import type {
  AdmissionWithDetails,
  ApproveDischargeDto,
  CompleteDischargeDto,
  DischargeChecklistItem,
  DischargeChecklistItemKey,
  DischargeSummaryWithDetails,
  UpdateDischargeChecklistItemDto,
  UpsertDischargeSummaryDto,
} from '@medicore/types'

import { apiClient } from './client'

export async function approveDischarge(admissionId: string, dto: ApproveDischargeDto): Promise<AdmissionWithDetails> {
  const { data } = await apiClient.post<{ data: AdmissionWithDetails }>(`/ipd/admissions/${admissionId}/discharge/approve`, dto)
  return data.data
}

export async function listDischargeChecklist(admissionId: string): Promise<DischargeChecklistItem[]> {
  const { data } = await apiClient.get<{ data: DischargeChecklistItem[] }>(
    `/ipd/admissions/${admissionId}/discharge/checklist`,
  )
  return data.data
}

export async function updateDischargeChecklistItem(
  admissionId: string,
  itemKey: DischargeChecklistItemKey,
  dto: UpdateDischargeChecklistItemDto,
): Promise<DischargeChecklistItem> {
  const { data } = await apiClient.patch<{ data: DischargeChecklistItem }>(
    `/ipd/admissions/${admissionId}/discharge/checklist/${itemKey}`,
    dto,
  )
  return data.data
}

export async function getDischargeSummary(admissionId: string): Promise<DischargeSummaryWithDetails | null> {
  const { data } = await apiClient.get<{ data: DischargeSummaryWithDetails | null }>(
    `/ipd/admissions/${admissionId}/discharge/summary`,
  )
  return data.data
}

export async function upsertDischargeSummary(
  admissionId: string,
  dto: UpsertDischargeSummaryDto,
): Promise<DischargeSummaryWithDetails> {
  const { data } = await apiClient.put<{ data: DischargeSummaryWithDetails }>(
    `/ipd/admissions/${admissionId}/discharge/summary`,
    dto,
  )
  return data.data
}

export async function downloadDischargeSummaryPdf(admissionId: string, admissionNumber: string): Promise<void> {
  const response = await apiClient.get(`/ipd/admissions/${admissionId}/discharge/summary/pdf`, { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.download = `${admissionNumber}-discharge-summary.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export async function completeDischarge(admissionId: string, dto: CompleteDischargeDto): Promise<AdmissionWithDetails> {
  const { data } = await apiClient.post<{ data: AdmissionWithDetails }>(`/ipd/admissions/${admissionId}/discharge/complete`, dto)
  return data.data
}
