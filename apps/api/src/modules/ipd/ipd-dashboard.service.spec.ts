import { IpdDashboardService } from './ipd-dashboard.service'

describe('IpdDashboardService', () => {
  let prisma: {
    bed: Record<string, jest.Mock>
    admission: Record<string, jest.Mock>
    bedTransfer: Record<string, jest.Mock>
    nursingTask: Record<string, jest.Mock>
  }
  let service: IpdDashboardService

  beforeEach(() => {
    prisma = {
      bed: {
        count: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      admission: { count: jest.fn().mockResolvedValue(0) },
      bedTransfer: { count: jest.fn().mockResolvedValue(0) },
      nursingTask: { count: jest.fn().mockResolvedValue(0) },
    }
    service = new IpdDashboardService(prisma as never)
  })

  it('computes bed and ICU occupancy from real counts', async () => {
    prisma.bed.count.mockResolvedValueOnce(10).mockResolvedValueOnce(4).mockResolvedValueOnce(6)
    prisma.bed.findMany.mockResolvedValue([{ status: 'OCCUPIED' }, { status: 'OCCUPIED' }, { status: 'AVAILABLE' }])
    prisma.admission.count.mockResolvedValueOnce(3).mockResolvedValueOnce(0)
    prisma.bedTransfer.count.mockResolvedValue(2)

    const stats = await service.getStats('org_1')

    expect(stats.totalBeds).toBe(10)
    expect(stats.availableBeds).toBe(4)
    expect(stats.occupiedBeds).toBe(6)
    expect(stats.icuTotalBeds).toBe(3)
    expect(stats.icuOccupiedBeds).toBe(2)
    expect(stats.icuOccupancyPercent).toBe(67)
    expect(stats.admissionsToday).toBe(3)
    expect(stats.dischargesToday).toBe(0)
    expect(stats.transfersToday).toBe(2)
  })

  it('reports 0% ICU occupancy when there are no ICU beds', async () => {
    prisma.bed.findMany.mockResolvedValue([])

    const stats = await service.getStats('org_1')
    expect(stats.icuOccupancyPercent).toBe(0)
  })
})
