import type {
  ApplyLeaveDto,
  CreateDoctorScheduleDto,
  DoctorAuditTimelineEntry,
  DoctorAvailabilityResult,
  DoctorDocument,
  DoctorDocumentType,
  DoctorLeaveWithDoctor,
  DoctorSchedule,
  DoctorTodayStatus,
  LeaveSearchQuery,
  PaginatedResponse,
} from '@medicore/types'

import { apiClient } from './client'

// ── Schedule ────────────────────────────────────────────────────────────────

export async function getDoctorSchedule(doctorId: string): Promise<DoctorSchedule | null> {
  const { data } = await apiClient.get<{ data: DoctorSchedule | null }>(`/doctors/${doctorId}/schedule`)
  return data.data
}

export async function listDoctorScheduleVersions(doctorId: string): Promise<DoctorSchedule[]> {
  const { data } = await apiClient.get<{ data: { versions: DoctorSchedule[] } }>(
    `/doctors/${doctorId}/schedule/versions`,
  )
  return data.data.versions
}

export async function createDoctorSchedule(
  doctorId: string,
  dto: CreateDoctorScheduleDto,
): Promise<DoctorSchedule> {
  const { data } = await apiClient.post<{ data: DoctorSchedule }>(`/doctors/${doctorId}/schedule`, dto)
  return data.data
}

export async function setDoctorScheduleVersionActive(
  doctorId: string,
  scheduleId: string,
  isActive: boolean,
): Promise<DoctorSchedule> {
  const { data } = await apiClient.patch<{ data: DoctorSchedule }>(
    `/doctors/${doctorId}/schedule/${scheduleId}`,
    { isActive },
  )
  return data.data
}

// ── Leave ───────────────────────────────────────────────────────────────────

export async function listDoctorLeaves(
  query: LeaveSearchQuery,
): Promise<PaginatedResponse<DoctorLeaveWithDoctor>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<DoctorLeaveWithDoctor> }>('/doctor-leaves', {
    params: query,
  })
  return data.data
}

export async function applyDoctorLeave(dto: ApplyLeaveDto): Promise<DoctorLeaveWithDoctor> {
  const { data } = await apiClient.post<{ data: DoctorLeaveWithDoctor }>('/doctor-leaves', dto)
  return data.data
}

export async function approveDoctorLeave(leaveId: string, decisionNote?: string): Promise<DoctorLeaveWithDoctor> {
  const { data } = await apiClient.post<{ data: DoctorLeaveWithDoctor }>(`/doctor-leaves/${leaveId}/approve`, {
    decisionNote,
  })
  return data.data
}

export async function rejectDoctorLeave(leaveId: string, decisionNote?: string): Promise<DoctorLeaveWithDoctor> {
  const { data } = await apiClient.post<{ data: DoctorLeaveWithDoctor }>(`/doctor-leaves/${leaveId}/reject`, {
    decisionNote,
  })
  return data.data
}

export async function cancelDoctorLeave(leaveId: string): Promise<DoctorLeaveWithDoctor> {
  const { data } = await apiClient.post<{ data: DoctorLeaveWithDoctor }>(`/doctor-leaves/${leaveId}/cancel`)
  return data.data
}

// ── Availability ──────────────────────────────────────────────────────────

export async function getDoctorAvailableSlots(
  doctorId: string,
  date: string,
  duration?: number,
): Promise<DoctorAvailabilityResult> {
  const { data } = await apiClient.get<{ data: DoctorAvailabilityResult }>(
    `/doctors/${doctorId}/availability`,
    { params: { date, duration } },
  )
  return data.data
}

export async function getDoctorTodayStatus(doctorId: string): Promise<DoctorTodayStatus> {
  const { data } = await apiClient.get<{ data: DoctorTodayStatus }>(`/doctors/${doctorId}/availability/today`)
  return data.data
}

// ── Documents ───────────────────────────────────────────────────────────────

export async function listDoctorDocuments(doctorId: string): Promise<DoctorDocument[]> {
  const { data } = await apiClient.get<{ data: DoctorDocument[] }>(`/doctors/${doctorId}/documents`)
  return data.data
}

export async function uploadDoctorDocument(
  doctorId: string,
  file: File,
  documentType: DoctorDocumentType,
): Promise<DoctorDocument> {
  const form = new FormData()
  form.append('documentType', documentType)
  form.append('file', file)

  // Let the browser set its own multipart boundary — an explicit
  // Content-Type here (or the instance's default application/json) would
  // ship without a boundary and the server couldn't parse the body.
  const { data } = await apiClient.post<{ data: DoctorDocument }>(`/doctors/${doctorId}/documents`, form, {
    headers: { 'Content-Type': undefined },
  })
  return data.data
}

export async function deleteDoctorDocument(doctorId: string, documentId: string): Promise<void> {
  await apiClient.delete(`/doctors/${doctorId}/documents/${documentId}`)
}

// ── Audit timeline ──────────────────────────────────────────────────────────

export async function getDoctorAuditTimeline(doctorId: string, limit?: number): Promise<DoctorAuditTimelineEntry[]> {
  const { data } = await apiClient.get<{ data: { entries: DoctorAuditTimelineEntry[] } }>(
    `/doctors/${doctorId}/audit-timeline`,
    { params: { limit } },
  )
  return data.data.entries
}
