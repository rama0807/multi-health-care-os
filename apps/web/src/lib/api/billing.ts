import type {
  ApplyDiscountDto,
  BillingDashboardStats,
  CancelInvoiceDto,
  Charge,
  ChargeQuery,
  CreateChargeDto,
  CreateInvoiceDto,
  CreatePaymentDto,
  CreateRefundDto,
  CreateServiceCatalogItemDto,
  Invoice,
  InvoiceLineItemDto,
  InvoiceQuery,
  InvoiceWithDetails,
  PaginatedResponse,
  Payment,
  PaymentQuery,
  Refund,
  RefundQuery,
  RejectDiscountDto,
  RejectRefundDto,
  ServiceCatalogItem,
  ServiceCatalogItemQuery,
  UpdateServiceCatalogItemDto,
} from '@medicore/types'

import { apiClient } from './client'

// ─── Dashboard ─────────────────────────────────────────────────────────────

export async function getBillingDashboardStats(): Promise<BillingDashboardStats> {
  const { data } = await apiClient.get<{ data: BillingDashboardStats }>('/billing/dashboard-stats')
  return data.data
}

// ─── Service Catalog ───────────────────────────────────────────────────────

export async function listServiceCatalog(query: ServiceCatalogItemQuery = {}): Promise<PaginatedResponse<ServiceCatalogItem>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<ServiceCatalogItem> }>('/billing/catalog', { params: query })
  return data.data
}

export async function createServiceCatalogItem(dto: CreateServiceCatalogItemDto): Promise<ServiceCatalogItem> {
  const { data } = await apiClient.post<{ data: ServiceCatalogItem }>('/billing/catalog', dto)
  return data.data
}

export async function updateServiceCatalogItem(id: string, dto: UpdateServiceCatalogItemDto): Promise<ServiceCatalogItem> {
  const { data } = await apiClient.patch<{ data: ServiceCatalogItem }>(`/billing/catalog/${id}`, dto)
  return data.data
}

// ─── Charges ───────────────────────────────────────────────────────────────

export async function listCharges(query: ChargeQuery = {}): Promise<PaginatedResponse<Charge>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<Charge> }>('/billing/charges', { params: query })
  return data.data
}

export async function createCharge(dto: CreateChargeDto): Promise<Charge> {
  const { data } = await apiClient.post<{ data: Charge }>('/billing/charges', dto)
  return data.data
}

export async function voidCharge(id: string): Promise<Charge> {
  const { data } = await apiClient.post<{ data: Charge }>(`/billing/charges/${id}/void`, {})
  return data.data
}

// ─── Invoices ──────────────────────────────────────────────────────────────

export async function listInvoices(query: InvoiceQuery = {}): Promise<PaginatedResponse<InvoiceWithDetails>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<InvoiceWithDetails> }>('/billing/invoices', { params: query })
  return data.data
}

export async function getInvoice(id: string): Promise<InvoiceWithDetails> {
  const { data } = await apiClient.get<{ data: InvoiceWithDetails }>(`/billing/invoices/${id}`)
  return data.data
}

export async function createInvoice(dto: CreateInvoiceDto): Promise<InvoiceWithDetails> {
  const { data } = await apiClient.post<{ data: InvoiceWithDetails }>('/billing/invoices', dto)
  return data.data
}

export async function addInvoiceItem(id: string, dto: InvoiceLineItemDto): Promise<InvoiceWithDetails> {
  const { data } = await apiClient.post<{ data: InvoiceWithDetails }>(`/billing/invoices/${id}/items`, dto)
  return data.data
}

export async function applyInvoiceDiscount(id: string, dto: ApplyDiscountDto): Promise<InvoiceWithDetails> {
  const { data } = await apiClient.post<{ data: InvoiceWithDetails }>(`/billing/invoices/${id}/discount`, dto)
  return data.data
}

export async function approveInvoiceDiscount(id: string): Promise<InvoiceWithDetails> {
  const { data } = await apiClient.post<{ data: InvoiceWithDetails }>(`/billing/invoices/${id}/discount/approve`, {})
  return data.data
}

export async function rejectInvoiceDiscount(id: string, dto: RejectDiscountDto): Promise<InvoiceWithDetails> {
  const { data } = await apiClient.post<{ data: InvoiceWithDetails }>(`/billing/invoices/${id}/discount/reject`, dto)
  return data.data
}

export async function finalizeInvoice(id: string): Promise<Invoice> {
  const { data } = await apiClient.patch<{ data: Invoice }>(`/billing/invoices/${id}/finalize`, {})
  return data.data
}

export async function cancelInvoice(id: string, dto: CancelInvoiceDto): Promise<Invoice> {
  const { data } = await apiClient.patch<{ data: Invoice }>(`/billing/invoices/${id}/cancel`, dto)
  return data.data
}

export async function downloadInvoicePdf(id: string, invoiceNumber: string): Promise<void> {
  const response = await apiClient.get<Blob>(`/billing/invoices/${id}/pdf`, { responseType: 'blob' })
  downloadBlob(response.data, `${invoiceNumber}.pdf`)
}

// ─── Payments ──────────────────────────────────────────────────────────────

export async function listPayments(query: PaymentQuery = {}): Promise<PaginatedResponse<Payment>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<Payment> }>('/billing/payments', { params: query })
  return data.data
}

export async function recordPayment(invoiceId: string, dto: CreatePaymentDto): Promise<Payment> {
  const { data } = await apiClient.post<{ data: Payment }>(`/billing/invoices/${invoiceId}/payments`, dto)
  return data.data
}

export async function downloadReceiptPdf(paymentId: string, paymentNumber: string): Promise<void> {
  const response = await apiClient.get<Blob>(`/billing/payments/${paymentId}/receipt/pdf`, { responseType: 'blob' })
  downloadBlob(response.data, `${paymentNumber}.pdf`)
}

// ─── Refunds ───────────────────────────────────────────────────────────────

export async function listRefunds(query: RefundQuery = {}): Promise<PaginatedResponse<Refund>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<Refund> }>('/billing/refunds', { params: query })
  return data.data
}

export async function requestRefund(invoiceId: string, dto: CreateRefundDto): Promise<Refund> {
  const { data } = await apiClient.post<{ data: Refund }>(`/billing/invoices/${invoiceId}/refunds`, dto)
  return data.data
}

export async function approveRefund(id: string): Promise<Refund> {
  const { data } = await apiClient.post<{ data: Refund }>(`/billing/refunds/${id}/approve`, {})
  return data.data
}

export async function rejectRefund(id: string, dto: RejectRefundDto): Promise<Refund> {
  const { data } = await apiClient.post<{ data: Refund }>(`/billing/refunds/${id}/reject`, dto)
  return data.data
}

// ─── Shared ────────────────────────────────────────────────────────────────

function downloadBlob(data: BlobPart, fileName: string): void {
  const url = window.URL.createObjectURL(new Blob([data]))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
