import {
  InventoryConsumptionRow,
  InventoryReport,
  ReportFilterQuery,
  StockValuationRow,
  VendorPerformanceRow,
} from '@medicore/types'
import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'

import {
  amountSeries,
  average,
  daysBetween,
  percentOf,
  resolveRange,
  toNumber,
  toPeriod,
  ResolvedRange,
} from './report-range.util'

/**
 * Adjustment types that represent stock genuinely leaving the shelf. A
 * TRANSFER is excluded on purpose: moving stock between two stores of the
 * same organization is not consumption, and counting it would inflate
 * organization-wide usage every time a ward restocked.
 */
const CONSUMPTION_TYPES = ['ISSUE', 'DAMAGE', 'LOSS', 'EXPIRY'] as const

const TOP_ITEM_LIMIT = 50

/**
 * Inventory & procurement reporting (Checkpoint 17.1).
 *
 * Consumption is read from `InventoryStockAdjustment`, the append-only
 * movement ledger the inventory module already maintains as its single
 * source of truth for "why did this number change" - not recomputed from
 * stock balances, which would only ever show the net result.
 *
 * Stock valuation uses `InventoryItem.unitCost`: this schema stores no
 * per-batch purchase cost on `InventoryBatch`, so a weighted-average or FIFO
 * valuation is not derivable and the catalog cost is the honest basis
 * (TECH_DEBT TD-0057).
 */
@Injectable()
export class InventoryReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(organizationId: string, query: ReportFilterQuery = {}): Promise<InventoryReport> {
    const range = resolveRange(query)
    const window = { gte: range.from, lt: range.to }

    const [adjustments, purchaseOrders, stocks, vendors, ratings] = await Promise.all([
      this.prisma.inventoryStockAdjustment.findMany({
        where: { organizationId, type: { in: [...CONSUMPTION_TYPES] }, adjustedAt: window },
        select: {
          itemId: true,
          quantityDelta: true,
          adjustedAt: true,
          item: {
            select: { name: true, code: true, unitCost: true, category: { select: { name: true } } },
          },
        },
      }),
      this.prisma.purchaseOrder.findMany({
        where: { organizationId, createdAt: window, status: { not: 'DRAFT' } },
        select: {
          id: true,
          createdAt: true,
          vendorId: true,
          vendor: { select: { name: true } },
          items: { select: { quantityOrdered: true, quantityReceived: true, unitPrice: true } },
          goodsReceiptNotes: { select: { receivedAt: true } },
        },
      }),
      this.prisma.inventoryStock.findMany({
        where: { organizationId },
        select: {
          storeId: true,
          currentStock: true,
          damagedStock: true,
          expiredStock: true,
          lostStock: true,
          store: { select: { name: true } },
          item: { select: { unitCost: true } },
        },
      }),
      this.prisma.vendor.findMany({ where: { organizationId }, select: { id: true, name: true } }),
      this.prisma.vendorRating.groupBy({ by: ['vendorId'], where: { organizationId }, _avg: { rating: true } }),
    ])

    const consumption = this.buildConsumption(adjustments)
    const valuation = this.buildValuation(stocks)

    return {
      period: toPeriod(range),
      consumption: consumption.rows,
      totalConsumptionValue: consumption.totalValue.toFixed(2),
      consumptionTrend: amountSeries(
        adjustments,
        range,
        (a) => a.adjustedAt,
        (a) => Math.abs(a.quantityDelta) * toNumber(a.item.unitCost),
      ),
      purchaseOrders: purchaseOrders.length,
      purchaseValue: purchaseOrders.reduce((total, po) => total + this.orderedValue(po.items), 0).toFixed(2),
      purchaseTrend: this.buildPurchaseTrend(purchaseOrders, range),
      vendorPerformance: this.buildVendorPerformance(purchaseOrders, vendors, ratings),
      stockValuation: valuation.rows,
      totalStockValue: valuation.totalValue.toFixed(2),
    }
  }

  private orderedValue(items: Array<{ quantityOrdered: number; unitPrice: unknown }>): number {
    return items.reduce((total, item) => total + item.quantityOrdered * toNumber(item.unitPrice), 0)
  }

  private buildPurchaseTrend(
    orders: Array<{ createdAt: Date; items: Array<{ quantityOrdered: number; unitPrice: unknown }> }>,
    range: ResolvedRange,
  ) {
    return amountSeries(
      orders,
      range,
      (o) => o.createdAt,
      (o) => this.orderedValue(o.items),
    )
  }

  private buildConsumption(
    adjustments: Array<{
      itemId: string
      quantityDelta: number
      item: { name: string; code: string; unitCost: unknown; category: { name: string } | null }
    }>,
  ): { rows: InventoryConsumptionRow[]; totalValue: number } {
    const byItem = new Map<string, InventoryConsumptionRow & { valueNumber: number }>()
    let totalValue = 0

    for (const adjustment of adjustments) {
      // Consumption adjustments are stored as negative deltas; the report
      // wants a positive quantity consumed, so magnitude is what matters.
      const quantity = Math.abs(adjustment.quantityDelta)
      const value = quantity * toNumber(adjustment.item.unitCost)
      totalValue += value

      const existing = byItem.get(adjustment.itemId) ?? {
        itemId: adjustment.itemId,
        itemName: adjustment.item.name,
        itemCode: adjustment.item.code,
        categoryName: adjustment.item.category?.name ?? null,
        quantityConsumed: 0,
        value: '0.00',
        valueNumber: 0,
      }
      existing.quantityConsumed += quantity
      existing.valueNumber += value
      byItem.set(adjustment.itemId, existing)
    }

    const rows = [...byItem.values()]
      .sort((a, b) => b.valueNumber - a.valueNumber)
      .slice(0, TOP_ITEM_LIMIT)
      .map(({ valueNumber, ...row }) => ({ ...row, value: valueNumber.toFixed(2) }))

    return { rows, totalValue }
  }

  private buildValuation(
    stocks: Array<{
      storeId: string
      currentStock: number
      damagedStock: number
      expiredStock: number
      lostStock: number
      store: { name: string }
      item: { unitCost: unknown }
    }>,
  ): { rows: StockValuationRow[]; totalValue: number } {
    const byStore = new Map<string, { storeName: string; items: number; units: number; value: number }>()
    let totalValue = 0

    for (const stock of stocks) {
      // Damaged/expired/lost stock is physically present but has no sale
      // value - valuing it would overstate the balance sheet, so only the
      // saleable remainder is counted. This matches how `InventoryStock`
      // itself defines available stock.
      const saleable = Math.max(
        0,
        stock.currentStock - stock.damagedStock - stock.expiredStock - stock.lostStock,
      )
      const value = saleable * toNumber(stock.item.unitCost)
      totalValue += value

      const entry = byStore.get(stock.storeId) ?? {
        storeName: stock.store.name,
        items: 0,
        units: 0,
        value: 0,
      }
      entry.items++
      entry.units += saleable
      entry.value += value
      byStore.set(stock.storeId, entry)
    }

    const rows = [...byStore.entries()]
      .map(([storeId, entry]) => ({
        storeId,
        storeName: entry.storeName,
        items: entry.items,
        units: entry.units,
        value: entry.value.toFixed(2),
      }))
      .sort((a, b) => Number(b.value) - Number(a.value))

    return { rows, totalValue }
  }

  private buildVendorPerformance(
    orders: Array<{
      createdAt: Date
      vendorId: string
      items: Array<{ quantityOrdered: number; quantityReceived: number; unitPrice: unknown }>
      goodsReceiptNotes: Array<{ receivedAt: Date }>
    }>,
    vendors: Array<{ id: string; name: string }>,
    ratings: Array<{ vendorId: string; _avg: { rating: number | null } }>,
  ): VendorPerformanceRow[] {
    const ratingByVendor = new Map(ratings.map((r) => [r.vendorId, r._avg.rating]))
    const nameById = new Map(vendors.map((v) => [v.id, v.name]))

    const byVendor = new Map<
      string,
      { orders: number; value: number; fullyReceived: number; leadTimes: number[] }
    >()

    for (const order of orders) {
      const entry = byVendor.get(order.vendorId) ?? {
        orders: 0,
        value: 0,
        fullyReceived: 0,
        leadTimes: [] as number[],
      }
      entry.orders++
      entry.value += this.orderedValue(order.items)

      const complete =
        order.items.length > 0 && order.items.every((item) => item.quantityReceived >= item.quantityOrdered)
      if (complete) entry.fullyReceived++

      // Lead time is measured to the *last* receipt against the order, since
      // a partially-received PO is not delivered until its final GRN lands.
      if (order.goodsReceiptNotes.length > 0) {
        const lastReceipt = order.goodsReceiptNotes.reduce(
          (latest, grn) => (grn.receivedAt > latest ? grn.receivedAt : latest),
          order.goodsReceiptNotes[0].receivedAt,
        )
        entry.leadTimes.push(daysBetween(order.createdAt, lastReceipt))
      }

      byVendor.set(order.vendorId, entry)
    }

    return [...byVendor.entries()]
      .map(([vendorId, entry]) => ({
        vendorId,
        vendorName: nameById.get(vendorId) ?? vendorId,
        purchaseOrders: entry.orders,
        orderedValue: entry.value.toFixed(2),
        fullyReceived: entry.fullyReceived,
        fulfilmentRatePercent: percentOf(entry.fullyReceived, entry.orders),
        averageLeadTimeDays: average(entry.leadTimes),
        averageRating: ratingByVendor.get(vendorId) ?? null,
      }))
      .sort((a, b) => Number(b.orderedValue) - Number(a.orderedValue))
  }
}
