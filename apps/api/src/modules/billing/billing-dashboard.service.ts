import { BillingDashboardStats } from '@medicore/types'
import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'

const TREND_DAYS = 7

/** Revenue dashboard — see ADR-0015. */
@Injectable()
export class BillingDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(organizationId: string): Promise<BillingDashboardStats> {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const startOfTomorrow = new Date(startOfToday)
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)

    const [todaysPayments, pendingInvoices, outstandingInvoices, refundsToday, pendingDiscountApprovals, pendingRefundApprovals, trendPayments] =
      await Promise.all([
        this.prisma.payment.findMany({
          where: { organizationId, paidAt: { gte: startOfToday, lt: startOfTomorrow } },
          select: { amount: true },
        }),
        this.prisma.invoice.count({
          where: { organizationId, status: { in: ['DRAFT', 'ISSUED', 'PARTIALLY_PAID'] } },
        }),
        this.prisma.invoice.findMany({
          where: { organizationId, status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] } },
          select: { balanceDue: true },
        }),
        this.prisma.refund.findMany({
          where: { organizationId, status: 'COMPLETED', refundedAt: { gte: startOfToday, lt: startOfTomorrow } },
          select: { amount: true },
        }),
        this.prisma.invoice.count({ where: { organizationId, discountApprovalStatus: 'PENDING' } }),
        this.prisma.refund.count({ where: { organizationId, status: 'PENDING' } }),
        this.prisma.payment.findMany({
          where: { organizationId, paidAt: { gte: this.daysAgo(TREND_DAYS - 1, startOfToday) } },
          select: { amount: true, paidAt: true },
        }),
      ])

    const sum = (rows: Array<{ amount: unknown }>) => rows.reduce((total, r) => total + Number(r.amount), 0)

    const collectionTrend: Array<{ date: string; amount: string }> = []
    for (let i = TREND_DAYS - 1; i >= 0; i--) {
      const dayStart = this.daysAgo(i, startOfToday)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)
      const dayTotal = trendPayments
        .filter((p) => p.paidAt >= dayStart && p.paidAt < dayEnd)
        .reduce((total, p) => total + Number(p.amount), 0)
      collectionTrend.push({ date: dayStart.toISOString().slice(0, 10), amount: dayTotal.toFixed(2) })
    }

    return {
      todaysRevenue: sum(todaysPayments).toFixed(2),
      pendingInvoices,
      outstandingBalance: sum(outstandingInvoices.map((i) => ({ amount: i.balanceDue }))).toFixed(2),
      refundsToday: sum(refundsToday).toFixed(2),
      pendingDiscountApprovals,
      pendingRefundApprovals,
      collectionTrend,
    }
  }

  private daysAgo(days: number, from: Date): Date {
    const date = new Date(from)
    date.setDate(date.getDate() - days)
    return date
  }
}
