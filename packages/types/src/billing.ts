import { z } from 'zod'

import {
  ChargeSourceModule,
  ChargeStatus,
  DiscountApprovalStatus,
  DiscountType,
  InvoiceStatus,
  InvoiceType,
  PaymentMode,
  PaymentStatus,
  RefundStatus,
} from './enums'

// ─── Service Catalog ───────────────────────────────────────────────────────

/**
 * Configurable pricing catalog ("service catalog with pricing") — see
 * ADR-0015. `price`/`taxPercent` are Prisma `Decimal` on the wire —
 * serialized as strings, same convention as `Drug.price`/`RadiologyCatalogItem.price`.
 */
export interface ServiceCatalogItem {
  id: string
  organizationId: string
  code: string
  name: string
  category: string
  price: string
  taxPercent: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export const CreateServiceCatalogItemSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
  price: z.number().nonnegative(),
  taxPercent: z.number().min(0).max(100).default(0),
})

export type CreateServiceCatalogItemDto = z.infer<typeof CreateServiceCatalogItemSchema>

export const UpdateServiceCatalogItemSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  category: z.string().min(1).max(100).optional(),
  price: z.number().nonnegative().optional(),
  taxPercent: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
})

export type UpdateServiceCatalogItemDto = z.infer<typeof UpdateServiceCatalogItemSchema>

export interface ServiceCatalogItemQuery {
  search?: string
  category?: string
  isActive?: boolean
  page?: number
  limit?: number
  sortBy?: 'name' | 'category' | 'price' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

// ─── Charge Engine ─────────────────────────────────────────────────────────

/**
 * The reusable Charge Engine entity — see ADR-0015. Any clinical module (or
 * a manual cashier action) creates one row; invoice generation sweeps every
 * `PENDING` charge for a patient/encounter into `InvoiceItem` rows.
 */
export interface Charge {
  id: string
  organizationId: string
  patientId: string
  encounterId: string | null
  appointmentId: string | null
  sourceModule: ChargeSourceModule
  sourceId: string | null
  catalogItemId: string | null
  description: string
  quantity: number
  unitPrice: string
  discountPercent: string
  discountAmount: string
  taxPercent: string
  taxAmount: string
  totalAmount: string
  status: ChargeStatus
  invoiceId: string | null
  createdByUserId: string | null
  createdAt: Date
}

/** Manual charge creation — "consumed by every clinical module" via `sourceModule`/`sourceId`, not a hard FK. */
export const CreateChargeSchema = z
  .object({
    patientId: z.string().cuid(),
    encounterId: z.string().cuid().optional(),
    appointmentId: z.string().cuid().optional(),
    sourceModule: z.nativeEnum(ChargeSourceModule).default(ChargeSourceModule.MISCELLANEOUS),
    sourceId: z.string().max(100).optional(),
    catalogItemId: z.string().cuid().optional(),
    description: z.string().min(1).max(300).optional(),
    quantity: z.number().int().positive().default(1),
    unitPrice: z.number().nonnegative().optional(),
    discountPercent: z.number().min(0).max(100).default(0),
    taxPercent: z.number().min(0).max(100).optional(),
  })
  .refine((v) => v.catalogItemId || (v.description && v.unitPrice !== undefined), {
    message: 'Either catalogItemId, or both description and unitPrice, must be provided',
  })

export type CreateChargeDto = z.infer<typeof CreateChargeSchema>

export interface ChargeQuery {
  patientId?: string
  encounterId?: string
  appointmentId?: string
  status?: ChargeStatus
  page?: number
  limit?: number
}

// ─── Invoices ──────────────────────────────────────────────────────────────

/**
 * See ADR-0015. `discountApprovalStatus`/`discountApproved*` implement the
 * discount approval workflow — only an `APPROVED` discount is reflected in
 * `discountAmount`/`totalAmount`/`balanceDue`.
 */
export interface Invoice {
  id: string
  invoiceNumber: string
  patientId: string
  appointmentId: string | null
  encounterId: string | null
  organizationId: string
  status: InvoiceStatus
  type: InvoiceType
  subtotal: string
  discountAmount: string
  taxAmount: string
  totalAmount: string
  paidAmount: string
  balanceDue: string
  currency: string
  notes: string | null
  dueDate: Date | null
  createdByUserId: string | null
  discountType: DiscountType | null
  discountValue: string | null
  discountReason: string | null
  discountApprovalStatus: DiscountApprovalStatus
  discountRequestedByUserId: string | null
  discountApprovedByUserId: string | null
  discountApprovedAt: Date | null
  finalizedAt: Date | null
  cancelledAt: Date | null
  cancelReason: string | null
  createdAt: Date
  updatedAt: Date
}

export interface InvoiceItem {
  id: string
  invoiceId: string
  itemName: string
  itemCode: string | null
  category: string
  quantity: number
  unitPrice: string
  discountPercent: string
  taxPercent: string
  totalPrice: string
  createdAt: Date
}

export interface InvoiceWithDetails extends Invoice {
  patient: { id: string; fullName: string; uhid: string }
  items: InvoiceItem[]
  payments: Payment[]
  refunds: Refund[]
}

/** Ad-hoc manual line item — used both for `POST /billing/invoices` and `POST /billing/invoices/:id/items`. */
export const InvoiceLineItemSchema = z.object({
  itemName: z.string().min(1).max(200),
  itemCode: z.string().max(50).optional(),
  category: z.string().min(1).max(100),
  quantity: z.number().int().positive().default(1),
  unitPrice: z.number().nonnegative(),
  discountPercent: z.number().min(0).max(100).default(0),
  taxPercent: z.number().min(0).max(100).default(0),
})

export type InvoiceLineItemDto = z.infer<typeof InvoiceLineItemSchema>

/**
 * Creates a DRAFT invoice from manual line items and/or a set of the
 * patient's existing `PENDING` charges (swept in as invoice items and
 * flipped to `INVOICED`) — at least one of `items`/`chargeIds` is required.
 */
export const CreateInvoiceSchema = z
  .object({
    patientId: z.string().cuid(),
    encounterId: z.string().cuid().optional(),
    appointmentId: z.string().cuid().optional(),
    type: z.nativeEnum(InvoiceType).default(InvoiceType.OPD),
    items: z.array(InvoiceLineItemSchema).default([]),
    chargeIds: z.array(z.string().cuid()).default([]),
    notes: z.string().max(1000).optional(),
    dueDate: z.coerce.date().optional(),
  })
  .refine((v) => v.items.length > 0 || v.chargeIds.length > 0, {
    message: 'Provide at least one line item or existing charge to invoice',
  })

export type CreateInvoiceDto = z.infer<typeof CreateInvoiceSchema>

export const ApplyDiscountSchema = z.object({
  discountType: z.nativeEnum(DiscountType),
  discountValue: z.number().positive(),
  reason: z.string().min(1).max(500),
})

export type ApplyDiscountDto = z.infer<typeof ApplyDiscountSchema>

export const RejectDiscountSchema = z.object({
  reason: z.string().min(1).max(500),
})

export type RejectDiscountDto = z.infer<typeof RejectDiscountSchema>

export const CancelInvoiceSchema = z.object({
  reason: z.string().min(1).max(500),
})

export type CancelInvoiceDto = z.infer<typeof CancelInvoiceSchema>

export interface InvoiceQuery {
  patientId?: string
  status?: InvoiceStatus
  type?: InvoiceType
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
  sortBy?: 'createdAt' | 'dueDate' | 'totalAmount'
  sortOrder?: 'asc' | 'desc'
}

// ─── Payments ──────────────────────────────────────────────────────────────

export interface Payment {
  id: string
  paymentNumber: string
  invoiceId: string
  patientId: string
  organizationId: string
  amount: string
  paymentMode: PaymentMode
  transactionId: string | null
  referenceNumber: string | null
  status: PaymentStatus
  collectedBy: string | null
  paidAt: Date
  createdAt: Date
}

export interface PaymentWithInvoice extends Payment {
  invoice: { invoiceNumber: string; patientId: string }
}

/**
 * Records one payment against an invoice — cash/card/UPI/bank transfer
 * (NEFT/RTGS)/cheque. Calling this more than once against the same invoice
 * (with different modes and/or partial amounts) is how split and partial
 * payments both work — no separate "split payment" endpoint is needed.
 */
export const CreatePaymentSchema = z.object({
  amount: z.number().positive(),
  paymentMode: z.nativeEnum(PaymentMode),
  transactionId: z.string().max(100).optional(),
  referenceNumber: z.string().max(100).optional(),
})

export type CreatePaymentDto = z.infer<typeof CreatePaymentSchema>

export interface PaymentQuery {
  invoiceId?: string
  patientId?: string
  paymentMode?: PaymentMode
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

// ─── Refunds ───────────────────────────────────────────────────────────────

export interface Refund {
  id: string
  refundNumber: string
  organizationId: string
  invoiceId: string
  paymentId: string | null
  amount: string
  reason: string
  refundMode: PaymentMode | null
  status: RefundStatus
  requestedByUserId: string
  approvedByUserId: string | null
  approvedAt: Date | null
  rejectionReason: string | null
  refundedAt: Date | null
  createdAt: Date
}

/**
 * Requests a partial or full refund against an invoice/payment — see
 * ADR-0015. A `billing.manage` scope holder's request is auto-approved and
 * completed immediately; anyone else's lands `PENDING` for later approval.
 */
export const CreateRefundSchema = z.object({
  paymentId: z.string().cuid().optional(),
  amount: z.number().positive(),
  reason: z.string().min(1).max(500),
  refundMode: z.nativeEnum(PaymentMode).optional(),
})

export type CreateRefundDto = z.infer<typeof CreateRefundSchema>

export const RejectRefundSchema = z.object({
  reason: z.string().min(1).max(500),
})

export type RejectRefundDto = z.infer<typeof RejectRefundSchema>

export interface RefundQuery {
  invoiceId?: string
  status?: RefundStatus
  page?: number
  limit?: number
}

// ─── Dashboard ─────────────────────────────────────────────────────────────

export interface BillingDashboardStats {
  todaysRevenue: string
  pendingInvoices: number
  outstandingBalance: string
  refundsToday: string
  pendingDiscountApprovals: number
  pendingRefundApprovals: number
  collectionTrend: Array<{ date: string; amount: string }>
}
