import type {
  CreatePatientDto,
  DuplicateCheckDto,
  DuplicateMatch,
  PaginatedResponse,
  Patient,
  PatientDocument,
  PatientSearchQuery,
  PatientTimelineEntry,
  PatientWithSummary,
  UpdatePatientDto,
} from '@medicore/types'

import { apiClient } from './client'

export async function listPatients(query: PatientSearchQuery): Promise<PaginatedResponse<Patient>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<Patient> }>('/patients', {
    params: query,
  })
  return data.data
}

export async function getPatient(id: string): Promise<PatientWithSummary> {
  const { data } = await apiClient.get<{ data: PatientWithSummary }>(`/patients/${id}`)
  return data.data
}

export async function createPatient(dto: CreatePatientDto): Promise<Patient> {
  const { data } = await apiClient.post<{ data: Patient }>('/patients', dto)
  return data.data
}

export async function updatePatient(id: string, dto: UpdatePatientDto): Promise<Patient> {
  const { data } = await apiClient.patch<{ data: Patient }>(`/patients/${id}`, dto)
  return data.data
}

export async function deletePatient(id: string): Promise<void> {
  await apiClient.delete(`/patients/${id}`)
}

export async function restorePatient(id: string): Promise<Patient> {
  const { data } = await apiClient.post<{ data: Patient }>(`/patients/${id}/restore`)
  return data.data
}

export async function checkDuplicatePatients(dto: DuplicateCheckDto): Promise<DuplicateMatch[]> {
  const { data } = await apiClient.get<{ data: { matches: DuplicateMatch[] } }>(
    '/patients/duplicates/check',
    { params: dto },
  )
  return data.data.matches
}

export async function getPatientTimeline(id: string): Promise<PatientTimelineEntry[]> {
  const { data } = await apiClient.get<{ data: { entries: PatientTimelineEntry[] } }>(
    `/patients/${id}/timeline`,
  )
  return data.data.entries
}

export async function listPatientDocuments(id: string): Promise<PatientDocument[]> {
  const { data } = await apiClient.get<{ data: PatientDocument[] }>(`/patients/${id}/documents`)
  return data.data
}

export async function uploadPatientDocument(
  id: string,
  file: File,
  documentType: string,
): Promise<PatientDocument> {
  const form = new FormData()
  form.append('documentType', documentType)
  form.append('file', file)

  // Let the browser set its own multipart boundary — an explicit
  // Content-Type here (or the instance's default application/json) would
  // ship without a boundary and the server couldn't parse the body.
  const { data } = await apiClient.post<{ data: PatientDocument }>(`/patients/${id}/documents`, form, {
    headers: { 'Content-Type': undefined },
  })
  return data.data
}

export async function deletePatientDocument(id: string, documentId: string): Promise<void> {
  await apiClient.delete(`/patients/${id}/documents/${documentId}`)
}

export async function getTodayRegistrationsCount(): Promise<number> {
  const { data } = await apiClient.get<{ data: { count: number } }>('/patients/stats/today-registrations')
  return data.data.count
}

export async function getRecentDuplicateAlerts(limit = 5): Promise<DuplicateMatch[]> {
  const { data } = await apiClient.get<{ data: { alerts: DuplicateMatch[] } }>('/patients/duplicates/recent', {
    params: { limit },
  })
  return data.data.alerts
}
