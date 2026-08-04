import type {
  AdjustStockDto,
  AssignStoreManagerDto,
  CreateInventoryBrandDto,
  CreateInventoryCategoryDto,
  CreateInventoryItemDto,
  CreateInventoryItemGroupDto,
  CreateInventoryManufacturerDto,
  CreateInventoryStoreDto,
  CreateInventoryUnitDto,
  CreateStockTransferDto,
  CreateVendorDto,
  InventoryBrand,
  InventoryCategory,
  InventoryDashboardStats,
  InventoryItemGroup,
  InventoryItemQuery,
  InventoryItemWithRefs,
  InventoryManufacturer,
  InventoryStockQuery,
  InventoryStockTransfer,
  InventoryStockTransferQuery,
  InventoryStockWithRefs,
  InventoryStore,
  InventoryStoreManager,
  InventoryUnit,
  PaginatedResponse,
  RateVendorDto,
  SetOpeningStockDto,
  UpdateInventoryBrandDto,
  UpdateInventoryCategoryDto,
  UpdateInventoryItemDto,
  UpdateInventoryItemGroupDto,
  UpdateInventoryManufacturerDto,
  UpdateInventoryStoreDto,
  UpdateInventoryUnitDto,
  UpdateStockLevelsDto,
  UpdateVendorDto,
  Vendor,
  VendorQuery,
  VendorRating,
  VendorWithStats,
} from '@medicore/types'

import { apiClient } from './client'

// ─── Dashboard ───────────────────────────────────────────────────────────────

export async function getInventoryDashboardStats(): Promise<InventoryDashboardStats> {
  const { data } = await apiClient.get<{ data: InventoryDashboardStats }>('/inventory/dashboard')
  return data.data
}

// ─── Items ───────────────────────────────────────────────────────────────────

export async function listInventoryItems(
  query: InventoryItemQuery = {},
): Promise<PaginatedResponse<InventoryItemWithRefs>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<InventoryItemWithRefs> }>('/inventory/items', {
    params: query,
  })
  return data.data
}

export async function getInventoryItem(id: string): Promise<InventoryItemWithRefs> {
  const { data } = await apiClient.get<{ data: InventoryItemWithRefs }>(`/inventory/items/${id}`)
  return data.data
}

export async function createInventoryItem(dto: CreateInventoryItemDto): Promise<InventoryItemWithRefs> {
  const { data } = await apiClient.post<{ data: InventoryItemWithRefs }>('/inventory/items', dto)
  return data.data
}

export async function updateInventoryItem(id: string, dto: UpdateInventoryItemDto): Promise<InventoryItemWithRefs> {
  const { data } = await apiClient.patch<{ data: InventoryItemWithRefs }>(`/inventory/items/${id}`, dto)
  return data.data
}

// ─── Item master lookups (categories, item groups, units, manufacturers, brands) ──

export async function listInventoryCategories(isActive?: boolean): Promise<InventoryCategory[]> {
  const { data } = await apiClient.get<{ data: InventoryCategory[] }>('/inventory/categories', {
    params: { isActive },
  })
  return data.data
}

export async function createInventoryCategory(dto: CreateInventoryCategoryDto): Promise<InventoryCategory> {
  const { data } = await apiClient.post<{ data: InventoryCategory }>('/inventory/categories', dto)
  return data.data
}

export async function updateInventoryCategory(
  id: string,
  dto: UpdateInventoryCategoryDto,
): Promise<InventoryCategory> {
  const { data } = await apiClient.patch<{ data: InventoryCategory }>(`/inventory/categories/${id}`, dto)
  return data.data
}

export async function listInventoryItemGroups(isActive?: boolean): Promise<InventoryItemGroup[]> {
  const { data } = await apiClient.get<{ data: InventoryItemGroup[] }>('/inventory/item-groups', {
    params: { isActive },
  })
  return data.data
}

export async function createInventoryItemGroup(dto: CreateInventoryItemGroupDto): Promise<InventoryItemGroup> {
  const { data } = await apiClient.post<{ data: InventoryItemGroup }>('/inventory/item-groups', dto)
  return data.data
}

export async function updateInventoryItemGroup(
  id: string,
  dto: UpdateInventoryItemGroupDto,
): Promise<InventoryItemGroup> {
  const { data } = await apiClient.patch<{ data: InventoryItemGroup }>(`/inventory/item-groups/${id}`, dto)
  return data.data
}

export async function listInventoryUnits(isActive?: boolean): Promise<InventoryUnit[]> {
  const { data } = await apiClient.get<{ data: InventoryUnit[] }>('/inventory/units', { params: { isActive } })
  return data.data
}

export async function createInventoryUnit(dto: CreateInventoryUnitDto): Promise<InventoryUnit> {
  const { data } = await apiClient.post<{ data: InventoryUnit }>('/inventory/units', dto)
  return data.data
}

export async function updateInventoryUnit(id: string, dto: UpdateInventoryUnitDto): Promise<InventoryUnit> {
  const { data } = await apiClient.patch<{ data: InventoryUnit }>(`/inventory/units/${id}`, dto)
  return data.data
}

export async function listInventoryManufacturers(isActive?: boolean): Promise<InventoryManufacturer[]> {
  const { data } = await apiClient.get<{ data: InventoryManufacturer[] }>('/inventory/manufacturers', {
    params: { isActive },
  })
  return data.data
}

export async function createInventoryManufacturer(
  dto: CreateInventoryManufacturerDto,
): Promise<InventoryManufacturer> {
  const { data } = await apiClient.post<{ data: InventoryManufacturer }>('/inventory/manufacturers', dto)
  return data.data
}

export async function updateInventoryManufacturer(
  id: string,
  dto: UpdateInventoryManufacturerDto,
): Promise<InventoryManufacturer> {
  const { data } = await apiClient.patch<{ data: InventoryManufacturer }>(`/inventory/manufacturers/${id}`, dto)
  return data.data
}

export async function listInventoryBrands(isActive?: boolean): Promise<InventoryBrand[]> {
  const { data } = await apiClient.get<{ data: InventoryBrand[] }>('/inventory/brands', { params: { isActive } })
  return data.data
}

export async function createInventoryBrand(dto: CreateInventoryBrandDto): Promise<InventoryBrand> {
  const { data } = await apiClient.post<{ data: InventoryBrand }>('/inventory/brands', dto)
  return data.data
}

export async function updateInventoryBrand(id: string, dto: UpdateInventoryBrandDto): Promise<InventoryBrand> {
  const { data } = await apiClient.patch<{ data: InventoryBrand }>(`/inventory/brands/${id}`, dto)
  return data.data
}

// ─── Stores ──────────────────────────────────────────────────────────────────

export async function listInventoryStores(isActive?: boolean): Promise<InventoryStore[]> {
  const { data } = await apiClient.get<{ data: InventoryStore[] }>('/inventory/stores', { params: { isActive } })
  return data.data
}

export async function getInventoryStore(id: string): Promise<InventoryStore> {
  const { data } = await apiClient.get<{ data: InventoryStore }>(`/inventory/stores/${id}`)
  return data.data
}

export async function createInventoryStore(dto: CreateInventoryStoreDto): Promise<InventoryStore> {
  const { data } = await apiClient.post<{ data: InventoryStore }>('/inventory/stores', dto)
  return data.data
}

export async function updateInventoryStore(id: string, dto: UpdateInventoryStoreDto): Promise<InventoryStore> {
  const { data } = await apiClient.patch<{ data: InventoryStore }>(`/inventory/stores/${id}`, dto)
  return data.data
}

export async function deactivateInventoryStore(id: string): Promise<InventoryStore> {
  const { data } = await apiClient.post<{ data: InventoryStore }>(`/inventory/stores/${id}/deactivate`)
  return data.data
}

export async function listStoreManagers(storeId: string): Promise<InventoryStoreManager[]> {
  const { data } = await apiClient.get<{ data: InventoryStoreManager[] }>(`/inventory/stores/${storeId}/managers`)
  return data.data
}

export async function assignStoreManager(storeId: string, dto: AssignStoreManagerDto): Promise<InventoryStoreManager> {
  const { data } = await apiClient.post<{ data: InventoryStoreManager }>(`/inventory/stores/${storeId}/managers`, dto)
  return data.data
}

export async function removeStoreManager(storeId: string, managerId: string): Promise<void> {
  await apiClient.delete(`/inventory/stores/${storeId}/managers/${managerId}`)
}

// ─── Stock ───────────────────────────────────────────────────────────────────

export async function listInventoryStock(
  query: InventoryStockQuery = {},
): Promise<PaginatedResponse<InventoryStockWithRefs>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<InventoryStockWithRefs> }>('/inventory/stock', {
    params: query,
  })
  return data.data
}

export async function getInventoryStockById(id: string): Promise<InventoryStockWithRefs> {
  const { data } = await apiClient.get<{ data: InventoryStockWithRefs }>(`/inventory/stock/${id}`)
  return data.data
}

export async function setOpeningStock(dto: SetOpeningStockDto): Promise<InventoryStockWithRefs> {
  const { data } = await apiClient.post<{ data: InventoryStockWithRefs }>('/inventory/stock/opening', dto)
  return data.data
}

export async function updateStockLevels(id: string, dto: UpdateStockLevelsDto): Promise<InventoryStockWithRefs> {
  const { data } = await apiClient.patch<{ data: InventoryStockWithRefs }>(`/inventory/stock/${id}/levels`, dto)
  return data.data
}

export async function adjustStock(dto: AdjustStockDto): Promise<InventoryStockWithRefs> {
  const { data } = await apiClient.post<{ data: InventoryStockWithRefs }>('/inventory/stock/adjust', dto)
  return data.data
}

// ─── Stock Transfers ─────────────────────────────────────────────────────────

export async function listStockTransfers(
  query: InventoryStockTransferQuery = {},
): Promise<PaginatedResponse<InventoryStockTransfer>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<InventoryStockTransfer> }>('/inventory/transfers', {
    params: query,
  })
  return data.data
}

export async function getStockTransfer(id: string): Promise<InventoryStockTransfer> {
  const { data } = await apiClient.get<{ data: InventoryStockTransfer }>(`/inventory/transfers/${id}`)
  return data.data
}

export async function createStockTransfer(dto: CreateStockTransferDto): Promise<InventoryStockTransfer> {
  const { data } = await apiClient.post<{ data: InventoryStockTransfer }>('/inventory/transfers', dto)
  return data.data
}

export async function dispatchStockTransfer(id: string): Promise<InventoryStockTransfer> {
  const { data } = await apiClient.post<{ data: InventoryStockTransfer }>(`/inventory/transfers/${id}/dispatch`)
  return data.data
}

export async function receiveStockTransfer(id: string): Promise<InventoryStockTransfer> {
  const { data } = await apiClient.post<{ data: InventoryStockTransfer }>(`/inventory/transfers/${id}/receive`)
  return data.data
}

export async function cancelStockTransfer(id: string, reason?: string): Promise<InventoryStockTransfer> {
  const { data } = await apiClient.post<{ data: InventoryStockTransfer }>(`/inventory/transfers/${id}/cancel`, { reason })
  return data.data
}

// ─── Vendors ─────────────────────────────────────────────────────────────────

export async function listVendors(query: VendorQuery = {}): Promise<PaginatedResponse<VendorWithStats>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<VendorWithStats> }>('/inventory/vendors', {
    params: query,
  })
  return data.data
}

export async function getVendor(id: string): Promise<VendorWithStats> {
  const { data } = await apiClient.get<{ data: VendorWithStats }>(`/inventory/vendors/${id}`)
  return data.data
}

export async function createVendor(dto: CreateVendorDto): Promise<Vendor> {
  const { data } = await apiClient.post<{ data: Vendor }>('/inventory/vendors', dto)
  return data.data
}

export async function updateVendor(id: string, dto: UpdateVendorDto): Promise<Vendor> {
  const { data } = await apiClient.patch<{ data: Vendor }>(`/inventory/vendors/${id}`, dto)
  return data.data
}

export async function listVendorRatings(id: string): Promise<VendorRating[]> {
  const { data } = await apiClient.get<{ data: VendorRating[] }>(`/inventory/vendors/${id}/ratings`)
  return data.data
}

export async function rateVendor(id: string, dto: RateVendorDto): Promise<VendorRating> {
  const { data } = await apiClient.post<{ data: VendorRating }>(`/inventory/vendors/${id}/ratings`, dto)
  return data.data
}
