import type {
  CreateExternalRadiologyAttachmentDto,
  CreateRadiologyCatalogItemDto,
  CreateRadiologyOrderDto,
  CreateRadiologyReportDto,
  PaginatedResponse,
  RadiologyAttachment,
  RadiologyCatalogItem,
  RadiologyCatalogQuery,
  RadiologyOrder,
  RadiologyOrderQuery,
  RadiologyOrderWithDetails,
  ScheduleRadiologyOrderDto,
  UpdateRadiologyCatalogItemDto,
  UpdateRadiologyOrderDto,
  UpdateRadiologyStatusDto,
} from '@medicore/types'

import { apiClient } from './client'

export interface RadiologyDashboardStats {
  todaysStudies: number
  pendingReporting: number
  completedStudies: number
  cancelled: number
  urgent: number
}

// ─── Catalog ───────────────────────────────────────────────────────────────

export async function listRadiologyCatalog(query: RadiologyCatalogQuery = {}): Promise<RadiologyCatalogItem[]> {
  const { data } = await apiClient.get<{ data: RadiologyCatalogItem[] }>('/radiology/catalog', { params: query })
  return data.data
}

export async function createRadiologyCatalogItem(dto: CreateRadiologyCatalogItemDto): Promise<RadiologyCatalogItem> {
  const { data } = await apiClient.post<{ data: RadiologyCatalogItem }>('/radiology/catalog', dto)
  return data.data
}

export async function updateRadiologyCatalogItem(
  id: string,
  dto: UpdateRadiologyCatalogItemDto,
): Promise<RadiologyCatalogItem> {
  const { data } = await apiClient.patch<{ data: RadiologyCatalogItem }>(`/radiology/catalog/${id}`, dto)
  return data.data
}

// ─── Orders ────────────────────────────────────────────────────────────────

export async function listRadiologyOrders(
  query: RadiologyOrderQuery,
): Promise<PaginatedResponse<RadiologyOrderWithDetails>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<RadiologyOrderWithDetails> }>('/radiology', {
    params: query,
  })
  return data.data
}

export async function getRadiologyDashboardStats(): Promise<RadiologyDashboardStats> {
  const { data } = await apiClient.get<{ data: RadiologyDashboardStats }>('/radiology/dashboard-stats')
  return data.data
}

export async function getRadiologyOrder(id: string): Promise<RadiologyOrderWithDetails> {
  const { data } = await apiClient.get<{ data: RadiologyOrderWithDetails }>(`/radiology/${id}`)
  return data.data
}

export async function createRadiologyOrder(dto: CreateRadiologyOrderDto): Promise<RadiologyOrder> {
  const { data } = await apiClient.post<{ data: RadiologyOrder }>('/radiology', dto)
  return data.data
}

export async function updateRadiologyOrder(id: string, dto: UpdateRadiologyOrderDto): Promise<RadiologyOrder> {
  const { data } = await apiClient.patch<{ data: RadiologyOrder }>(`/radiology/${id}`, dto)
  return data.data
}

export async function scheduleRadiologyOrder(id: string, dto: ScheduleRadiologyOrderDto): Promise<RadiologyOrder> {
  const { data } = await apiClient.post<{ data: RadiologyOrder }>(`/radiology/${id}/schedule`, dto)
  return data.data
}

export async function startRadiologyStudy(id: string): Promise<RadiologyOrder> {
  const { data } = await apiClient.post<{ data: RadiologyOrder }>(`/radiology/${id}/start`, {})
  return data.data
}

export async function completeRadiologyStudy(id: string): Promise<RadiologyOrder> {
  const { data } = await apiClient.post<{ data: RadiologyOrder }>(`/radiology/${id}/complete`, {})
  return data.data
}

export async function addRadiologyReportVersion(
  id: string,
  dto: CreateRadiologyReportDto,
): Promise<RadiologyOrderWithDetails> {
  const { data } = await apiClient.post<{ data: RadiologyOrderWithDetails }>(`/radiology/${id}/reports`, dto)
  return data.data
}

export async function verifyRadiologyReport(id: string): Promise<RadiologyOrder> {
  const { data } = await apiClient.post<{ data: RadiologyOrder }>(`/radiology/${id}/reports/verify`, {})
  return data.data
}

export async function releaseRadiologyReport(id: string): Promise<RadiologyOrder> {
  const { data } = await apiClient.post<{ data: RadiologyOrder }>(`/radiology/${id}/reports/release`, {})
  return data.data
}

export async function updateRadiologyStatus(id: string, dto: UpdateRadiologyStatusDto): Promise<RadiologyOrder> {
  const { data } = await apiClient.patch<{ data: RadiologyOrder }>(`/radiology/${id}/status`, dto)
  return data.data
}

export async function uploadRadiologyReportFile(id: string, file: File): Promise<RadiologyOrder> {
  const form = new FormData()
  form.append('file', file)

  // Let the browser set its own multipart boundary - an explicit
  // Content-Type here would ship without one and the server couldn't parse
  // the body.
  const { data } = await apiClient.post<{ data: RadiologyOrder }>(`/radiology/${id}/report-file`, form, {
    headers: { 'Content-Type': undefined },
  })
  return data.data
}

export async function downloadRadiologyReportPdf(id: string, orderNumber: string): Promise<void> {
  const response = await apiClient.get(`/radiology/${id}/report/pdf`, { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.download = `${orderNumber}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

// ─── Attachments ───────────────────────────────────────────────────────────

export async function listRadiologyAttachments(id: string): Promise<RadiologyAttachment[]> {
  const { data } = await apiClient.get<{ data: RadiologyAttachment[] }>(`/radiology/${id}/attachments`)
  return data.data
}

export async function uploadRadiologyFileAttachment(
  id: string,
  type: 'IMAGE' | 'PDF',
  file: File,
): Promise<RadiologyAttachment> {
  const form = new FormData()
  form.append('file', file)

  const { data } = await apiClient.post<{ data: RadiologyAttachment }>(
    `/radiology/${id}/attachments/file?type=${type}`,
    form,
    { headers: { 'Content-Type': undefined } },
  )
  return data.data
}

export async function addExternalRadiologyAttachment(
  id: string,
  dto: CreateExternalRadiologyAttachmentDto,
): Promise<RadiologyAttachment> {
  const { data } = await apiClient.post<{ data: RadiologyAttachment }>(`/radiology/${id}/attachments/external`, dto)
  return data.data
}

export async function deleteRadiologyAttachment(id: string, attachmentId: string): Promise<void> {
  await apiClient.delete(`/radiology/${id}/attachments/${attachmentId}`)
}
