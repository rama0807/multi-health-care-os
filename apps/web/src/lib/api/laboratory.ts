import type {
  CreateLabCatalogItemDto,
  CreateLabOrderDto,
  EnterLabResultsDto,
  LabTest,
  LabTestCatalogItem,
  LabTestCatalogQuery,
  LabTestQuery,
  LabTestWithItems,
  PaginatedResponse,
  RecordSampleCollectionDto,
  UpdateLabCatalogItemDto,
  UpdateLabTestStatusDto,
} from '@medicore/types'

import { apiClient } from './client'

export async function listLabCatalog(query: LabTestCatalogQuery = {}): Promise<LabTestCatalogItem[]> {
  const { data } = await apiClient.get<{ data: LabTestCatalogItem[] }>('/laboratory/catalog', { params: query })
  return data.data
}

export async function createLabCatalogItem(dto: CreateLabCatalogItemDto): Promise<LabTestCatalogItem> {
  const { data } = await apiClient.post<{ data: LabTestCatalogItem }>('/laboratory/catalog', dto)
  return data.data
}

export async function updateLabCatalogItem(id: string, dto: UpdateLabCatalogItemDto): Promise<LabTestCatalogItem> {
  const { data } = await apiClient.patch<{ data: LabTestCatalogItem }>(`/laboratory/catalog/${id}`, dto)
  return data.data
}

export async function listLabOrders(query: LabTestQuery): Promise<PaginatedResponse<LabTestWithItems>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<LabTestWithItems> }>('/laboratory', { params: query })
  return data.data
}

export async function getLabOrder(id: string): Promise<LabTestWithItems> {
  const { data } = await apiClient.get<{ data: LabTestWithItems }>(`/laboratory/${id}`)
  return data.data
}

export async function createLabOrder(dto: CreateLabOrderDto): Promise<LabTest> {
  const { data } = await apiClient.post<{ data: LabTest }>('/laboratory', dto)
  return data.data
}

export async function collectLabSample(id: string, dto: RecordSampleCollectionDto = {}): Promise<LabTest> {
  const { data } = await apiClient.post<{ data: LabTest }>(`/laboratory/${id}/collect-sample`, dto)
  return data.data
}

export async function enterLabResults(id: string, dto: EnterLabResultsDto): Promise<LabTestWithItems> {
  const { data } = await apiClient.post<{ data: LabTestWithItems }>(`/laboratory/${id}/results`, dto)
  return data.data
}

export async function updateLabTestStatus(id: string, dto: UpdateLabTestStatusDto): Promise<LabTest> {
  const { data } = await apiClient.patch<{ data: LabTest }>(`/laboratory/${id}/status`, dto)
  return data.data
}

export async function uploadLabReportFile(id: string, file: File): Promise<LabTest> {
  const form = new FormData()
  form.append('file', file)

  // Let the browser set its own multipart boundary — an explicit
  // Content-Type here would ship without one and the server couldn't parse
  // the body.
  const { data } = await apiClient.post<{ data: LabTest }>(`/laboratory/${id}/report`, form, {
    headers: { 'Content-Type': undefined },
  })
  return data.data
}

export async function downloadLabReportPdf(id: string, labOrderNumber: string): Promise<void> {
  const response = await apiClient.get(`/laboratory/${id}/report/pdf`, { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.download = `${labOrderNumber}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
