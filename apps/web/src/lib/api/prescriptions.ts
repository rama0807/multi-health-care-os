import type {
  CreatePrescriptionDto,
  DrugInteractionWarning,
  PaginatedResponse,
  Prescription,
  PrescriptionQuery,
  PrescriptionWithItems,
  UpdatePrescriptionStatusDto,
} from '@medicore/types'

import { apiClient } from './client'

export async function listPrescriptions(
  query: PrescriptionQuery,
): Promise<PaginatedResponse<PrescriptionWithItems>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<PrescriptionWithItems> }>('/prescriptions', {
    params: query,
  })
  return data.data
}

export async function getPrescription(id: string): Promise<PrescriptionWithItems> {
  const { data } = await apiClient.get<{ data: PrescriptionWithItems }>(`/prescriptions/${id}`)
  return data.data
}

export async function createPrescription(
  dto: CreatePrescriptionDto,
): Promise<{ prescription: Prescription; warnings: DrugInteractionWarning[] }> {
  const { data } = await apiClient.post<{ data: { prescription: Prescription; warnings: DrugInteractionWarning[] } }>(
    '/prescriptions',
    dto,
  )
  return data.data
}

export async function updatePrescriptionStatus(id: string, dto: UpdatePrescriptionStatusDto): Promise<Prescription> {
  const { data } = await apiClient.patch<{ data: Prescription }>(`/prescriptions/${id}/status`, dto)
  return data.data
}

export async function downloadPrescriptionPdf(id: string, prescriptionNumber: string): Promise<void> {
  const response = await apiClient.get(`/prescriptions/${id}/pdf`, { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.download = `${prescriptionNumber}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
