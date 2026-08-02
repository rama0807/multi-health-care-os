import { z } from 'zod'

import { DispenseStatus } from './enums'

// ─── Drug Catalog ──────────────────────────────────────────────────────────

/**
 * Org-scoped pharmacy catalog — see ADR-0014. One row is one batch of a
 * drug (batch number/expiry are catalog fields, not a separate table).
 * `price`/`taxPercent` are Prisma `Decimal` on the wire — serialized as
 * strings, same convention as `RadiologyCatalogItem.price`.
 */
export interface Drug {
  id: string
  organizationId: string
  genericName: string
  brandName: string | null
  strength: string | null
  dosageForm: string
  manufacturer: string | null
  batchNumber: string
  expiryDate: Date
  price: string
  taxPercent: string
  isActive: boolean
  currentStock: number
  reservedStock: number
  availableStock: number
  minStockLevel: number
  reorderLevel: number
  createdAt: Date
  updatedAt: Date
}

export const CreateDrugSchema = z.object({
  genericName: z.string().min(1).max(200),
  brandName: z.string().max(200).optional(),
  strength: z.string().max(100).optional(),
  dosageForm: z.string().min(1).max(100),
  manufacturer: z.string().max(200).optional(),
  batchNumber: z.string().min(1).max(100),
  expiryDate: z.coerce.date(),
  price: z.number().nonnegative(),
  taxPercent: z.number().min(0).max(100).default(0),
  currentStock: z.number().int().nonnegative().default(0),
  minStockLevel: z.number().int().nonnegative().default(10),
  reorderLevel: z.number().int().nonnegative().default(20),
})

export type CreateDrugDto = z.infer<typeof CreateDrugSchema>

export const UpdateDrugSchema = z.object({
  genericName: z.string().min(1).max(200).optional(),
  brandName: z.string().max(200).optional(),
  strength: z.string().max(100).optional(),
  dosageForm: z.string().min(1).max(100).optional(),
  manufacturer: z.string().max(200).optional(),
  batchNumber: z.string().min(1).max(100).optional(),
  expiryDate: z.coerce.date().optional(),
  price: z.number().nonnegative().optional(),
  taxPercent: z.number().min(0).max(100).optional(),
  minStockLevel: z.number().int().nonnegative().optional(),
  reorderLevel: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
})

export type UpdateDrugDto = z.infer<typeof UpdateDrugSchema>

/** Adds physical stock to an existing batch row (a fresh delivery of the same batch). */
export const AdjustDrugStockSchema = z.object({
  quantity: z.number().int().refine((v) => v !== 0, 'Quantity must not be zero'),
  reason: z.string().max(500).optional(),
})

export type AdjustDrugStockDto = z.infer<typeof AdjustDrugStockSchema>

export interface DrugQuery {
  search?: string
  isActive?: boolean
  lowStockOnly?: boolean
  expiringWithinDays?: number
  page?: number
  limit?: number
  sortBy?: 'genericName' | 'expiryDate' | 'currentStock' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

// ─── Dispensing ────────────────────────────────────────────────────────────

export interface DispenseItem {
  id: string
  dispenseOrderId: string
  prescriptionItemId: string
  drugId: string | null
  medicationName: string
  quantityRequested: number
  quantityDispensed: number
  createdAt: Date
  updatedAt: Date
}

export interface DispenseItemWithDrug extends DispenseItem {
  drug: { id: string; genericName: string; brandName: string | null; batchNumber: string; expiryDate: Date } | null
}

export interface DrugReturn {
  id: string
  dispenseOrderId: string
  dispenseItemId: string
  drugId: string | null
  organizationId: string
  quantityReturned: number
  reason: string
  returnedByUserId: string
  returnedAt: Date
}

export interface DispenseOrder {
  id: string
  dispenseNumber: string
  prescriptionId: string
  patientId: string
  organizationId: string
  status: DispenseStatus
  preparedByUserId: string | null
  dispensedByUserId: string | null
  dispensedAt: Date | null
  rejected: boolean
  cancelReason: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export interface DispenseOrderWithDetails extends DispenseOrder {
  patient: { id: string; fullName: string; uhid: string }
  prescription: { id: string; prescriptionNumber: string; doctorId: string; doctorFullName: string }
  items: DispenseItemWithDrug[]
  returns: DrugReturn[]
}

export const CreateDispenseOrderSchema = z.object({
  prescriptionId: z.string().cuid(),
  notes: z.string().max(1000).optional(),
})

export type CreateDispenseOrderDto = z.infer<typeof CreateDispenseOrderSchema>

/** "Batch selection" — resolves one or more items to a catalog `Drug` (batch) and reserves stock. */
export const PrepareDispenseItemsSchema = z.object({
  items: z
    .array(
      z.object({
        dispenseItemId: z.string().cuid(),
        drugId: z.string().cuid(),
      }),
    )
    .min(1),
})

export type PrepareDispenseItemsDto = z.infer<typeof PrepareDispenseItemsSchema>

export const DispensePartialSchema = z.object({
  items: z
    .array(
      z.object({
        dispenseItemId: z.string().cuid(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
})

export type DispensePartialDto = z.infer<typeof DispensePartialSchema>

export const CancelDispenseOrderSchema = z.object({
  reason: z.string().max(500).optional(),
})

export type CancelDispenseOrderDto = z.infer<typeof CancelDispenseOrderSchema>

export const CreateDrugReturnSchema = z.object({
  dispenseItemId: z.string().cuid(),
  quantityReturned: z.number().int().positive(),
  reason: z.string().min(1).max(500),
})

export type CreateDrugReturnDto = z.infer<typeof CreateDrugReturnSchema>

export interface DispenseOrderQuery {
  patientId?: string
  status?: DispenseStatus
  page?: number
  limit?: number
  sortBy?: 'createdAt' | 'dispensedAt'
  sortOrder?: 'asc' | 'desc'
}

export interface PharmacyDashboardStats {
  pending: number
  ready: number
  dispensedToday: number
  lowStock: number
  expiringSoon: number
}
