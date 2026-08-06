import { InsuranceDashboardStats } from '@medicore/types'
import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'

/** "Today's Claims / Pending Approval / Rejected / Settled / Insurance Revenue / Outstanding" - see ADR-0016. */
@Injectable()
export class InsuranceDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(organizationId: string): Promise<InsuranceDashboardStats> {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const startOfTomorrow = new Date(startOfToday)
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)

    const [todaysClaims, pendingApproval, rejectedClaims, settledClaims, settledShares, outstandingClaims] = await Promise.all([
      this.prisma.insuranceClaim.count({
        where: { organizationId, createdAt: { gte: startOfToday, lt: startOfTomorrow } },
      }),
      this.prisma.insuranceClaim.count({ where: { organizationId, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
      this.prisma.insuranceClaim.count({ where: { organizationId, status: 'REJECTED' } }),
      this.prisma.insuranceClaim.count({ where: { organizationId, status: { in: ['SETTLED', 'PARTIALLY_SETTLED'] } } }),
      this.prisma.insuranceClaim.findMany({
        where: { organizationId, status: { in: ['SETTLED', 'PARTIALLY_SETTLED'] } },
        select: { insuranceShare: true },
      }),
      this.prisma.insuranceClaim.findMany({
        where: { organizationId, status: { notIn: ['CLOSED', 'DRAFT'] }, outstandingAmount: { not: null } },
        select: { outstandingAmount: true },
      }),
    ])

    const sum = (rows: Array<{ [key: string]: unknown }>, key: string) =>
      rows.reduce((total, r) => total + Number(r[key] ?? 0), 0)

    return {
      todaysClaims,
      pendingApproval,
      rejectedClaims,
      settledClaims,
      insuranceRevenue: sum(settledShares, 'insuranceShare').toFixed(2),
      outstandingClaims: sum(outstandingClaims, 'outstandingAmount').toFixed(2),
    }
  }
}
