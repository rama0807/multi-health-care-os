import { z } from 'zod'

import {
  InventoryBatchStatus,
  InventoryItemType,
  InventoryStoreType,
  StockTransferStatus,
  StoreManagerRole,
} from './enums'
import { optionalString } from './zod-helpers'

// ─── Item Master ────────────────────────────────────────────────────────────

export interface InventoryCategory {
  id: string
  organizationId: string
  parentId: string | null
  name: string
  code: string
  description: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export const CreateInventoryCategorySchema = z.object({
  parentId: z.string().cuid().optional(),
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50),
  description: z.string().max(1000).optional(),
})
export type CreateInventoryCategoryDto = z.infer<typeof CreateInventoryCategorySchema>

export const UpdateInventoryCategorySchema = CreateInventoryCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
})
export type UpdateInventoryCategoryDto = z.infer<typeof UpdateInventoryCategorySchema>

export interface InventoryItemGroup {
  id: string
  organizationId: string
  name: string
  code: string
  description: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export const CreateInventoryItemGroupSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50),
  description: z.string().max(1000).optional(),
})
export type CreateInventoryItemGroupDto = z.infer<typeof CreateInventoryItemGroupSchema>
export const UpdateInventoryItemGroupSchema = CreateInventoryItemGroupSchema.partial().extend({
  isActive: z.boolean().optional(),
})
export type UpdateInventoryItemGroupDto = z.infer<typeof UpdateInventoryItemGroupSchema>

export interface InventoryUnit {
  id: string
  organizationId: string
  name: string
  symbol: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export const CreateInventoryUnitSchema = z.object({
  name: z.string().min(1).max(100),
  symbol: z.string().min(1).max(20),
})
export type CreateInventoryUnitDto = z.infer<typeof CreateInventoryUnitSchema>
export const UpdateInventoryUnitSchema = CreateInventoryUnitSchema.partial().extend({
  isActive: z.boolean().optional(),
})
export type UpdateInventoryUnitDto = z.infer<typeof UpdateInventoryUnitSchema>

export interface InventoryManufacturer {
  id: string
  organizationId: string
  name: string
  contactPerson: string | null
  phone: string | null
  email: string | null
  address: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export const CreateInventoryManufacturerSchema = z.object({
  name: z.string().min(1).max(200),
  contactPerson: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  email: optionalString(z.string().email()),
  address: z.string().max(500).optional(),
})
export type CreateInventoryManufacturerDto = z.infer<typeof CreateInventoryManufacturerSchema>
export const UpdateInventoryManufacturerSchema = CreateInventoryManufacturerSchema.partial().extend({
  isActive: z.boolean().optional(),
})
export type UpdateInventoryManufacturerDto = z.infer<typeof UpdateInventoryManufacturerSchema>

export interface InventoryBrand {
  id: string
  organizationId: string
  manufacturerId: string | null
  name: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export const CreateInventoryBrandSchema = z.object({
  manufacturerId: z.string().cuid().optional(),
  name: z.string().min(1).max(200),
})
export type CreateInventoryBrandDto = z.infer<typeof CreateInventoryBrandSchema>
export const UpdateInventoryBrandSchema = CreateInventoryBrandSchema.partial().extend({
  isActive: z.boolean().optional(),
})
export type UpdateInventoryBrandDto = z.infer<typeof UpdateInventoryBrandSchema>

export interface InventoryItem {
  id: string
  organizationId: string
  categoryId: string | null
  itemGroupId: string | null
  unitId: string | null
  manufacturerId: string | null
  brandId: string | null
  name: string
  code: string
  description: string | null
  itemType: InventoryItemType
  hsnCode: string | null
  gstPercent: string
  barcodeValue: string | null
  qrCodeValue: string | null
  trackBatch: boolean
  trackSerial: boolean
  trackExpiry: boolean
  unitCost: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface InventoryItemWithRefs extends InventoryItem {
  category: { id: string; name: string } | null
  itemGroup: { id: string; name: string } | null
  unit: { id: string; name: string; symbol: string } | null
  manufacturer: { id: string; name: string } | null
  brand: { id: string; name: string } | null
}

export const CreateInventoryItemSchema = z.object({
  categoryId: z.string().cuid().optional(),
  itemGroupId: z.string().cuid().optional(),
  unitId: z.string().cuid().optional(),
  manufacturerId: z.string().cuid().optional(),
  brandId: z.string().cuid().optional(),
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50),
  description: z.string().max(1000).optional(),
  itemType: z.nativeEnum(InventoryItemType).default(InventoryItemType.CONSUMABLE),
  hsnCode: z.string().max(20).optional(),
  gstPercent: z.number().min(0).max(100).default(0),
  barcodeValue: z.string().max(200).optional(),
  qrCodeValue: z.string().max(500).optional(),
  trackBatch: z.boolean().default(false),
  trackSerial: z.boolean().default(false),
  trackExpiry: z.boolean().default(false),
  unitCost: z.number().nonnegative().default(0),
})
export type CreateInventoryItemDto = z.infer<typeof CreateInventoryItemSchema>

export const UpdateInventoryItemSchema = CreateInventoryItemSchema.partial().extend({
  isActive: z.boolean().optional(),
})
export type UpdateInventoryItemDto = z.infer<typeof UpdateInventoryItemSchema>

export interface InventoryItemQuery {
  search?: string
  categoryId?: string
  itemGroupId?: string
  itemType?: InventoryItemType
  isActive?: boolean
  page?: number
  limit?: number
  sortBy?: 'name' | 'code' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

// ─── Store Management ───────────────────────────────────────────────────────

export interface InventoryStore {
  id: string
  organizationId: string
  name: string
  code: string
  type: InventoryStoreType
  location: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export const CreateInventoryStoreSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50),
  type: z.nativeEnum(InventoryStoreType).default(InventoryStoreType.GENERAL),
  location: z.string().max(500).optional(),
})
export type CreateInventoryStoreDto = z.infer<typeof CreateInventoryStoreSchema>
export const UpdateInventoryStoreSchema = CreateInventoryStoreSchema.partial().extend({
  isActive: z.boolean().optional(),
})
export type UpdateInventoryStoreDto = z.infer<typeof UpdateInventoryStoreSchema>

export interface InventoryStoreManager {
  id: string
  organizationId: string
  storeId: string
  userId: string
  role: StoreManagerRole
  assignedByUserId: string
  assignedAt: Date
  user: { id: string; firstName: string; lastName: string; email: string }
}

export const AssignStoreManagerSchema = z.object({
  userId: z.string().cuid(),
  role: z.nativeEnum(StoreManagerRole).default(StoreManagerRole.STAFF),
})
export type AssignStoreManagerDto = z.infer<typeof AssignStoreManagerSchema>

// ─── Vendors ────────────────────────────────────────────────────────────────

export interface Vendor {
  id: string
  organizationId: string
  name: string
  code: string
  contactPerson: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  state: string | null
  pincode: string | null
  gstin: string | null
  pan: string | null
  bankName: string | null
  bankAccountNumber: string | null
  bankIfsc: string | null
  paymentTermsDays: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface VendorWithStats extends Vendor {
  averageRating: number | null
  totalRatings: number
  totalPurchaseOrders: number
  outstandingBalance: string
}

export const CreateVendorSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50),
  contactPerson: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  email: optionalString(z.string().email()),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: z.string().max(20).optional(),
  gstin: z.string().max(20).optional(),
  pan: z.string().max(20).optional(),
  bankName: z.string().max(200).optional(),
  bankAccountNumber: z.string().max(50).optional(),
  bankIfsc: z.string().max(20).optional(),
  paymentTermsDays: z.number().int().nonnegative().default(30),
})
export type CreateVendorDto = z.infer<typeof CreateVendorSchema>
export const UpdateVendorSchema = CreateVendorSchema.partial().extend({
  isActive: z.boolean().optional(),
})
export type UpdateVendorDto = z.infer<typeof UpdateVendorSchema>

export interface VendorQuery {
  search?: string
  isActive?: boolean
  page?: number
  limit?: number
  sortBy?: 'name' | 'code' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

export interface VendorRating {
  id: string
  organizationId: string
  vendorId: string
  rating: number
  comments: string | null
  ratedByUserId: string
  ratedAt: Date
}

export const RateVendorSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comments: z.string().max(1000).optional(),
})
export type RateVendorDto = z.infer<typeof RateVendorSchema>

// ─── Stock ──────────────────────────────────────────────────────────────────

export interface InventoryBatch {
  id: string
  organizationId: string
  itemId: string
  storeId: string
  inventoryStockId: string
  batchNumber: string | null
  serialNumber: string | null
  manufactureDate: Date | null
  expiryDate: Date | null
  quantity: number
  status: InventoryBatchStatus
  receivedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface InventoryStock {
  id: string
  organizationId: string
  itemId: string
  storeId: string
  currentStock: number
  reservedStock: number
  damagedStock: number
  expiredStock: number
  lostStock: number
  availableStock: number
  reorderLevel: number
  minStock: number
  maxStock: number
  openingStock: number
  openingStockDate: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface InventoryStockWithRefs extends InventoryStock {
  item: { id: string; name: string; code: string; trackBatch: boolean; trackExpiry: boolean; trackSerial: boolean }
  store: { id: string; name: string; code: string }
  batches: InventoryBatch[]
}

export const SetOpeningStockSchema = z.object({
  itemId: z.string().cuid(),
  storeId: z.string().cuid(),
  quantity: z.number().int().nonnegative(),
  reorderLevel: z.number().int().nonnegative().default(0),
  minStock: z.number().int().nonnegative().default(0),
  maxStock: z.number().int().nonnegative().default(0),
  batchNumber: z.string().max(100).optional(),
  serialNumber: z.string().max(100).optional(),
  expiryDate: z.coerce.date().optional(),
})
export type SetOpeningStockDto = z.infer<typeof SetOpeningStockSchema>

export const UpdateStockLevelsSchema = z.object({
  reorderLevel: z.number().int().nonnegative().optional(),
  minStock: z.number().int().nonnegative().optional(),
  maxStock: z.number().int().nonnegative().optional(),
})
export type UpdateStockLevelsDto = z.infer<typeof UpdateStockLevelsSchema>

export const AdjustStockSchema = z.object({
  itemId: z.string().cuid(),
  storeId: z.string().cuid(),
  batchId: z.string().cuid().optional(),
  type: z.enum(['DAMAGE', 'LOSS', 'EXPIRY', 'CORRECTION']),
  quantityDelta: z.number().int().refine((v) => v !== 0, 'Quantity must not be zero'),
  reason: z.string().max(500).optional(),
})
export type AdjustStockDto = z.infer<typeof AdjustStockSchema>

export interface InventoryStockQuery {
  storeId?: string
  itemId?: string
  lowStockOnly?: boolean
  expiringWithinDays?: number
  page?: number
  limit?: number
}

export const CreateStockTransferSchema = z.object({
  fromStoreId: z.string().cuid(),
  toStoreId: z.string().cuid(),
  notes: z.string().max(1000).optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().cuid(),
        batchId: z.string().cuid().optional(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
})
export type CreateStockTransferDto = z.infer<typeof CreateStockTransferSchema>

export interface InventoryStockTransferItem {
  id: string
  transferId: string
  itemId: string
  batchId: string | null
  quantity: number
}

export interface InventoryStockTransfer {
  id: string
  organizationId: string
  transferNumber: string
  fromStoreId: string
  toStoreId: string
  status: StockTransferStatus
  requestedByUserId: string
  dispatchedByUserId: string | null
  dispatchedAt: Date | null
  receivedByUserId: string | null
  receivedAt: Date | null
  cancelReason: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
  items: InventoryStockTransferItem[]
}

export interface InventoryStockTransferQuery {
  storeId?: string
  status?: StockTransferStatus
  page?: number
  limit?: number
}
