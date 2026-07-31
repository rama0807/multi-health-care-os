import type {
  CreateDoctorDto,
  Doctor,
  DoctorDashboardStats,
  DoctorSearchQuery,
  DoctorWithSummary,
  PaginatedResponse,
  UpdateDoctorDto,
} from '@medicore/types'

import { apiClient } from './client'

export async function listDoctors(query: DoctorSearchQuery): Promise<PaginatedResponse<Doctor>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<Doctor> }>('/doctors', {
    params: query,
  })
  return data.data
}

export async function getDoctor(id: string): Promise<DoctorWithSummary> {
  const { data } = await apiClient.get<{ data: DoctorWithSummary }>(`/doctors/${id}`)
  return data.data
}

export async function getMyDoctorProfile(): Promise<DoctorWithSummary> {
  const { data } = await apiClient.get<{ data: DoctorWithSummary }>('/doctors/me')
  return data.data
}

export async function createDoctor(dto: CreateDoctorDto): Promise<Doctor> {
  const { data } = await apiClient.post<{ data: Doctor }>('/doctors', dto)
  return data.data
}

export async function updateDoctor(id: string, dto: UpdateDoctorDto): Promise<Doctor> {
  const { data } = await apiClient.patch<{ data: Doctor }>(`/doctors/${id}`, dto)
  return data.data
}

export async function deactivateDoctor(id: string): Promise<void> {
  await apiClient.delete(`/doctors/${id}`)
}

export async function restoreDoctor(id: string): Promise<Doctor> {
  const { data } = await apiClient.post<{ data: Doctor }>(`/doctors/${id}/restore`)
  return data.data
}

export async function getDoctorDashboardStats(): Promise<DoctorDashboardStats> {
  const { data } = await apiClient.get<{ data: DoctorDashboardStats }>('/doctors/stats/dashboard')
  return data.data
}
