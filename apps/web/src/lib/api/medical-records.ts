import type {
  ClinicalNote,
  CreateClinicalNoteDto,
  CreateDiagnosisDto,
  CreateEncounterDto,
  CreateProcedureDto,
  Diagnosis,
  Encounter,
  EncounterAttachment,
  EncounterAttachmentType,
  EncounterQuery,
  EncounterWithDetails,
  PaginatedResponse,
  Procedure,
  RecordVitalDto,
  UpdateEncounterStatusDto,
  Vital,
} from '@medicore/types'

import { apiClient } from './client'

// ── Encounters ──────────────────────────────────────────────────────────────

export async function listEncounters(query: EncounterQuery): Promise<PaginatedResponse<EncounterWithDetails>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<EncounterWithDetails> }>('/encounters', {
    params: query,
  })
  return data.data
}

export async function getEncounter(id: string): Promise<EncounterWithDetails> {
  const { data } = await apiClient.get<{ data: EncounterWithDetails }>(`/encounters/${id}`)
  return data.data
}

export async function createEncounter(dto: CreateEncounterDto): Promise<Encounter> {
  const { data } = await apiClient.post<{ data: Encounter }>('/encounters', dto)
  return data.data
}

export async function updateEncounterStatus(id: string, dto: UpdateEncounterStatusDto): Promise<Encounter> {
  const { data } = await apiClient.patch<{ data: Encounter }>(`/encounters/${id}/status`, dto)
  return data.data
}

// ── Clinical notes ───────────────────────────────────────────────────────────

export async function listClinicalNotes(encounterId: string): Promise<ClinicalNote[]> {
  const { data } = await apiClient.get<{ data: { notes: ClinicalNote[] } }>(
    `/encounters/${encounterId}/clinical-notes`,
  )
  return data.data.notes
}

export async function getCurrentClinicalNote(encounterId: string): Promise<ClinicalNote | null> {
  const { data } = await apiClient.get<{ data: ClinicalNote | null }>(
    `/encounters/${encounterId}/clinical-notes/current`,
  )
  return data.data
}

export async function createClinicalNoteVersion(
  encounterId: string,
  dto: CreateClinicalNoteDto,
): Promise<ClinicalNote> {
  const { data } = await apiClient.post<{ data: ClinicalNote }>(`/encounters/${encounterId}/clinical-notes`, dto)
  return data.data
}

// ── Vitals ───────────────────────────────────────────────────────────────────

export async function listEncounterVitals(encounterId: string): Promise<Vital[]> {
  const { data } = await apiClient.get<{ data: { vitals: Vital[] } }>(`/encounters/${encounterId}/vitals`)
  return data.data.vitals
}

export async function listPatientVitals(patientId: string): Promise<Vital[]> {
  const { data } = await apiClient.get<{ data: { vitals: Vital[] } }>('/vitals', { params: { patientId } })
  return data.data.vitals
}

export async function recordVital(encounterId: string, dto: RecordVitalDto): Promise<Vital> {
  const { data } = await apiClient.post<{ data: Vital }>(`/encounters/${encounterId}/vitals`, dto)
  return data.data
}

// ── Diagnoses ────────────────────────────────────────────────────────────────

export async function listDiagnoses(encounterId: string): Promise<Diagnosis[]> {
  const { data } = await apiClient.get<{ data: { diagnoses: Diagnosis[] } }>(`/encounters/${encounterId}/diagnoses`)
  return data.data.diagnoses
}

export async function createDiagnosis(encounterId: string, dto: CreateDiagnosisDto): Promise<Diagnosis> {
  const { data } = await apiClient.post<{ data: Diagnosis }>(`/encounters/${encounterId}/diagnoses`, dto)
  return data.data
}

// ── Procedures ───────────────────────────────────────────────────────────────

export async function listProcedures(encounterId: string): Promise<Procedure[]> {
  const { data } = await apiClient.get<{ data: { procedures: Procedure[] } }>(`/encounters/${encounterId}/procedures`)
  return data.data.procedures
}

export async function createProcedure(encounterId: string, dto: CreateProcedureDto): Promise<Procedure> {
  const { data } = await apiClient.post<{ data: Procedure }>(`/encounters/${encounterId}/procedures`, dto)
  return data.data
}

// ── Attachments ──────────────────────────────────────────────────────────────

export async function listEncounterAttachments(encounterId: string): Promise<EncounterAttachment[]> {
  const { data } = await apiClient.get<{ data: { attachments: EncounterAttachment[] } }>(
    `/encounters/${encounterId}/attachments`,
  )
  return data.data.attachments
}

export async function uploadEncounterAttachment(
  encounterId: string,
  file: File,
  documentType: EncounterAttachmentType,
): Promise<EncounterAttachment> {
  const form = new FormData()
  form.append('documentType', documentType)
  form.append('file', file)

  // Let the browser set its own multipart boundary — an explicit
  // Content-Type here would ship without one and the server couldn't parse
  // the body.
  const { data } = await apiClient.post<{ data: EncounterAttachment }>(
    `/encounters/${encounterId}/attachments`,
    form,
    { headers: { 'Content-Type': undefined } },
  )
  return data.data
}

export async function deleteEncounterAttachment(encounterId: string, attachmentId: string): Promise<void> {
  await apiClient.delete(`/encounters/${encounterId}/attachments/${attachmentId}`)
}
