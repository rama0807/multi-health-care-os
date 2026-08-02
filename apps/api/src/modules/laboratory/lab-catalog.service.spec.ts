import { ConflictException, NotFoundException } from '@nestjs/common'

import { LabCatalogService } from './lab-catalog.service'

function buildCatalogRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'cat_1',
    organizationId: 'org_1',
    testCode: 'CBC',
    testName: 'Complete Blood Count',
    category: 'Hematology',
    unit: 'x10^9/L',
    referenceRangeLow: 4,
    referenceRangeHigh: 11,
    referenceRangeText: null,
    criticalLow: 2,
    criticalHigh: 20,
    isActive: true,
    createdAt: new Date('2026-08-02'),
    updatedAt: new Date('2026-08-02'),
    ...overrides,
  }
}

describe('LabCatalogService', () => {
  let prisma: { labTestCatalogItem: Record<string, jest.Mock> }
  let service: LabCatalogService

  beforeEach(() => {
    prisma = {
      labTestCatalogItem: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    }
    service = new LabCatalogService(prisma as never)
  })

  afterEach(() => jest.clearAllMocks())

  describe('create', () => {
    it('creates a catalog item when the test code is unique for the org', async () => {
      prisma.labTestCatalogItem.findUnique.mockResolvedValue(null)
      prisma.labTestCatalogItem.create.mockResolvedValue(buildCatalogRow())

      const result = await service.create('org_1', {
        testCode: 'CBC',
        testName: 'Complete Blood Count',
        category: 'Hematology',
        referenceRangeLow: 4,
        referenceRangeHigh: 11,
      } as never)

      expect(result.testCode).toBe('CBC')
    })

    it('rejects a duplicate test code within the same org', async () => {
      prisma.labTestCatalogItem.findUnique.mockResolvedValue(buildCatalogRow())

      await expect(
        service.create('org_1', {
          testCode: 'CBC',
          testName: 'Complete Blood Count',
          category: 'Hematology',
          referenceRangeLow: 4,
          referenceRangeHigh: 11,
        } as never),
      ).rejects.toThrow(ConflictException)
    })
  })

  describe('update', () => {
    it('throws NotFoundException for an unknown catalog item', async () => {
      prisma.labTestCatalogItem.findFirst.mockResolvedValue(null)

      await expect(service.update('org_1', 'missing', { isActive: false } as never)).rejects.toThrow(NotFoundException)
    })

    it('deactivates an existing catalog item', async () => {
      prisma.labTestCatalogItem.findFirst.mockResolvedValue(buildCatalogRow())
      prisma.labTestCatalogItem.update.mockResolvedValue(buildCatalogRow({ isActive: false }))

      const result = await service.update('org_1', 'cat_1', { isActive: false } as never)

      expect(result.isActive).toBe(false)
    })
  })
})
