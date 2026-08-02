import type {
  AdjustDrugStockDto,
  CancelDispenseOrderDto,
  CreateDispenseOrderDto,
  CreateDrugDto,
  CreateDrugReturnDto,
  DispenseOrder,
  DispenseOrderQuery,
  DispenseOrderWithDetails,
  DispensePartialDto,
  Drug,
  DrugQuery,
  DrugReturn,
  PaginatedResponse,
  PharmacyDashboardStats,
  PrepareDispenseItemsDto,
  UpdateDrugDto,
} from '@medicore/types'

import { apiClient } from './client'

// ─── Drug Catalog ──────────────────────────────────────────────────────────

export async function listDrugCatalog(query: DrugQuery = {}): Promise<PaginatedResponse<Drug>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<Drug> }>('/pharmacy/catalog', { params: query })
  return data.data
}

export async function getDrug(id: string): Promise<Drug> {
  const { data } = await apiClient.get<{ data: Drug }>(`/pharmacy/catalog/${id}`)
  return data.data
}

export async function createDrug(dto: CreateDrugDto): Promise<Drug> {
  const { data } = await apiClient.post<{ data: Drug }>('/pharmacy/catalog', dto)
  return data.data
}

export async function updateDrug(id: string, dto: UpdateDrugDto): Promise<Drug> {
  const { data } = await apiClient.patch<{ data: Drug }>(`/pharmacy/catalog/${id}`, dto)
  return data.data
}

export async function adjustDrugStock(id: string, dto: AdjustDrugStockDto): Promise<Drug> {
  const { data } = await apiClient.post<{ data: Drug }>(`/pharmacy/catalog/${id}/adjust-stock`, dto)
  return data.data
}

// ─── Dispensing ────────────────────────────────────────────────────────────

export async function listDispenseOrders(
  query: DispenseOrderQuery,
): Promise<PaginatedResponse<DispenseOrderWithDetails>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<DispenseOrderWithDetails> }>('/pharmacy/dispense', {
    params: query,
  })
  return data.data
}

export async function getPharmacyDashboardStats(): Promise<PharmacyDashboardStats> {
  const { data } = await apiClient.get<{ data: PharmacyDashboardStats }>('/pharmacy/dispense/dashboard-stats')
  return data.data
}

export async function getDispenseOrder(id: string): Promise<DispenseOrderWithDetails> {
  const { data } = await apiClient.get<{ data: DispenseOrderWithDetails }>(`/pharmacy/dispense/${id}`)
  return data.data
}

export async function createDispenseOrder(dto: CreateDispenseOrderDto): Promise<DispenseOrder> {
  const { data } = await apiClient.post<{ data: DispenseOrder }>('/pharmacy/dispense', dto)
  return data.data
}

export async function prepareDispenseItems(id: string, dto: PrepareDispenseItemsDto): Promise<DispenseOrderWithDetails> {
  const { data } = await apiClient.post<{ data: DispenseOrderWithDetails }>(`/pharmacy/dispense/${id}/prepare`, dto)
  return data.data
}

export async function markDispenseReady(id: string): Promise<DispenseOrder> {
  const { data } = await apiClient.post<{ data: DispenseOrder }>(`/pharmacy/dispense/${id}/ready`, {})
  return data.data
}

export async function dispensePartial(id: string, dto: DispensePartialDto): Promise<DispenseOrderWithDetails> {
  const { data } = await apiClient.post<{ data: DispenseOrderWithDetails }>(`/pharmacy/dispense/${id}/dispense-partial`, dto)
  return data.data
}

export async function dispenseComplete(id: string): Promise<DispenseOrderWithDetails> {
  const { data } = await apiClient.post<{ data: DispenseOrderWithDetails }>(`/pharmacy/dispense/${id}/dispense-complete`, {})
  return data.data
}

export async function rejectDispenseOrder(id: string, dto: CancelDispenseOrderDto): Promise<DispenseOrder> {
  const { data } = await apiClient.post<{ data: DispenseOrder }>(`/pharmacy/dispense/${id}/reject`, dto)
  return data.data
}

export async function cancelDispenseOrder(id: string, dto: CancelDispenseOrderDto): Promise<DispenseOrder> {
  const { data } = await apiClient.post<{ data: DispenseOrder }>(`/pharmacy/dispense/${id}/cancel`, dto)
  return data.data
}

// ─── Returns ───────────────────────────────────────────────────────────────

export async function listDrugReturns(id: string): Promise<DrugReturn[]> {
  const { data } = await apiClient.get<{ data: DrugReturn[] }>(`/pharmacy/dispense/${id}/returns`)
  return data.data
}

export async function createDrugReturn(id: string, dto: CreateDrugReturnDto): Promise<DrugReturn> {
  const { data } = await apiClient.post<{ data: DrugReturn }>(`/pharmacy/dispense/${id}/returns`, dto)
  return data.data
}
