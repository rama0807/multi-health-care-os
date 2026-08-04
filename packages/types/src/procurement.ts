import { z } from 'zod'

import {
  AssetMaintenanceStatus,
  AssetMaintenanceType,
  AssetStatus,
  GrnStatus,
  Priority,
  PurchaseOrderStatus,
  PurchaseRequestStatus,
  RequisitionStatus,
  StockAuditStatus,
  VendorInvoiceStatus,
  VendorReturnStatus,
} from './enums'

// ─── Purchase Requests ──────────────────────────────────────────────────────

export interface PurchaseRequestItem {
  id: string
  purchaseRequestId: string
  itemId: string
  quantity: number
  notes: string | null
  item: { id: string; name: string; code: string }
}

export interface PurchaseRequest {
  id: string
  organizationId: string
  requestNumber: string
  storeId: string
  requestedByUserId: string
  status: PurchaseRequestStatus
  notes: string | null
  approvedByUserId: string | null
  approvedAt: Date | null
  rejectionReason: string | null
  createdAt: Date
  updatedAt: Date
  store: { id: string; name: string; code: string }
  items: PurchaseRequestItem[]
}

export const CreatePurchaseRequestSchema = z.object({
  storeId: z.string().cuid(),
  notes: z.string().max(1000).optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().cuid(),
        quantity: z.number().int().positive(),
        notes: z.string().max(500).optional(),
      }),
    )
    .min(1),
})
export type CreatePurchaseRequestDto = z.infer<typeof CreatePurchaseRequestSchema>

export const RejectPurchaseRequestSchema = z.object({ reason: z.string().min(1).max(500) })
export type RejectPurchaseRequestDto = z.infer<typeof RejectPurchaseRequestSchema>

export interface PurchaseRequestQuery {
  storeId?: string
  status?: PurchaseRequestStatus
  page?: number
  limit?: number
}

// ─── Purchase Orders ────────────────────────────────────────────────────────

export interface PurchaseOrderItem {
  id: string
  purchaseOrderId: string
  itemId: string
  quantityOrdered: number
  quantityReceived: number
  unitPrice: string
  taxPercent: string
  item: { id: string; name: string; code: string }
}

export interface PurchaseOrder {
  id: string
  organizationId: string
  poNumber: string
  vendorId: string
  storeId: string
  purchaseRequestId: string | null
  status: PurchaseOrderStatus
  expectedDeliveryDate: Date | null
  approvedByUserId: string | null
  approvedAt: Date | null
  cancelReason: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
  vendor: { id: string; name: string; code: string }
  store: { id: string; name: string; code: string }
  items: PurchaseOrderItem[]
  totalAmount: string
}

export const CreatePurchaseOrderSchema = z.object({
  vendorId: z.string().cuid(),
  storeId: z.string().cuid(),
  purchaseRequestId: z.string().cuid().optional(),
  expectedDeliveryDate: z.coerce.date().optional(),
  notes: z.string().max(1000).optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().cuid(),
        quantityOrdered: z.number().int().positive(),
        unitPrice: z.number().nonnegative(),
        taxPercent: z.number().min(0).max(100).default(0),
      }),
    )
    .min(1),
})
export type CreatePurchaseOrderDto = z.infer<typeof CreatePurchaseOrderSchema>

export const CancelPurchaseOrderSchema = z.object({ reason: z.string().min(1).max(500) })
export type CancelPurchaseOrderDto = z.infer<typeof CancelPurchaseOrderSchema>

export interface PurchaseOrderQuery {
  vendorId?: string
  storeId?: string
  status?: PurchaseOrderStatus
  page?: number
  limit?: number
}

// ─── Goods Receipt Notes ────────────────────────────────────────────────────

export interface GoodsReceiptItem {
  id: string
  goodsReceiptNoteId: string
  purchaseOrderItemId: string
  itemId: string
  quantityReceived: number
  batchNumber: string | null
  serialNumber: string | null
  manufactureDate: Date | null
  expiryDate: Date | null
  unitPrice: string
  item: { id: string; name: string; code: string }
}

export interface GoodsReceiptNote {
  id: string
  organizationId: string
  grnNumber: string
  purchaseOrderId: string
  storeId: string
  receivedByUserId: string
  status: GrnStatus
  receivedAt: Date
  notes: string | null
  createdAt: Date
  updatedAt: Date
  purchaseOrder: { id: string; poNumber: string }
  store: { id: string; name: string; code: string }
  items: GoodsReceiptItem[]
}

export const CreateGoodsReceiptNoteSchema = z.object({
  purchaseOrderId: z.string().cuid(),
  notes: z.string().max(1000).optional(),
  items: z
    .array(
      z.object({
        purchaseOrderItemId: z.string().cuid(),
        quantityReceived: z.number().int().positive(),
        batchNumber: z.string().max(100).optional(),
        serialNumber: z.string().max(100).optional(),
        manufactureDate: z.coerce.date().optional(),
        expiryDate: z.coerce.date().optional(),
        unitPrice: z.number().nonnegative(),
      }),
    )
    .min(1),
})
export type CreateGoodsReceiptNoteDto = z.infer<typeof CreateGoodsReceiptNoteSchema>

export interface GoodsReceiptQuery {
  storeId?: string
  purchaseOrderId?: string
  status?: GrnStatus
  page?: number
  limit?: number
}

// ─── Vendor Invoices ────────────────────────────────────────────────────────

export interface VendorInvoice {
  id: string
  organizationId: string
  invoiceNumber: string
  vendorId: string
  purchaseOrderId: string | null
  goodsReceiptNoteId: string | null
  invoiceDate: Date
  dueDate: Date | null
  amount: string
  taxAmount: string
  totalAmount: string
  paidAmount: string
  status: VendorInvoiceStatus
  notes: string | null
  createdAt: Date
  updatedAt: Date
  vendor: { id: string; name: string; code: string }
}

export const CreateVendorInvoiceSchema = z.object({
  vendorId: z.string().cuid(),
  purchaseOrderId: z.string().cuid().optional(),
  goodsReceiptNoteId: z.string().cuid().optional(),
  invoiceNumber: z.string().min(1).max(100),
  invoiceDate: z.coerce.date(),
  dueDate: z.coerce.date().optional(),
  amount: z.number().nonnegative(),
  taxAmount: z.number().nonnegative().default(0),
  notes: z.string().max(1000).optional(),
})
export type CreateVendorInvoiceDto = z.infer<typeof CreateVendorInvoiceSchema>

export const RecordVendorInvoicePaymentSchema = z.object({ amount: z.number().positive() })
export type RecordVendorInvoicePaymentDto = z.infer<typeof RecordVendorInvoicePaymentSchema>

export const UpdateVendorInvoiceStatusSchema = z.object({
  status: z.nativeEnum(VendorInvoiceStatus),
})
export type UpdateVendorInvoiceStatusDto = z.infer<typeof UpdateVendorInvoiceStatusSchema>

export interface VendorInvoiceQuery {
  vendorId?: string
  status?: VendorInvoiceStatus
  page?: number
  limit?: number
}

// ─── Vendor Returns ─────────────────────────────────────────────────────────

export interface VendorReturnItem {
  id: string
  vendorReturnId: string
  itemId: string
  batchId: string | null
  quantity: number
  unitPrice: string
  item: { id: string; name: string; code: string }
}

export interface VendorReturn {
  id: string
  organizationId: string
  returnNumber: string
  vendorId: string
  goodsReceiptNoteId: string | null
  storeId: string
  reason: string
  status: VendorReturnStatus
  returnedByUserId: string
  createdAt: Date
  updatedAt: Date
  vendor: { id: string; name: string; code: string }
  items: VendorReturnItem[]
}

export const CreateVendorReturnSchema = z.object({
  vendorId: z.string().cuid(),
  goodsReceiptNoteId: z.string().cuid().optional(),
  storeId: z.string().cuid(),
  reason: z.string().min(1).max(500),
  items: z
    .array(
      z.object({
        itemId: z.string().cuid(),
        batchId: z.string().cuid().optional(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().nonnegative().default(0),
      }),
    )
    .min(1),
})
export type CreateVendorReturnDto = z.infer<typeof CreateVendorReturnSchema>

// ─── Internal Requests (Store Requisitions) ────────────────────────────────

export interface StoreRequisitionItem {
  id: string
  storeRequisitionId: string
  itemId: string
  batchId: string | null
  quantityRequested: number
  quantityIssued: number
  quantityReceived: number
  item: { id: string; name: string; code: string }
}

export interface StoreRequisition {
  id: string
  organizationId: string
  requisitionNumber: string
  fromStoreId: string
  toStoreId: string
  requestedByUserId: string
  status: RequisitionStatus
  priority: Priority
  notes: string | null
  approvedByUserId: string | null
  approvedAt: Date | null
  rejectionReason: string | null
  issuedByUserId: string | null
  issuedAt: Date | null
  receivedByUserId: string | null
  receivedAt: Date | null
  cancelReason: string | null
  createdAt: Date
  updatedAt: Date
  fromStore: { id: string; name: string; code: string }
  toStore: { id: string; name: string; code: string }
  items: StoreRequisitionItem[]
}

export const CreateStoreRequisitionSchema = z.object({
  fromStoreId: z.string().cuid(),
  toStoreId: z.string().cuid(),
  priority: z.nativeEnum(Priority).default(Priority.ROUTINE),
  notes: z.string().max(1000).optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().cuid(),
        quantityRequested: z.number().int().positive(),
      }),
    )
    .min(1),
})
export type CreateStoreRequisitionDto = z.infer<typeof CreateStoreRequisitionSchema>

export const RejectStoreRequisitionSchema = z.object({ reason: z.string().min(1).max(500) })
export type RejectStoreRequisitionDto = z.infer<typeof RejectStoreRequisitionSchema>

export const IssueStoreRequisitionSchema = z.object({
  items: z
    .array(
      z.object({
        storeRequisitionItemId: z.string().cuid(),
        quantityIssued: z.number().int().positive(),
        batchId: z.string().cuid().optional(),
      }),
    )
    .min(1),
})
export type IssueStoreRequisitionDto = z.infer<typeof IssueStoreRequisitionSchema>

export const ReceiveStoreRequisitionSchema = z.object({
  items: z
    .array(
      z.object({
        storeRequisitionItemId: z.string().cuid(),
        quantityReceived: z.number().int().positive(),
      }),
    )
    .min(1),
})
export type ReceiveStoreRequisitionDto = z.infer<typeof ReceiveStoreRequisitionSchema>

export interface StoreRequisitionQuery {
  fromStoreId?: string
  toStoreId?: string
  status?: RequisitionStatus
  page?: number
  limit?: number
}

// ─── Asset Management ───────────────────────────────────────────────────────

export interface Asset {
  id: string
  organizationId: string
  itemId: string
  storeId: string
  assetTag: string
  serialNumber: string | null
  status: AssetStatus
  purchaseDate: Date | null
  purchasePrice: string | null
  warrantyExpiryDate: Date | null
  amcVendorId: string | null
  amcStartDate: Date | null
  amcEndDate: Date | null
  lastCalibrationDate: Date | null
  nextCalibrationDate: Date | null
  assignedToUserId: string | null
  assignedToDepartmentId: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
  item: { id: string; name: string; code: string }
  store: { id: string; name: string; code: string }
}

export const CreateAssetSchema = z.object({
  itemId: z.string().cuid(),
  storeId: z.string().cuid(),
  assetTag: z.string().min(1).max(100),
  serialNumber: z.string().max(100).optional(),
  purchaseDate: z.coerce.date().optional(),
  purchasePrice: z.number().nonnegative().optional(),
  warrantyExpiryDate: z.coerce.date().optional(),
  amcVendorId: z.string().cuid().optional(),
  amcStartDate: z.coerce.date().optional(),
  amcEndDate: z.coerce.date().optional(),
  nextCalibrationDate: z.coerce.date().optional(),
  notes: z.string().max(1000).optional(),
})
export type CreateAssetDto = z.infer<typeof CreateAssetSchema>

export const UpdateAssetSchema = CreateAssetSchema.partial().extend({
  status: z.nativeEnum(AssetStatus).optional(),
  lastCalibrationDate: z.coerce.date().optional(),
})
export type UpdateAssetDto = z.infer<typeof UpdateAssetSchema>

export const AssignAssetSchema = z.object({
  assignedToUserId: z.string().cuid().optional(),
  assignedToDepartmentId: z.string().cuid().optional(),
  storeId: z.string().cuid().optional(),
  notes: z.string().max(500).optional(),
})
export type AssignAssetDto = z.infer<typeof AssignAssetSchema>

export const CreateMaintenanceRecordSchema = z.object({
  type: z.nativeEnum(AssetMaintenanceType),
  scheduledDate: z.coerce.date().optional(),
  description: z.string().min(1).max(1000),
  cost: z.number().nonnegative().optional(),
  performedBy: z.string().max(200).optional(),
  vendorId: z.string().cuid().optional(),
})
export type CreateMaintenanceRecordDto = z.infer<typeof CreateMaintenanceRecordSchema>

export const CompleteMaintenanceRecordSchema = z.object({
  cost: z.number().nonnegative().optional(),
  performedBy: z.string().max(200).optional(),
})
export type CompleteMaintenanceRecordDto = z.infer<typeof CompleteMaintenanceRecordSchema>

export interface AssetMaintenanceRecord {
  id: string
  organizationId: string
  assetId: string
  type: AssetMaintenanceType
  status: AssetMaintenanceStatus
  scheduledDate: Date | null
  completedDate: Date | null
  description: string
  cost: string | null
  performedBy: string | null
  vendorId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface AssetAssignment {
  id: string
  organizationId: string
  assetId: string
  assignedToUserId: string | null
  assignedToDepartmentId: string | null
  storeId: string | null
  assignedByUserId: string
  assignedAt: Date
  returnedAt: Date | null
  notes: string | null
}

export interface AssetQuery {
  storeId?: string
  status?: AssetStatus
  itemId?: string
  search?: string
  page?: number
  limit?: number
}

// ─── Stock Audit ────────────────────────────────────────────────────────────

export interface StockAuditItem {
  id: string
  stockAuditId: string
  itemId: string
  batchId: string | null
  systemQuantity: number
  countedQuantity: number | null
  varianceQuantity: number | null
  remarks: string | null
  item: { id: string; name: string; code: string }
}

export interface StockAudit {
  id: string
  organizationId: string
  auditNumber: string
  storeId: string
  status: StockAuditStatus
  scheduledDate: Date | null
  startedAt: Date | null
  completedAt: Date | null
  conductedByUserId: string
  notes: string | null
  createdAt: Date
  updatedAt: Date
  store: { id: string; name: string; code: string }
  items: StockAuditItem[]
}

export const CreateStockAuditSchema = z.object({
  storeId: z.string().cuid(),
  scheduledDate: z.coerce.date().optional(),
  notes: z.string().max(1000).optional(),
  itemIds: z.array(z.string().cuid()).optional(),
})
export type CreateStockAuditDto = z.infer<typeof CreateStockAuditSchema>

export const RecordAuditCountSchema = z.object({
  items: z
    .array(
      z.object({
        stockAuditItemId: z.string().cuid(),
        countedQuantity: z.number().int().nonnegative(),
        remarks: z.string().max(500).optional(),
      }),
    )
    .min(1),
})
export type RecordAuditCountDto = z.infer<typeof RecordAuditCountSchema>

export interface StockAuditQuery {
  storeId?: string
  status?: StockAuditStatus
  page?: number
  limit?: number
}

// ─── Inventory Dashboard ────────────────────────────────────────────────────

export interface InventoryDashboardStats {
  totalItems: number
  totalStores: number
  inventoryValue: string
  lowStockCount: number
  expiringSoonCount: number
  expiredCount: number
  pendingPurchaseRequests: number
  pendingPurchaseOrders: number
  pendingGrns: number
  pendingRequisitions: number
  maintenanceDueCount: number
  assetsInBreakdown: number
}
