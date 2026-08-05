import { InsuranceProviderPerformanceRow, InsuranceReport, ReportFilterQuery } from '@medicore/types'
import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'

import {
  average,
  countSeries,
  daysBetween,
  percentOf,
  resolveRange,
  sumBy,
  toBreakdown,
  toNumber,
  toPeriod,
} from './report-range.util'

/** A claim the payer has finished adjudicating, one way or the other. */
const DECIDED_STATUSES: readonly string[] = [
  'APPROVED',
  'PARTIALLY_APPROVED',
  'REJECTED',
  'SETTLED',
  'PARTIALLY_SETTLED',
  'CLOSED',
]

/** Money has actually moved. */
const SETTLED_STATUSES: readonly string[] = ['SETTLED', 'PARTIALLY_SETTLED']

/** Still with the payer. */
const PENDING_STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW'] as const

/**
 * Insurance reporting (Checkpoint 17.1).
 *
 * Settlement ratio is measured against **decided** claims, not all claims —
 * including still-pending claims in the denominator would make a healthy
 * payer look bad purely because a batch was submitted late in the window.
 */
@Injectable()
export class InsuranceReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(organizationId: string, query: ReportFilterQuery = {}): Promise<InsuranceReport> {
    const range = resolveRange(query)
    const window = { gte: range.from, lt: range.to }

    const [claims, statusGroups, pending, pendingPreAuths, decidedPreAuths] = await Promise.all([
      this.prisma.insuranceClaim.findMany({
        where: { organizationId, createdAt: window },
        select: {
          createdAt: true,
          status: true,
          claimedAmount: true,
          approvedAmount: true,
          insuranceShare: true,
          submittedAt: true,
          settledAt: true,
          providerId: true,
          provider: { select: { name: true } },
          insuranceProvider: true,
        },
      }),
      this.prisma.insuranceClaim.groupBy({
        by: ['status'],
        where: { organizationId, createdAt: window },
        _count: true,
      }),
      this.prisma.insuranceClaim.findMany({
        where: { organizationId, status: { in: [...PENDING_STATUSES] } },
        select: { claimedAmount: true },
      }),
      this.prisma.preAuthorization.count({
        where: { organizationId, status: { in: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW'] } },
      }),
      this.prisma.preAuthorization.findMany({
        where: { organizationId, decidedAt: window, submittedAt: { not: null } },
        select: { submittedAt: true, decidedAt: true },
      }),
    ])

    const decided = claims.filter((c) => DECIDED_STATUSES.includes(c.status))
    const settled = claims.filter((c) => SETTLED_STATUSES.includes(c.status))

    // Settlement time is only meaningful for claims that carry both
    // timestamps; a claim settled without ever being marked submitted is
    // excluded rather than counted as a zero-day settlement.
    const settlementDays = claims
      .filter((c) => c.submittedAt && c.settledAt)
      .map((c) => daysBetween(c.submittedAt as Date, c.settledAt as Date))

    const preAuthDays = decidedPreAuths
      .filter((p) => p.submittedAt && p.decidedAt)
      .map((p) => daysBetween(p.submittedAt as Date, p.decidedAt as Date))

    return {
      period: toPeriod(range),
      claims: claims.length,
      claimedAmount: sumBy(claims, (c) => toNumber(c.claimedAmount)).toFixed(2),
      approvedAmount: sumBy(claims, (c) => toNumber(c.approvedAmount)).toFixed(2),
      // What the insurer actually pays is `insuranceShare` on a settled
      // claim — `approvedAmount` is the adjudicated figure, which is not the
      // same thing once co-pay and write-off are applied.
      settledAmount: sumBy(settled, (c) => toNumber(c.insuranceShare)).toFixed(2),
      byStatus: toBreakdown(statusGroups, (g) => g.status),
      claimTrend: countSeries(claims, range, (c) => c.createdAt),
      settlementRatePercent: percentOf(settled.length, decided.length),
      averageSettlementDays: average(settlementDays),
      averagePreAuthApprovalDays: average(preAuthDays),
      pendingClaims: pending.length,
      pendingClaimedAmount: sumBy(pending, (c) => toNumber(c.claimedAmount)).toFixed(2),
      pendingPreAuthorizations: pendingPreAuths,
      byProvider: this.buildProviderPerformance(claims),
    }
  }

  private buildProviderPerformance(
    claims: Array<{
      status: string
      claimedAmount: unknown
      approvedAmount: unknown
      submittedAt: Date | null
      settledAt: Date | null
      providerId: string | null
      provider: { name: string } | null
      insuranceProvider: string
    }>,
  ): InsuranceProviderPerformanceRow[] {
    const byProvider = new Map<
      string,
      {
        providerId: string | null
        providerName: string
        claims: number
        claimed: number
        approved: number
        settledClaims: number
        decidedClaims: number
        approvalDays: number[]
      }
    >()

    for (const claim of claims) {
      // Fall back to the denormalized `insuranceProvider` string the claim
      // captured at creation time — ADR-0016 keeps it precisely so a claim
      // still names its payer when the structured record is gone.
      const name = claim.provider?.name ?? claim.insuranceProvider
      const key = claim.providerId ?? `name:${name}`

      const entry = byProvider.get(key) ?? {
        providerId: claim.providerId,
        providerName: name,
        claims: 0,
        claimed: 0,
        approved: 0,
        settledClaims: 0,
        decidedClaims: 0,
        approvalDays: [] as number[],
      }

      entry.claims++
      entry.claimed += toNumber(claim.claimedAmount)
      entry.approved += toNumber(claim.approvedAmount)
      if (SETTLED_STATUSES.includes(claim.status)) entry.settledClaims++
      if (DECIDED_STATUSES.includes(claim.status)) entry.decidedClaims++
      if (claim.submittedAt && claim.settledAt) {
        entry.approvalDays.push(daysBetween(claim.submittedAt, claim.settledAt))
      }

      byProvider.set(key, entry)
    }

    return [...byProvider.values()]
      .map((entry) => ({
        providerId: entry.providerId,
        providerName: entry.providerName,
        claims: entry.claims,
        claimedAmount: entry.claimed.toFixed(2),
        approvedAmount: entry.approved.toFixed(2),
        settledClaims: entry.settledClaims,
        settlementRatePercent: percentOf(entry.settledClaims, entry.decidedClaims),
        averageApprovalDays: average(entry.approvalDays),
      }))
      .sort((a, b) => Number(b.claimedAmount) - Number(a.claimedAmount))
  }
}
