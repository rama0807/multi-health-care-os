import type {
  CreateIntakeOutputDto,
  CreateIpdOrderDto,
  CreateNursingAssessmentDto,
  CreateNursingNoteDto,
  CreateNursingTaskDto,
  DiscontinueIpdOrderDto,
  IntakeOutputQuery,
  IntakeOutputRecord,
  IpdOrder,
  IpdOrderQuery,
  NursingAssessment,
  NursingAssessmentQuery,
  NursingNote,
  NursingNoteQuery,
  NursingTask,
  NursingTaskQuery,
  NursingTaskWithDetails,
  PaginatedResponse,
  UpdateNursingTaskStatusDto,
} from '@medicore/types'

import { apiClient } from './client'

// ─── Nursing Notes ──────────────────────────────────────────────────────────

export async function listNursingNotes(
  admissionId: string,
  query: NursingNoteQuery = {},
): Promise<PaginatedResponse<NursingNote>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<NursingNote> }>(
    `/ipd/admissions/${admissionId}/nursing-notes`,
    { params: query },
  )
  return data.data
}

export async function createNursingNote(admissionId: string, dto: CreateNursingNoteDto): Promise<NursingNote> {
  const { data } = await apiClient.post<{ data: NursingNote }>(`/ipd/admissions/${admissionId}/nursing-notes`, dto)
  return data.data
}

// ─── Nursing Assessments ────────────────────────────────────────────────────

export async function listNursingAssessments(
  admissionId: string,
  query: NursingAssessmentQuery = {},
): Promise<PaginatedResponse<NursingAssessment>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<NursingAssessment> }>(
    `/ipd/admissions/${admissionId}/nursing-assessments`,
    { params: query },
  )
  return data.data
}

export async function createNursingAssessment(
  admissionId: string,
  dto: CreateNursingAssessmentDto,
): Promise<NursingAssessment> {
  const { data } = await apiClient.post<{ data: NursingAssessment }>(
    `/ipd/admissions/${admissionId}/nursing-assessments`,
    dto,
  )
  return data.data
}

// ─── Intake / Output Chart ──────────────────────────────────────────────────

export async function listIntakeOutput(
  admissionId: string,
  query: IntakeOutputQuery = {},
): Promise<PaginatedResponse<IntakeOutputRecord>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<IntakeOutputRecord> }>(
    `/ipd/admissions/${admissionId}/intake-output`,
    { params: query },
  )
  return data.data
}

export async function createIntakeOutput(admissionId: string, dto: CreateIntakeOutputDto): Promise<IntakeOutputRecord> {
  const { data } = await apiClient.post<{ data: IntakeOutputRecord }>(
    `/ipd/admissions/${admissionId}/intake-output`,
    dto,
  )
  return data.data
}

// ─── IPD Orders ─────────────────────────────────────────────────────────────

export async function listIpdOrders(admissionId: string, query: IpdOrderQuery = {}): Promise<PaginatedResponse<IpdOrder>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<IpdOrder> }>(`/ipd/admissions/${admissionId}/orders`, {
    params: query,
  })
  return data.data
}

export async function createIpdOrder(admissionId: string, dto: CreateIpdOrderDto): Promise<IpdOrder> {
  const { data } = await apiClient.post<{ data: IpdOrder }>(`/ipd/admissions/${admissionId}/orders`, dto)
  return data.data
}

export async function discontinueIpdOrder(
  admissionId: string,
  orderId: string,
  dto: DiscontinueIpdOrderDto,
): Promise<IpdOrder> {
  const { data } = await apiClient.patch<{ data: IpdOrder }>(
    `/ipd/admissions/${admissionId}/orders/${orderId}/discontinue`,
    dto,
  )
  return data.data
}

// ─── Nursing Tasks ──────────────────────────────────────────────────────────

export async function listNursingTasksForAdmission(
  admissionId: string,
  query: NursingTaskQuery = {},
): Promise<PaginatedResponse<NursingTaskWithDetails>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<NursingTaskWithDetails> }>(
    `/ipd/admissions/${admissionId}/nursing-tasks`,
    { params: query },
  )
  return data.data
}

export async function listNursingTaskQueue(query: NursingTaskQuery = {}): Promise<PaginatedResponse<NursingTaskWithDetails>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<NursingTaskWithDetails> }>('/ipd/nursing-tasks', {
    params: query,
  })
  return data.data
}

export async function createNursingTask(admissionId: string, dto: CreateNursingTaskDto): Promise<NursingTask> {
  const { data } = await apiClient.post<{ data: NursingTask }>(`/ipd/admissions/${admissionId}/nursing-tasks`, dto)
  return data.data
}

export async function updateNursingTaskStatus(taskId: string, dto: UpdateNursingTaskStatusDto): Promise<NursingTask> {
  const { data } = await apiClient.patch<{ data: NursingTask }>(`/ipd/nursing-tasks/${taskId}/status`, dto)
  return data.data
}
