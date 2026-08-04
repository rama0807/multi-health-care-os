import type {
  AssignAssetDto,
  Asset,
  AssetAssignment,
  AssetMaintenanceRecord,
  AssetQuery,
  CancelPurchaseOrderDto,
  CompleteMaintenanceRecordDto,
  CreateAssetDto,
  CreateGoodsReceiptNoteDto,
  CreateMaintenanceRecordDto,
  CreatePurchaseOrderDto,
  CreatePurchaseRequestDto,
  CreateStockAuditDto,
  CreateStoreRequisitionDto,
  CreateVendorInvoiceDto,
  GoodsReceiptNote,
  GoodsReceiptQuery,
  IssueStoreRequisitionDto,
  PaginatedResponse,
  PurchaseOrder,
  PurchaseOrderQuery,
  PurchaseRequest,
  PurchaseRequestQuery,
  ReceiveStoreRequisitionDto,
  RecordAuditCountDto,
  RecordVendorInvoicePaymentDto,
  RejectPurchaseRequestDto,
  RejectStoreRequisitionDto,
  StockAudit,
  StockAuditQuery,
  StoreRequisition,
  StoreRequisitionQuery,
  UpdateAssetDto,
  UpdateVendorInvoiceStatusDto,
  VendorInvoice,
  VendorInvoiceQuery,
} from '@medicore/types'

import { apiClient } from './client'

// ─── Purchase Requests ─────────────────────────────────────────────────────────

export async function listPurchaseRequests(
  query: PurchaseRequestQuery = {},
): Promise<PaginatedResponse<PurchaseRequest>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<PurchaseRequest> }>('/inventory/purchase-requests', {
    params: query,
  })
  return data.data
}

export async function getPurchaseRequest(id: string): Promise<PurchaseRequest> {
  const { data } = await apiClient.get<{ data: PurchaseRequest }>(`/inventory/purchase-requests/${id}`)
  return data.data
}

export async function createPurchaseRequest(dto: CreatePurchaseRequestDto): Promise<PurchaseRequest> {
  const { data } = await apiClient.post<{ data: PurchaseRequest }>('/inventory/purchase-requests', dto)
  return data.data
}

export async function submitPurchaseRequest(id: string): Promise<PurchaseRequest> {
  const { data } = await apiClient.post<{ data: PurchaseRequest }>(`/inventory/purchase-requests/${id}/submit`)
  return data.data
}

export async function approvePurchaseRequest(id: string): Promise<PurchaseRequest> {
  const { data } = await apiClient.post<{ data: PurchaseRequest }>(`/inventory/purchase-requests/${id}/approve`)
  return data.data
}

export async function rejectPurchaseRequest(id: string, dto: RejectPurchaseRequestDto): Promise<PurchaseRequest> {
  const { data } = await apiClient.post<{ data: PurchaseRequest }>(`/inventory/purchase-requests/${id}/reject`, dto)
  return data.data
}

export async function cancelPurchaseRequest(id: string): Promise<PurchaseRequest> {
  const { data } = await apiClient.post<{ data: PurchaseRequest }>(`/inventory/purchase-requests/${id}/cancel`)
  return data.data
}

// ─── Purchase Orders ───────────────────────────────────────────────────────────

export async function listPurchaseOrders(query: PurchaseOrderQuery = {}): Promise<PaginatedResponse<PurchaseOrder>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<PurchaseOrder> }>('/inventory/purchase-orders', {
    params: query,
  })
  return data.data
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const { data } = await apiClient.get<{ data: PurchaseOrder }>(`/inventory/purchase-orders/${id}`)
  return data.data
}

export async function createPurchaseOrder(dto: CreatePurchaseOrderDto): Promise<PurchaseOrder> {
  const { data } = await apiClient.post<{ data: PurchaseOrder }>('/inventory/purchase-orders', dto)
  return data.data
}

export async function submitPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const { data } = await apiClient.post<{ data: PurchaseOrder }>(`/inventory/purchase-orders/${id}/submit`)
  return data.data
}

export async function approvePurchaseOrder(id: string): Promise<PurchaseOrder> {
  const { data } = await apiClient.post<{ data: PurchaseOrder }>(`/inventory/purchase-orders/${id}/approve`)
  return data.data
}

export async function sendPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const { data } = await apiClient.post<{ data: PurchaseOrder }>(`/inventory/purchase-orders/${id}/send`)
  return data.data
}

export async function cancelPurchaseOrder(id: string, dto: CancelPurchaseOrderDto): Promise<PurchaseOrder> {
  const { data } = await apiClient.post<{ data: PurchaseOrder }>(`/inventory/purchase-orders/${id}/cancel`, dto)
  return data.data
}

// ─── Goods Receipt Notes ───────────────────────────────────────────────────────

export async function listGoodsReceiptNotes(query: GoodsReceiptQuery = {}): Promise<PaginatedResponse<GoodsReceiptNote>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<GoodsReceiptNote> }>('/inventory/grn', { params: query })
  return data.data
}

export async function getGoodsReceiptNote(id: string): Promise<GoodsReceiptNote> {
  const { data } = await apiClient.get<{ data: GoodsReceiptNote }>(`/inventory/grn/${id}`)
  return data.data
}

export async function createGoodsReceiptNote(dto: CreateGoodsReceiptNoteDto): Promise<GoodsReceiptNote> {
  const { data } = await apiClient.post<{ data: GoodsReceiptNote }>('/inventory/grn', dto)
  return data.data
}

export async function completeGoodsReceiptNote(id: string): Promise<GoodsReceiptNote> {
  const { data } = await apiClient.post<{ data: GoodsReceiptNote }>(`/inventory/grn/${id}/complete`)
  return data.data
}

export async function cancelGoodsReceiptNote(id: string): Promise<GoodsReceiptNote> {
  const { data } = await apiClient.post<{ data: GoodsReceiptNote }>(`/inventory/grn/${id}/cancel`)
  return data.data
}

// ─── Vendor Invoices ────────────────────────────────────────────────────────────

export async function listVendorInvoices(query: VendorInvoiceQuery = {}): Promise<PaginatedResponse<VendorInvoice>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<VendorInvoice> }>('/inventory/vendor-invoices', {
    params: query,
  })
  return data.data
}

export async function getVendorInvoice(id: string): Promise<VendorInvoice> {
  const { data } = await apiClient.get<{ data: VendorInvoice }>(`/inventory/vendor-invoices/${id}`)
  return data.data
}

export async function createVendorInvoice(dto: CreateVendorInvoiceDto): Promise<VendorInvoice> {
  const { data } = await apiClient.post<{ data: VendorInvoice }>('/inventory/vendor-invoices', dto)
  return data.data
}

export async function recordVendorInvoicePayment(
  id: string,
  dto: RecordVendorInvoicePaymentDto,
): Promise<VendorInvoice> {
  const { data } = await apiClient.post<{ data: VendorInvoice }>(`/inventory/vendor-invoices/${id}/payments`, dto)
  return data.data
}

export async function updateVendorInvoiceStatus(id: string, dto: UpdateVendorInvoiceStatusDto): Promise<VendorInvoice> {
  const { data } = await apiClient.post<{ data: VendorInvoice }>(`/inventory/vendor-invoices/${id}/status`, dto)
  return data.data
}

// ─── Store Requisitions ─────────────────────────────────────────────────────────

export async function listStoreRequisitions(
  query: StoreRequisitionQuery = {},
): Promise<PaginatedResponse<StoreRequisition>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<StoreRequisition> }>('/inventory/requisitions', {
    params: query,
  })
  return data.data
}

export async function getStoreRequisition(id: string): Promise<StoreRequisition> {
  const { data } = await apiClient.get<{ data: StoreRequisition }>(`/inventory/requisitions/${id}`)
  return data.data
}

export async function createStoreRequisition(dto: CreateStoreRequisitionDto): Promise<StoreRequisition> {
  const { data } = await apiClient.post<{ data: StoreRequisition }>('/inventory/requisitions', dto)
  return data.data
}

export async function approveStoreRequisition(id: string): Promise<StoreRequisition> {
  const { data } = await apiClient.post<{ data: StoreRequisition }>(`/inventory/requisitions/${id}/approve`)
  return data.data
}

export async function rejectStoreRequisition(id: string, dto: RejectStoreRequisitionDto): Promise<StoreRequisition> {
  const { data } = await apiClient.post<{ data: StoreRequisition }>(`/inventory/requisitions/${id}/reject`, dto)
  return data.data
}

export async function issueStoreRequisition(id: string, dto: IssueStoreRequisitionDto): Promise<StoreRequisition> {
  const { data } = await apiClient.post<{ data: StoreRequisition }>(`/inventory/requisitions/${id}/issue`, dto)
  return data.data
}

export async function receiveStoreRequisition(id: string, dto: ReceiveStoreRequisitionDto): Promise<StoreRequisition> {
  const { data } = await apiClient.post<{ data: StoreRequisition }>(`/inventory/requisitions/${id}/receive`, dto)
  return data.data
}

export async function cancelStoreRequisition(id: string): Promise<StoreRequisition> {
  const { data } = await apiClient.post<{ data: StoreRequisition }>(`/inventory/requisitions/${id}/cancel`)
  return data.data
}

// ─── Stock Audits ───────────────────────────────────────────────────────────────

export async function listStockAudits(query: StockAuditQuery = {}): Promise<PaginatedResponse<StockAudit>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<StockAudit> }>('/inventory/audits', { params: query })
  return data.data
}

export async function getStockAudit(id: string): Promise<StockAudit> {
  const { data } = await apiClient.get<{ data: StockAudit }>(`/inventory/audits/${id}`)
  return data.data
}

export async function createStockAudit(dto: CreateStockAuditDto): Promise<StockAudit> {
  const { data } = await apiClient.post<{ data: StockAudit }>('/inventory/audits', dto)
  return data.data
}

export async function startStockAudit(id: string): Promise<StockAudit> {
  const { data } = await apiClient.post<{ data: StockAudit }>(`/inventory/audits/${id}/start`)
  return data.data
}

export async function recordStockAuditCounts(id: string, dto: RecordAuditCountDto): Promise<StockAudit> {
  const { data } = await apiClient.post<{ data: StockAudit }>(`/inventory/audits/${id}/counts`, dto)
  return data.data
}

export async function completeStockAudit(id: string): Promise<StockAudit> {
  const { data } = await apiClient.post<{ data: StockAudit }>(`/inventory/audits/${id}/complete`)
  return data.data
}

export async function cancelStockAudit(id: string): Promise<StockAudit> {
  const { data } = await apiClient.post<{ data: StockAudit }>(`/inventory/audits/${id}/cancel`)
  return data.data
}

// ─── Assets & Maintenance ───────────────────────────────────────────────────────

export async function listAssets(query: AssetQuery = {}): Promise<PaginatedResponse<Asset>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<Asset> }>('/inventory/assets', { params: query })
  return data.data
}

export async function getAsset(id: string): Promise<Asset> {
  const { data } = await apiClient.get<{ data: Asset }>(`/inventory/assets/${id}`)
  return data.data
}

export async function createAsset(dto: CreateAssetDto): Promise<Asset> {
  const { data } = await apiClient.post<{ data: Asset }>('/inventory/assets', dto)
  return data.data
}

export async function updateAsset(id: string, dto: UpdateAssetDto): Promise<Asset> {
  const { data } = await apiClient.patch<{ data: Asset }>(`/inventory/assets/${id}`, dto)
  return data.data
}

export async function assignAsset(id: string, dto: AssignAssetDto): Promise<Asset> {
  const { data } = await apiClient.post<{ data: Asset }>(`/inventory/assets/${id}/assign`, dto)
  return data.data
}

export async function listAssetAssignments(id: string): Promise<AssetAssignment[]> {
  const { data } = await apiClient.get<{ data: AssetAssignment[] }>(`/inventory/assets/${id}/assignments`)
  return data.data
}

export async function listAssetMaintenanceRecords(id: string): Promise<AssetMaintenanceRecord[]> {
  const { data } = await apiClient.get<{ data: AssetMaintenanceRecord[] }>(`/inventory/assets/${id}/maintenance`)
  return data.data
}

export async function createAssetMaintenanceRecord(
  id: string,
  dto: CreateMaintenanceRecordDto,
): Promise<AssetMaintenanceRecord> {
  const { data } = await apiClient.post<{ data: AssetMaintenanceRecord }>(`/inventory/assets/${id}/maintenance`, dto)
  return data.data
}

export async function completeAssetMaintenanceRecord(
  id: string,
  recordId: string,
  dto: CompleteMaintenanceRecordDto,
): Promise<AssetMaintenanceRecord> {
  const { data } = await apiClient.post<{ data: AssetMaintenanceRecord }>(
    `/inventory/assets/${id}/maintenance/${recordId}/complete`,
    dto,
  )
  return data.data
}
