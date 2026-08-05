import { RadiologyMachineRow, RadiologyReportStats, ReportFilterQuery } from '@medicore/types'
import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import {
  average,
  countSeries,
  hoursBetween,
  percentOf,
  resolveRange,
  sumBy,
  toBreakdown,
  toNumber,
  toPeriod,
} from './report-range.util'

/** Studies not yet reported — the radiologist's outstanding queue. */
const PENDING_STATUSES: Prisma.EnumRadiologyStatusFilter = {
  in: ['ORDERED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED'],
}

/**
 * Radiology reporting (Checkpoint 17.1).
 *
 * "Machine utilisation" here is **relative load**, not a duty cycle: this
 * schema models no machine inventory, capacity or operating hours, so the
 * only honest measure is each machine's share of the scheduled study minutes
 * actually recorded on `RadiologyOrder.durationMinutes` (TECH_DEBT TD-0052).
 * Studies with no machine recorded are grouped under "Unassigned" rather
 * than silently dropped.
 */
@Injectable()
export class RadiologyReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(organizationId: string, query: ReportFilterQuery = {}): Promise<RadiologyReportStats> {
    const range = resolveRange(query)
    const window = { gte: range.from, lt: range.to }

    const where: Prisma.RadiologyOrderWhereInput = {
      organizationId,
      ...(query.doctorId ? { doctorId: query.doctorId } : {}),
      ...(query.hospitalId ? { doctor: { hospitalId: query.hospitalId } } : {}),
      ...(query.departmentId ? { doctor: { departmentId: query.departmentId } } : {}),
    }

    const [orders, pendingReports, statusGroups, modalityGroups, reported, charges] = await Promise.all([
      this.prisma.radiologyOrder.findMany({
        where: { ...where, createdAt: window },
        select: { createdAt: true, machine: true, durationMinutes: true },
      }),
      this.prisma.radiologyOrder.count({ where: { ...where, status: PENDING_STATUSES, reportedAt: null } }),
      this.prisma.radiologyOrder.groupBy({
        by: ['status'],
        where: { ...where, createdAt: window },
        _count: true,
      }),
      this.prisma.radiologyOrder.groupBy({
        by: ['modality'],
        where: { ...where, createdAt: window },
        _count: true,
      }),
      this.prisma.radiologyOrder.findMany({
        where: { ...where, reportedAt: window },
        select: { createdAt: true, reportedAt: true },
      }),
      this.prisma.charge.findMany({
        where: {
          organizationId,
          sourceModule: 'RADIOLOGY',
          status: { not: 'VOIDED' },
          createdAt: window,
        },
        select: { totalAmount: true },
      }),
    ])

    const turnarounds = reported
      .filter((o) => o.reportedAt)
      .map((o) => hoursBetween(o.createdAt, o.reportedAt as Date))

    return {
      period: toPeriod(range),
      investigations: orders.length,
      pendingReports,
      byStatus: toBreakdown(statusGroups, (g) => g.status),
      byModality: toBreakdown(modalityGroups, (g) => g.modality),
      volumeTrend: countSeries(orders, range, (o) => o.createdAt),
      averageTurnaroundHours: average(turnarounds),
      turnaroundSampleSize: turnarounds.length,
      machineUtilisation: this.buildMachineLoad(orders),
      totalRevenue: sumBy(charges, (c) => toNumber(c.totalAmount)).toFixed(2),
    }
  }

  private buildMachineLoad(
    orders: Array<{ machine: string | null; durationMinutes: number | null }>,
  ): RadiologyMachineRow[] {
    const byMachine = new Map<string, { studies: number; minutes: number }>()
    for (const order of orders) {
      const key = order.machine?.trim() || 'Unassigned'
      const entry = byMachine.get(key) ?? { studies: 0, minutes: 0 }
      entry.studies++
      entry.minutes += order.durationMinutes ?? 0
      byMachine.set(key, entry)
    }

    const totalMinutes = [...byMachine.values()].reduce((total, m) => total + m.minutes, 0)

    return [...byMachine.entries()]
      .map(([machine, { studies, minutes }]) => ({
        machine,
        studies,
        scheduledMinutes: minutes,
        sharePercent: percentOf(minutes, totalMinutes),
      }))
      .sort((a, b) => b.scheduledMinutes - a.scheduledMinutes || b.studies - a.studies)
  }
}
