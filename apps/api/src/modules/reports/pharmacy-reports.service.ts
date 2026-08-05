import { DispensedMedicineRow, PharmacyReport, PharmacyStockAlertRow, ReportFilterQuery } from '@medicore/types'
import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'

import { countSeries, daysBetween, resolveRange, toBreakdown, toNumber, toPeriod } from './report-range.util'

/** Batches expiring inside this horizon are surfaced as an alert. */
const EXPIRY_HORIZON_DAYS = 90
const TOP_MEDICINE_LIMIT = 25
const ALERT_LIMIT = 100

/**
 * Pharmacy reporting (Checkpoint 17.1).
 *
 * Unlike laboratory/radiology, pharmacy revenue is derivable exactly: a
 * `DispenseItem` resolves to a specific `Drug` batch, and that batch carries
 * its own price — so revenue is `quantityDispensed x Drug.price`, not an
 * allocation. Items the pharmacist never resolved to a batch (`drugId` null)
 * are counted in quantity but carry a null revenue rather than a guessed one.
 *
 * Stock alerts are point-in-time (as of "now"), not period-scoped — an
 * expiring batch is a fact about today's shelf, and date-filtering it would
 * make the alert silently incomplete.
 */
@Injectable()
export class PharmacyReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(organizationId: string, query: ReportFilterQuery = {}): Promise<PharmacyReport> {
    const range = resolveRange(query)
    const window = { gte: range.from, lt: range.to }
    const now = new Date()

    const [dispenses, statusGroups, drugs] = await Promise.all([
      // Only completed dispenses count as "dispensed" — a PREPARING order has
      // reserved stock but has not left the counter, so counting it would
      // double-report the same medicine once it completes.
      this.prisma.dispenseOrder.findMany({
        where: { organizationId, status: { in: ['DISPENSED', 'RETURNED'] }, dispensedAt: window },
        select: {
          dispensedAt: true,
          items: {
            select: {
              drugId: true,
              medicationName: true,
              quantityDispensed: true,
              drug: { select: { price: true, genericName: true, brandName: true } },
            },
          },
        },
      }),
      this.prisma.dispenseOrder.groupBy({
        by: ['status'],
        where: { organizationId, createdAt: window },
        _count: true,
      }),
      // Both alert families come from one pass over the active catalog: a
      // batch is interesting if it is near/past expiry or at/below its
      // reorder level. The low-stock test uses *available* stock (physical
      // minus the portion reserved by in-flight dispenses), the same notion
      // ADR-0014 defines for the dispensing workflow, so it is applied below
      // rather than pushed into SQL.
      this.prisma.drug.findMany({
        where: { organizationId, isActive: true },
        select: {
          id: true,
          genericName: true,
          brandName: true,
          batchNumber: true,
          expiryDate: true,
          currentStock: true,
          reservedStock: true,
          minStockLevel: true,
          reorderLevel: true,
        },
      }),
    ])

    const items = dispenses.flatMap((d) => d.items)
    const alerts = drugs.map((drug) => this.toAlertRow(drug, now))

    return {
      period: toPeriod(range),
      ordersDispensed: dispenses.length,
      itemsDispensed: items.length,
      totalQuantityDispensed: items.reduce((total, i) => total + i.quantityDispensed, 0),
      dispenseTrend: countSeries(dispenses, range, (d) => d.dispensedAt),
      byStatus: toBreakdown(statusGroups, (g) => g.status),
      topMedicines: this.buildTopMedicines(items),
      lowStock: alerts
        .filter((a) => a.availableStock <= a.reorderLevel)
        .sort((a, b) => a.availableStock - b.availableStock)
        .slice(0, ALERT_LIMIT),
      expiring: alerts
        .filter((a) => a.daysToExpiry >= 0 && a.daysToExpiry <= EXPIRY_HORIZON_DAYS)
        .sort((a, b) => a.daysToExpiry - b.daysToExpiry)
        .slice(0, ALERT_LIMIT),
      expired: alerts
        .filter((a) => a.daysToExpiry < 0)
        .sort((a, b) => a.daysToExpiry - b.daysToExpiry)
        .slice(0, ALERT_LIMIT),
      totalRevenue: items
        .reduce((total, i) => total + i.quantityDispensed * toNumber(i.drug?.price), 0)
        .toFixed(2),
    }
  }

  private toAlertRow(
    drug: {
      id: string
      genericName: string
      brandName: string | null
      batchNumber: string
      expiryDate: Date
      currentStock: number
      reservedStock: number
      minStockLevel: number
      reorderLevel: number
    },
    now: Date,
  ): PharmacyStockAlertRow {
    return {
      drugId: drug.id,
      name: drug.brandName ? `${drug.brandName} (${drug.genericName})` : drug.genericName,
      batchNumber: drug.batchNumber,
      currentStock: drug.currentStock,
      availableStock: drug.currentStock - drug.reservedStock,
      minStockLevel: drug.minStockLevel,
      reorderLevel: drug.reorderLevel,
      expiryDate: drug.expiryDate.toISOString().slice(0, 10),
      daysToExpiry: Math.trunc(daysBetween(now, drug.expiryDate)),
    }
  }

  private buildTopMedicines(
    items: Array<{
      drugId: string | null
      medicationName: string
      quantityDispensed: number
      drug: { price: unknown; genericName: string; brandName: string | null } | null
    }>,
  ): DispensedMedicineRow[] {
    const rows = new Map<string, DispensedMedicineRow & { revenueValue: number; priced: boolean }>()

    for (const item of items) {
      // Group on the resolved drug when there is one, so two spellings of the
      // same medication collapse into the batch they were actually filled from.
      const key = item.drugId ?? `name:${item.medicationName.toLowerCase()}`
      const name = item.drug
        ? item.drug.brandName
          ? `${item.drug.brandName} (${item.drug.genericName})`
          : item.drug.genericName
        : item.medicationName

      const existing = rows.get(key) ?? {
        drugId: item.drugId,
        medicationName: name,
        quantityDispensed: 0,
        dispenseCount: 0,
        revenue: null,
        revenueValue: 0,
        priced: false,
      }
      existing.quantityDispensed += item.quantityDispensed
      existing.dispenseCount++
      if (item.drug) {
        existing.priced = true
        existing.revenueValue += item.quantityDispensed * toNumber(item.drug.price)
      }
      rows.set(key, existing)
    }

    return [...rows.values()]
      .sort((a, b) => b.quantityDispensed - a.quantityDispensed)
      .slice(0, TOP_MEDICINE_LIMIT)
      .map(({ revenueValue, priced, ...row }) => ({
        ...row,
        revenue: priced ? revenueValue.toFixed(2) : null,
      }))
  }
}
