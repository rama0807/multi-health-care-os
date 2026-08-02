import { BillingDashboardService } from './billing-dashboard.service'

describe('BillingDashboardService', () => {
  let prisma: {
    payment: Record<string, jest.Mock>
    invoice: Record<string, jest.Mock>
    refund: Record<string, jest.Mock>
  }
  let service: BillingDashboardService

  beforeEach(() => {
    prisma = {
      payment: { findMany: jest.fn().mockResolvedValue([]) },
      invoice: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      refund: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    }
    service = new BillingDashboardService(prisma as never)
  })

  afterEach(() => jest.clearAllMocks())

  it('returns zeroed stats with a 7-day trend when there is no activity', async () => {
    const stats = await service.getStats('org_1')
    expect(stats.todaysRevenue).toBe('0.00')
    expect(stats.pendingInvoices).toBe(0)
    expect(stats.outstandingBalance).toBe('0.00')
    expect(stats.collectionTrend).toHaveLength(7)
  })

  it('sums today\'s payments and outstanding balances', async () => {
    prisma.payment.findMany.mockResolvedValue([
      { amount: { toString: () => '100', valueOf: () => 100 } },
      { amount: { toString: () => '200', valueOf: () => 200 } },
    ])
    prisma.invoice.findMany.mockResolvedValue([
      { balanceDue: { toString: () => '50', valueOf: () => 50 } },
    ])

    const stats = await service.getStats('org_1')
    expect(stats.todaysRevenue).toBe('300.00')
    expect(stats.outstandingBalance).toBe('50.00')
  })
})
