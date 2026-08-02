import { ConflictException, NotFoundException } from '@nestjs/common'

import { ServiceCatalogService } from './service-catalog.service'

function buildCatalogRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'svc_1',
    organizationId: 'org_1',
    code: 'CONSULT',
    name: 'General Consultation',
    category: 'Consultation',
    price: { toString: () => '800' },
    taxPercent: { toString: () => '18' },
    isActive: true,
    createdAt: new Date('2026-08-03'),
    updatedAt: new Date('2026-08-03'),
    ...overrides,
  }
}

describe('ServiceCatalogService', () => {
  let prisma: { serviceCatalogItem: Record<string, jest.Mock> }
  let service: ServiceCatalogService

  beforeEach(() => {
    prisma = {
      serviceCatalogItem: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
    }
    service = new ServiceCatalogService(prisma as never)
  })

  afterEach(() => jest.clearAllMocks())

  describe('create', () => {
    it('creates a catalog item', async () => {
      prisma.serviceCatalogItem.findUnique.mockResolvedValue(null)
      prisma.serviceCatalogItem.create.mockResolvedValue(buildCatalogRow())

      const result = await service.create('org_1', {
        code: 'CONSULT',
        name: 'General Consultation',
        category: 'Consultation',
        price: 800,
        taxPercent: 18,
      })

      expect(result.name).toBe('General Consultation')
      expect(result.price).toBe('800')
    })

    it('rejects a duplicate code within the org', async () => {
      prisma.serviceCatalogItem.findUnique.mockResolvedValue(buildCatalogRow())

      await expect(
        service.create('org_1', { code: 'CONSULT', name: 'Dup', category: 'Consultation', price: 1, taxPercent: 0 }),
      ).rejects.toThrow(ConflictException)
    })
  })

  describe('update', () => {
    it('throws NotFoundException for an unknown item', async () => {
      prisma.serviceCatalogItem.findFirst.mockResolvedValue(null)

      await expect(service.update('org_1', 'missing', { isActive: false })).rejects.toThrow(NotFoundException)
    })

    it('updates an existing item', async () => {
      prisma.serviceCatalogItem.findFirst.mockResolvedValue(buildCatalogRow())
      prisma.serviceCatalogItem.update.mockResolvedValue(buildCatalogRow({ price: { toString: () => '900' } }))

      const result = await service.update('org_1', 'svc_1', { price: 900 })
      expect(result.price).toBe('900')
    })
  })

  describe('list', () => {
    it('returns paginated results', async () => {
      prisma.serviceCatalogItem.findMany.mockResolvedValue([buildCatalogRow()])
      prisma.serviceCatalogItem.count.mockResolvedValue(1)

      const result = await service.list('org_1', {})
      expect(result.data).toHaveLength(1)
      expect(result.pagination.total).toBe(1)
    })
  })
})
