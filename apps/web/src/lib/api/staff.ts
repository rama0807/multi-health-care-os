import type {
  CreateStaffDto,
  PaginatedResponse,
  Staff,
  StaffDashboardStats,
  StaffDocument,
  StaffDocumentType,
  StaffSearchQuery,
  UpdateStaffDto,
} from '@medicore/types'

import { apiClient } from './client'

// ─── Dashboard ───────────────────────────────────────────────────────────────

export async function getStaffDashboardStats(): Promise<StaffDashboardStats> {
  const { data } = await apiClient.get<{ data: StaffDashboardStats }>('/staff/dashboard/stats')
  return data.data
}

// ─── Staff directory ─────────────────────────────────────────────────────────

export async function listStaff(query: StaffSearchQuery = {}): Promise<PaginatedResponse<Staff>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<Staff> }>('/staff', { params: query })
  return data.data
}

export async function getStaff(id: string): Promise<Staff> {
  const { data } = await apiClient.get<{ data: Staff }>(`/staff/${id}`)
  return data.data
}

export async function getMyStaffProfile(): Promise<Staff> {
  const { data } = await apiClient.get<{ data: Staff }>('/staff/me')
  return data.data
}

export async function createStaff(dto: CreateStaffDto): Promise<Staff> {
  const { data } = await apiClient.post<{ data: Staff }>('/staff', dto)
  return data.data
}

export async function updateStaff(id: string, dto: UpdateStaffDto): Promise<Staff> {
  const { data } = await apiClient.patch<{ data: Staff }>(`/staff/${id}`, dto)
  return data.data
}

export async function setStaffEmploymentStatus(id: string, status: string): Promise<Staff> {
  const { data } = await apiClient.post<{ data: Staff }>(`/staff/${id}/employment-status`, { status })
  return data.data
}

// ─── Documents ───────────────────────────────────────────────────────────────

export async function listStaffDocuments(staffId: string): Promise<StaffDocument[]> {
  const { data } = await apiClient.get<{ data: StaffDocument[] }>(`/staff/${staffId}/documents`)
  return data.data
}

export async function uploadStaffDocument(
  staffId: string,
  documentType: StaffDocumentType,
  file: File,
): Promise<StaffDocument> {
  const formData = new FormData()
  formData.append('documentType', documentType)
  formData.append('file', file)
  const { data } = await apiClient.post<{ data: StaffDocument }>(`/staff/${staffId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.data
}

export async function deleteStaffDocument(staffId: string, documentId: string): Promise<void> {
  await apiClient.delete(`/staff/${staffId}/documents/${documentId}`)
}
