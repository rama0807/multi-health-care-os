import { IpdReport, ReportFilterQuery, WardOccupancyRow } from '@medicore/types'
import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import {
  addDays,
  average,
  bucketKeyFor,
  bucketKeys,
  comparison,
  countSeries,
  daysBetween,
  percentOf,
  resolveRange,
  toBreakdown,
  toPeriod,
  ResolvedRange,
} from './report-range.util'

/**
 * IPD reporting (Checkpoint 17.1).
 *
 * Bed occupancy is reported two ways because they answer different questions:
 * `bedOccupancyPercent` is the live snapshot (the same figure
 * `IpdDashboardService` already surfaces, kept consistent with it), while
 * `occupancyRateTrend` is a true **bed-days** rate — occupied bed-days over
 * available bed-days per bucket — reconstructed from each admission's own
 * stay window. A snapshot alone cannot show whether the ward was full last
 * Tuesday.
 *
 * Bed capacity is taken as the current bed count: this schema keeps no
 * history of when a bed was commissioned, so a ward that grew mid-period is
 * measured against its present size (TECH_DEBT TD-0056).
 */
@Injectable()
export class IpdReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(organizationId: string, query: ReportFilterQuery = {}): Promise<IpdReport> {
    const range = resolveRange(query)
    const window = { gte: range.from, lt: range.to }

    const where: Prisma.AdmissionWhereInput = {
      organizationId,
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.doctorId ? { attendingDoctorId: query.doctorId } : {}),
      ...(query.hospitalId ? { attendingDoctor: { hospitalId: query.hospitalId } } : {}),
    }

    const [admissions, previousAdmissions, discharged, currentInpatients, typeGroups, wards, beds, overlapping] =
      await Promise.all([
        this.prisma.admission.findMany({
          where: { ...where, admittedAt: window },
          select: { admittedAt: true, wardId: true },
        }),
        this.prisma.admission.count({
          where: { ...where, admittedAt: { gte: range.previousFrom, lt: range.previousTo } },
        }),
        this.prisma.admission.findMany({
          where: { ...where, status: 'DISCHARGED', dischargedAt: window },
          select: { admittedAt: true, dischargedAt: true, wardId: true },
        }),
        this.prisma.admission.count({ where: { ...where, status: 'ADMITTED' } }),
        this.prisma.admission.groupBy({ by: ['type'], where: { ...where, admittedAt: window }, _count: true }),
        this.prisma.ward.findMany({
          where: { organizationId, ...(query.departmentId ? { departmentId: query.departmentId } : {}) },
          select: { id: true, name: true, type: true },
        }),
        this.prisma.bed.findMany({ where: { organizationId }, select: { wardId: true, status: true } }),
        // Every stay that overlaps the window at all, for the bed-days rate —
        // an admission from before the window still occupies a bed inside it.
        this.prisma.admission.findMany({
          where: {
            ...where,
            admittedAt: { lt: range.to },
            OR: [{ dischargedAt: null }, { dischargedAt: { gte: range.from } }],
          },
          select: { admittedAt: true, dischargedAt: true, wardId: true },
        }),
      ])

    const stayLengths = discharged
      .filter((a) => a.dischargedAt)
      .map((a) => daysBetween(a.admittedAt, a.dischargedAt as Date))

    const totalBeds = beds.length
    const occupiedBeds = beds.filter((b) => b.status === 'OCCUPIED').length

    return {
      period: toPeriod(range),
      admissions: admissions.length,
      discharges: discharged.length,
      currentInpatients,
      admissionTrend: countSeries(admissions, range, (a) => a.admittedAt),
      byType: toBreakdown(typeGroups, (g) => g.type),
      averageStayDays: average(stayLengths),
      stayLengthSampleSize: stayLengths.length,
      totalBeds,
      occupiedBeds,
      bedOccupancyPercent: percentOf(occupiedBeds, totalBeds),
      occupancyRateTrend: this.buildOccupancyTrend(overlapping, totalBeds, range),
      wardOccupancy: this.buildWardOccupancy(wards, beds, admissions, discharged),
      admissionsComparison: comparison(admissions.length, previousAdmissions),
    }
  }

  /**
   * Occupied bed-days over available bed-days, per bucket. Each stay
   * contributes one bed-day for every day it covers, clipped to the window;
   * an open admission is treated as still occupying its bed through the end
   * of the range, which is what it actually is.
   */
  private buildOccupancyTrend(
    stays: Array<{ admittedAt: Date; dischargedAt: Date | null }>,
    totalBeds: number,
    range: ResolvedRange,
  ): Array<{ bucket: string; value: number }> {
    const keys = bucketKeys(range)
    const occupiedDays = new Map<string, number>(keys.map((key) => [key, 0]))
    const availableDays = new Map<string, number>(keys.map((key) => [key, 0]))

    for (let day = new Date(range.from); day < range.to; day = addDays(day, 1)) {
      const key = bucketKeyFor(day, range.groupBy)
      if (availableDays.has(key)) availableDays.set(key, (availableDays.get(key) as number) + totalBeds)

      const dayEnd = addDays(day, 1)
      for (const stay of stays) {
        const occupiesToday = stay.admittedAt < dayEnd && (stay.dischargedAt === null || stay.dischargedAt >= day)
        if (occupiesToday && occupiedDays.has(key)) {
          occupiedDays.set(key, (occupiedDays.get(key) as number) + 1)
        }
      }
    }

    return keys.map((bucket) => ({
      bucket,
      value: percentOf(occupiedDays.get(bucket) ?? 0, availableDays.get(bucket) ?? 0),
    }))
  }

  private buildWardOccupancy(
    wards: Array<{ id: string; name: string; type: string }>,
    beds: Array<{ wardId: string; status: string }>,
    admissions: Array<{ wardId: string }>,
    discharged: Array<{ wardId: string; admittedAt: Date; dischargedAt: Date | null }>,
  ): WardOccupancyRow[] {
    return wards
      .map((ward) => {
        const wardBeds = beds.filter((b) => b.wardId === ward.id)
        const occupied = wardBeds.filter((b) => b.status === 'OCCUPIED').length
        const stays = discharged
          .filter((a) => a.wardId === ward.id && a.dischargedAt)
          .map((a) => daysBetween(a.admittedAt, a.dischargedAt as Date))

        return {
          wardId: ward.id,
          wardName: ward.name,
          wardType: ward.type,
          totalBeds: wardBeds.length,
          occupiedBeds: occupied,
          availableBeds: wardBeds.filter((b) => b.status === 'AVAILABLE').length,
          occupancyPercent: percentOf(occupied, wardBeds.length),
          admissionsInPeriod: admissions.filter((a) => a.wardId === ward.id).length,
          averageStayDays: average(stays),
        }
      })
      .sort((a, b) => b.occupancyPercent - a.occupancyPercent || b.totalBeds - a.totalBeds)
  }
}
