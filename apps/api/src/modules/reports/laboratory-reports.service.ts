import { LabTestVolumeRow, LaboratoryReport, ReportFilterQuery } from '@medicore/types'
import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import {
  amountSeries,
  average,
  countSeries,
  hoursBetween,
  resolveRange,
  sumBy,
  toBreakdown,
  toNumber,
  toPeriod,
} from './report-range.util'

/** Orders that have not yet produced a released report. */
const PENDING_STATUSES: Prisma.EnumLabTestStatusFilter = {
  in: ['ORDERED', 'SAMPLE_COLLECTED', 'IN_PROGRESS'],
}

const TOP_TEST_LIMIT = 25

/**
 * Laboratory reporting (Checkpoint 17.1).
 *
 * Revenue note: the laboratory module does not raise its own `Charge` rows
 * and `LabTestCatalogItem` has no price column, so billed lab revenue is read
 * from `Charge` rows the billing module owns (`sourceModule = LABORATORY`).
 * The order-level total is exact; the per-test figure in `topTests` is that
 * order's charge **allocated equally across the order's test items**, which
 * is exact for single-test orders and a disclosed even split otherwise
 * (TECH_DEBT TD-0055).
 */
@Injectable()
export class LaboratoryReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(organizationId: string, query: ReportFilterQuery = {}): Promise<LaboratoryReport> {
    const range = resolveRange(query)
    const window = { gte: range.from, lt: range.to }

    const where: Prisma.LabTestWhereInput = {
      organizationId,
      ...(query.doctorId ? { doctorId: query.doctorId } : {}),
      ...(query.hospitalId ? { doctor: { hospitalId: query.hospitalId } } : {}),
      ...(query.departmentId ? { doctor: { departmentId: query.departmentId } } : {}),
    }

    const [orders, pending, statusGroups, charges, reported] = await Promise.all([
      this.prisma.labTest.findMany({
        where: { ...where, createdAt: window },
        select: {
          id: true,
          createdAt: true,
          reportedAt: true,
          status: true,
          items: { select: { testCode: true, testName: true, category: true, isAbnormal: true } },
        },
      }),
      this.prisma.labTest.count({ where: { ...where, status: PENDING_STATUSES } }),
      this.prisma.labTest.groupBy({ by: ['status'], where: { ...where, createdAt: window }, _count: true }),
      this.prisma.charge.findMany({
        where: {
          organizationId,
          sourceModule: 'LABORATORY',
          status: { not: 'VOIDED' },
          createdAt: window,
        },
        select: { sourceId: true, totalAmount: true, createdAt: true },
      }),
      // Turnaround is measured over orders *reported* in the window, keyed off
      // the order's own creation time — an order placed before the window but
      // reported inside it is still a real turnaround observation.
      this.prisma.labTest.findMany({
        where: { ...where, reportedAt: window },
        select: { createdAt: true, reportedAt: true },
      }),
    ])

    const turnarounds = reported
      .filter((o) => o.reportedAt)
      .map((o) => hoursBetween(o.createdAt, o.reportedAt as Date))

    const revenueByOrder = new Map<string, number>()
    for (const charge of charges) {
      if (!charge.sourceId) continue
      revenueByOrder.set(
        charge.sourceId,
        (revenueByOrder.get(charge.sourceId) ?? 0) + toNumber(charge.totalAmount),
      )
    }

    const items = orders.flatMap((order) => order.items)
    const categories = new Map<string, number>()
    for (const item of items) categories.set(item.category, (categories.get(item.category) ?? 0) + 1)

    return {
      period: toPeriod(range),
      ordersPlaced: orders.length,
      testsPerformed: items.length,
      pending,
      byStatus: toBreakdown(statusGroups, (g) => g.status),
      byCategory: [...categories.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count),
      volumeTrend: countSeries(orders, range, (o) => o.createdAt),
      averageTurnaroundHours: average(turnarounds),
      turnaroundSampleSize: turnarounds.length,
      topTests: this.buildTopTests(orders, revenueByOrder),
      totalRevenue: sumBy(charges, (c) => toNumber(c.totalAmount)).toFixed(2),
      revenueTrend: amountSeries(
        charges,
        range,
        (c) => c.createdAt,
        (c) => toNumber(c.totalAmount),
      ),
    }
  }

  private buildTopTests(
    orders: Array<{
      id: string
      items: Array<{ testCode: string; testName: string; category: string; isAbnormal: boolean }>
    }>,
    revenueByOrder: Map<string, number>,
  ): LabTestVolumeRow[] {
    const rows = new Map<string, LabTestVolumeRow & { revenueValue: number }>()

    for (const order of orders) {
      if (order.items.length === 0) continue
      // Equal split across the order's items — exact when the order has one
      // test, a disclosed allocation otherwise (see the class doc comment).
      const perItemRevenue = (revenueByOrder.get(order.id) ?? 0) / order.items.length

      for (const item of order.items) {
        const key = item.testCode || item.testName
        const existing = rows.get(key) ?? {
          testCode: item.testCode,
          testName: item.testName,
          category: item.category,
          performed: 0,
          abnormal: 0,
          revenue: '0.00',
          revenueValue: 0,
        }
        existing.performed++
        if (item.isAbnormal) existing.abnormal++
        existing.revenueValue += perItemRevenue
        rows.set(key, existing)
      }
    }

    return [...rows.values()]
      .sort((a, b) => b.performed - a.performed)
      .slice(0, TOP_TEST_LIMIT)
      .map(({ revenueValue, ...row }) => ({ ...row, revenue: revenueValue.toFixed(2) }))
  }
}
