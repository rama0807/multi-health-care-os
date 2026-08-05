import { BillingReport, GstSlabRow, OutstandingAgeingRow, ReportFilterQuery } from '@medicore/types'
import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'

import {
  amountComparison,
  amountSeries,
  daysBetween,
  resolveRange,
  sumBy,
  toNumber,
  toPeriod,
} from './report-range.util'

/** Invoice statuses that still owe money. */
const OUTSTANDING_STATUSES = ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] as const

/** Statuses that count as real, billable revenue — a DRAFT is not revenue yet. */
const BILLED_STATUSES = ['ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'REFUNDED'] as const

const AGEING_BUCKETS: Array<{ label: string; minDays: number; maxDays: number | null }> = [
  { label: '0-30 days', minDays: 0, maxDays: 31 },
  { label: '31-60 days', minDays: 31, maxDays: 61 },
  { label: '61-90 days', minDays: 61, maxDays: 91 },
  { label: '90+ days', minDays: 91, maxDays: null },
]

/**
 * Billing & revenue reporting (Checkpoint 17.1).
 *
 * Revenue and collections are deliberately kept as **two different numbers**
 * measured off two different tables: revenue is what was invoiced
 * (`Invoice.totalAmount` for invoices raised in the period) and collections
 * is what was actually received (`Payment.amount` paid in the period). They
 * diverge whenever an invoice is paid in a later period, and collapsing them
 * into one "revenue" figure — as a naive report would — would misstate both.
 *
 * The GST summary is built from `InvoiceItem` rows rather than
 * `Invoice.taxAmount` so it can be broken down per tax slab, which is what a
 * GST filing actually needs. It reuses the per-line values the billing
 * module already computed and stored (`billing-calculations.ts`); nothing is
 * re-derived here.
 */
@Injectable()
export class BillingReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(organizationId: string, query: ReportFilterQuery = {}): Promise<BillingReport> {
    const range = resolveRange(query)
    const window = { gte: range.from, lt: range.to }
    const now = new Date()

    const [invoices, previousInvoices, payments, previousPayments, outstanding, refunds, invoiceItems] =
      await Promise.all([
        this.prisma.invoice.findMany({
          where: { organizationId, status: { in: [...BILLED_STATUSES] }, createdAt: window },
          select: {
            createdAt: true,
            type: true,
            totalAmount: true,
            discountAmount: true,
            taxAmount: true,
          },
        }),
        this.prisma.invoice.findMany({
          where: {
            organizationId,
            status: { in: [...BILLED_STATUSES] },
            createdAt: { gte: range.previousFrom, lt: range.previousTo },
          },
          select: { totalAmount: true },
        }),
        this.prisma.payment.findMany({
          where: { invoice: { organizationId }, status: 'COMPLETED', paidAt: window },
          select: { amount: true, paymentMode: true, paidAt: true },
        }),
        this.prisma.payment.findMany({
          where: {
            invoice: { organizationId },
            status: 'COMPLETED',
            paidAt: { gte: range.previousFrom, lt: range.previousTo },
          },
          select: { amount: true },
        }),
        // Outstanding is a balance-sheet figure: it is everything still owed
        // *as of now*, not just what was invoiced inside the window. Scoping
        // it to the period would report a shrinking debt that isn't real.
        this.prisma.invoice.findMany({
          where: { organizationId, status: { in: [...OUTSTANDING_STATUSES] } },
          select: { balanceDue: true, createdAt: true, dueDate: true },
        }),
        this.prisma.refund.findMany({
          where: { organizationId, status: 'COMPLETED', refundedAt: window },
          select: { amount: true },
        }),
        this.prisma.invoiceItem.findMany({
          where: {
            invoice: { organizationId, status: { in: [...BILLED_STATUSES] }, createdAt: window },
          },
          select: { taxPercent: true, totalPrice: true },
        }),
      ])

    const revenue = sumBy(invoices, (i) => toNumber(i.totalAmount))
    const collections = sumBy(payments, (p) => toNumber(p.amount))
    const discounted = invoices.filter((i) => toNumber(i.discountAmount) > 0)
    const gst = this.buildGstSummary(invoiceItems)

    return {
      period: toPeriod(range),
      revenue: revenue.toFixed(2),
      revenueTrend: amountSeries(
        invoices,
        range,
        (i) => i.createdAt,
        (i) => toNumber(i.totalAmount),
      ),
      revenueByType: this.groupAmounts(
        invoices,
        (i) => i.type,
        (i) => toNumber(i.totalAmount),
      ),
      collections: collections.toFixed(2),
      collectionTrend: amountSeries(
        payments,
        range,
        (p) => p.paidAt,
        (p) => toNumber(p.amount),
      ),
      collectionsByMode: this.groupAmounts(
        payments,
        (p) => p.paymentMode,
        (p) => toNumber(p.amount),
      ),
      outstanding: sumBy(outstanding, (i) => toNumber(i.balanceDue)).toFixed(2),
      outstandingInvoices: outstanding.length,
      outstandingAgeing: this.buildAgeing(outstanding, now),
      discounts: sumBy(invoices, (i) => toNumber(i.discountAmount)).toFixed(2),
      discountedInvoices: discounted.length,
      refunds: sumBy(refunds, (r) => toNumber(r.amount)).toFixed(2),
      refundCount: refunds.length,
      gstSummary: gst.slabs,
      totalTaxableValue: gst.taxableValue.toFixed(2),
      totalTax: gst.tax.toFixed(2),
      revenueComparison: amountComparison(revenue, sumBy(previousInvoices, (i) => toNumber(i.totalAmount))),
      collectionsComparison: amountComparison(collections, sumBy(previousPayments, (p) => toNumber(p.amount))),
    }
  }

  private groupAmounts<T>(
    rows: T[],
    labelOf: (row: T) => string,
    amountOf: (row: T) => number,
  ): Array<{ label: string; amount: string }> {
    const totals = new Map<string, number>()
    for (const row of rows) {
      const label = labelOf(row)
      totals.set(label, (totals.get(label) ?? 0) + amountOf(row))
    }
    return [...totals.entries()]
      .map(([label, amount]) => ({ label, amount: amount.toFixed(2) }))
      .sort((a, b) => Number(b.amount) - Number(a.amount))
  }

  /**
   * Ages an unpaid invoice from its due date where one exists, falling back
   * to its creation date — an invoice with explicit terms should not be
   * reported as overdue before those terms lapse.
   */
  private buildAgeing(
    invoices: Array<{ balanceDue: unknown; createdAt: Date; dueDate: Date | null }>,
    now: Date,
  ): OutstandingAgeingRow[] {
    const buckets = AGEING_BUCKETS.map((b) => ({ ...b, invoices: 0, amount: 0 }))

    for (const invoice of invoices) {
      const age = Math.max(0, Math.trunc(daysBetween(invoice.dueDate ?? invoice.createdAt, now)))
      const bucket = buckets.find((b) => age >= b.minDays && (b.maxDays === null || age < b.maxDays))
      if (!bucket) continue
      bucket.invoices++
      bucket.amount += toNumber(invoice.balanceDue)
    }

    return buckets.map(({ label, invoices: count, amount }) => ({
      label,
      invoices: count,
      amount: amount.toFixed(2),
    }))
  }

  /**
   * Per-slab GST. `InvoiceItem.totalPrice` is tax-inclusive, so the taxable
   * value is backed out of the stored line total at that line's own rate
   * rather than recomputed from unit price x quantity — that keeps the report
   * consistent with the invoice the patient was actually handed, including
   * any line discount already baked into it.
   */
  private buildGstSummary(items: Array<{ taxPercent: unknown; totalPrice: unknown }>): {
    slabs: GstSlabRow[]
    taxableValue: number
    tax: number
  } {
    const bySlab = new Map<string, { taxableValue: number; taxAmount: number; lineCount: number }>()
    let taxableTotal = 0
    let taxTotal = 0

    for (const item of items) {
      const rate = toNumber(item.taxPercent)
      const lineTotal = toNumber(item.totalPrice)
      const taxable = rate > 0 ? lineTotal / (1 + rate / 100) : lineTotal
      const tax = lineTotal - taxable

      const key = rate.toFixed(2)
      const slab = bySlab.get(key) ?? { taxableValue: 0, taxAmount: 0, lineCount: 0 }
      slab.taxableValue += taxable
      slab.taxAmount += tax
      slab.lineCount++
      bySlab.set(key, slab)

      taxableTotal += taxable
      taxTotal += tax
    }

    const slabs = [...bySlab.entries()]
      .map(([taxPercent, slab]) => ({
        taxPercent,
        taxableValue: slab.taxableValue.toFixed(2),
        taxAmount: slab.taxAmount.toFixed(2),
        lineCount: slab.lineCount,
      }))
      .sort((a, b) => Number(a.taxPercent) - Number(b.taxPercent))

    return { slabs, taxableValue: taxableTotal, tax: taxTotal }
  }
}
