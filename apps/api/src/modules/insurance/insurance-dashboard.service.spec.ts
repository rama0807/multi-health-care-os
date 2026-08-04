import { InsuranceDashboardService } from './insurance-dashboard.service'

describe('InsuranceDashboardService', () => {
  let prisma: { insuranceClaim: Record<string, jest.Mock> }
  let service: InsuranceDashboardService

  beforeEach(() => {
    prisma = {
      insuranceClaim: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
    }
    service = new InsuranceDashboardService(prisma as never)
  })

  it('aggregates counts and sums into dashboard stats', async () => {
    prisma.insuranceClaim.count
      .mockResolvedValueOnce(3) // todaysClaims
      .mockResolvedValueOnce(2) // pendingApproval
      .mockResolvedValueOnce(1) // rejectedClaims
      .mockResolvedValueOnce(4) // settledClaims
    prisma.insuranceClaim.findMany
      .mockResolvedValueOnce([{ insuranceShare: { toString: () => '8000' } }, { insuranceShare: { toString: () => '5000' } }])
      .mockResolvedValueOnce([{ outstandingAmount: { toString: () => '2000' } }])

    const stats = await service.getStats('org_1')

    expect(stats.todaysClaims).toBe(3)
    expect(stats.pendingApproval).toBe(2)
    expect(stats.rejectedClaims).toBe(1)
    expect(stats.settledClaims).toBe(4)
    expect(stats.insuranceRevenue).toBe('13000.00')
    expect(stats.outstandingClaims).toBe('2000.00')
  })
})
