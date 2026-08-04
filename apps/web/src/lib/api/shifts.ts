import type {
  AssignShiftRosterDto,
  BulkAssignShiftRosterDto,
  CreateShiftDto,
  Shift,
  ShiftRoster,
  ShiftRosterQuery,
  ShiftSearchQuery,
  UpdateShiftDto,
} from '@medicore/types'

import { apiClient } from './client'

// ─── Shift catalog ───────────────────────────────────────────────────────────

export async function listShifts(query: ShiftSearchQuery = {}): Promise<Shift[]> {
  const { data } = await apiClient.get<{ data: Shift[] }>('/shifts', { params: query })
  return data.data
}

export async function createShift(dto: CreateShiftDto): Promise<Shift> {
  const { data } = await apiClient.post<{ data: Shift }>('/shifts', dto)
  return data.data
}

export async function updateShift(id: string, dto: UpdateShiftDto): Promise<Shift> {
  const { data } = await apiClient.patch<{ data: Shift }>(`/shifts/${id}`, dto)
  return data.data
}

export async function deactivateShift(id: string): Promise<Shift> {
  const { data } = await apiClient.delete<{ data: Shift }>(`/shifts/${id}`)
  return data.data
}

// ─── Roster ──────────────────────────────────────────────────────────────────

export async function listShiftRoster(query: ShiftRosterQuery): Promise<ShiftRoster[]> {
  const { data } = await apiClient.get<{ data: ShiftRoster[] }>('/shifts/roster', { params: query })
  return data.data
}

export async function assignShiftRoster(dto: AssignShiftRosterDto): Promise<ShiftRoster> {
  const { data } = await apiClient.post<{ data: ShiftRoster }>('/shifts/roster', dto)
  return data.data
}

export async function bulkAssignShiftRoster(dto: BulkAssignShiftRosterDto): Promise<ShiftRoster[]> {
  const { data } = await apiClient.post<{ data: ShiftRoster[] }>('/shifts/roster/bulk', dto)
  return data.data
}

export async function deleteShiftRoster(id: string): Promise<void> {
  await apiClient.delete(`/shifts/roster/${id}`)
}
