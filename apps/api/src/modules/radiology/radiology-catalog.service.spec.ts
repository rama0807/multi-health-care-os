import { ConflictException, NotFoundException } from '@nestjs/common'

import { RadiologyCatalogService } from './radiology-catalog.service'

function buildCatalogRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'cat_1',
    organizationId: 'org_1',
    code: 'XR-CHEST',
    name: 'X-Ray Chest',
    category: 'X-Ray',
    modality: 'X_RAY',
    bodyPart: 'Chest',
    contrastRequired: false,
    price: { toString: () => '500.00' },
    estimatedDurationMinutes: 15,
    isActive: true,
    createdAt: new Date('2026-08-02'),
    updatedAt: new Date('2026-08-02'),
    ...overrides,
  }
}

describe('RadiologyCatalogService', () => {
  let prisma: { radiologyCatalogItem: Record<string, jest.Mock> }
  let service: RadiologyCatalogService

  beforeEach(() => {
    prisma = {
      radiologyCatalogItem: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    }
    service = new RadiologyCatalogService(prisma as never)
  })

  afterEach(() => jest.clearAllMocks())

  describe('create', () => {
    it('creates a catalog item when the code is unique for the org', async () => {
      prisma.radiologyCatalogItem.findUnique.mockResolvedValue(null)
      prisma.radiologyCatalogItem.create.mockResolvedValue(buildCatalogRow())

      const result = await service.create('org_1', {
        code: 'XR-CHEST',
        name: 'X-Ray Chest',
        category: 'X-Ray',
        modality: 'X_RAY',
        bodyPart: 'Chest',
        contrastRequired: false,
        price: 500,
        estimatedDurationMinutes: 15,
      } as never)

      expect(result.code).toBe('XR-CHEST')
      expect(result.price).toBe('500.00')
    })

    it('rejects a duplicate code within the same org', async () => {
      prisma.radiologyCatalogItem.findUnique.mockResolvedValue(buildCatalogRow())

      await expect(
        service.create('org_1', {
          code: 'XR-CHEST',
          name: 'X-Ray Chest',
          category: 'X-Ray',
          modality: 'X_RAY',
          bodyPart: 'Chest',
          contrastRequired: false,
          price: 500,
          estimatedDurationMinutes: 15,
        } as never),
      ).rejects.toThrow(ConflictException)
    })
  })

  describe('update', () => {
    it('throws NotFoundException for an unknown catalog item', async () => {
      prisma.radiologyCatalogItem.findFirst.mockResolvedValue(null)

      await expect(service.update('org_1', 'missing', { isActive: false } as never)).rejects.toThrow(NotFoundException)
    })

    it('deactivates an existing catalog item', async () => {
      prisma.radiologyCatalogItem.findFirst.mockResolvedValue(buildCatalogRow())
      prisma.radiologyCatalogItem.update.mockResolvedValue(buildCatalogRow({ isActive: false }))

      const result = await service.update('org_1', 'cat_1', { isActive: false } as never)

      expect(result.isActive).toBe(false)
    })
  })
})
