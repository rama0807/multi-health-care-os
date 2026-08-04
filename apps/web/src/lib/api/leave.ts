import type {
  ApplyStaffLeaveDto,
  DecideStaffLeaveDto,
  Holiday,
  LeaveBalanceEntry,
  LeaveTypeConfig,
  PaginatedResponse,
  StaffLeave,
  StaffLeaveSearchQuery,
  UpsertHolidayDto,
  UpsertLeaveTypeConfigDto,
} from '@medicore/types'

import { apiClient } from './client'

// ─── Staff leave ─────────────────────────────────────────────────────────────

export async function listStaffLeave(query: StaffLeaveSearchQuery = {}): Promise<PaginatedResponse<StaffLeave>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<StaffLeave> }>('/leave', { params: query })
  return data.data
}

export async function getStaffLeave(id: string): Promise<StaffLeave> {
  const { data } = await apiClient.get<{ data: StaffLeave }>(`/leave/${id}`)
  return data.data
}

export async function applyStaffLeave(dto: ApplyStaffLeaveDto & { staffId?: string }): Promise<StaffLeave> {
  const { data } = await apiClient.post<{ data: StaffLeave }>('/leave', dto)
  return data.data
}

export async function approveStaffLeave(id: string, dto: DecideStaffLeaveDto = {}): Promise<StaffLeave> {
  const { data } = await apiClient.post<{ data: StaffLeave }>(`/leave/${id}/approve`, dto)
  return data.data
}

export async function rejectStaffLeave(id: string, dto: DecideStaffLeaveDto = {}): Promise<StaffLeave> {
  const { data } = await apiClient.post<{ data: StaffLeave }>(`/leave/${id}/reject`, dto)
  return data.data
}

export async function cancelStaffLeave(id: string): Promise<StaffLeave> {
  const { data } = await apiClient.post<{ data: StaffLeave }>(`/leave/${id}/cancel`, {})
  return data.data
}

export async function getLeaveBalance(staffId: string, year?: number): Promise<LeaveBalanceEntry[]> {
  const { data } = await apiClient.get<{ data: { entries: LeaveBalanceEntry[] } }>('/leave/balance', {
    params: { staffId, year },
  })
  return data.data.entries
}

// ─── Leave type config ───────────────────────────────────────────────────────

export async function listLeaveTypes(): Promise<LeaveTypeConfig[]> {
  const { data } = await apiClient.get<{ data: { types: LeaveTypeConfig[] } }>('/leave/types')
  return data.data.types
}

export async function upsertLeaveType(dto: UpsertLeaveTypeConfigDto): Promise<LeaveTypeConfig> {
  const { data } = await apiClient.put<{ data: LeaveTypeConfig }>('/leave/types', dto)
  return data.data
}

// ─── Holidays ────────────────────────────────────────────────────────────────

export async function listHolidays(year?: number): Promise<Holiday[]> {
  const { data } = await apiClient.get<{ data: { holidays: Holiday[] } }>('/leave/holidays', { params: { year } })
  return data.data.holidays
}

export async function createHoliday(dto: UpsertHolidayDto): Promise<Holiday> {
  const { data } = await apiClient.post<{ data: Holiday }>('/leave/holidays', dto)
  return data.data
}

export async function deleteHoliday(id: string): Promise<void> {
  await apiClient.delete(`/leave/holidays/${id}`)
}
