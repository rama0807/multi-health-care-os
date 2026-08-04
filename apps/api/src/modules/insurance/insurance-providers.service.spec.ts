import { ConflictException, NotFoundException } from '@nestjs/common'

import { InsuranceProvidersService } from './insurance-providers.service'

function buildProviderRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'prov_1',
    organizationId: 'org_1',
    name: 'Acme Insurance',
    code: 'ACME',
    type: 'INSURANCE_COMPANY',
    contactPerson: null,
    email: null,
    phone: null,
    address: null,
    isActive: true,
    createdAt: new Date('2026-08-03'),
    updatedAt: new Date('2026-08-03'),
    ...overrides,
  }
}

describe('InsuranceProvidersService', () => {
  let prisma: { insuranceProvider: Record<string, jest.Mock> }
  let service: InsuranceProvidersService

  beforeEach(() => {
    prisma = {
      insuranceProvider: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
    }
    service = new InsuranceProvidersService(prisma as never)
  })

  describe('create', () => {
    it('creates a provider', async () => {
      prisma.insuranceProvider.findUnique.mockResolvedValue(null)
      prisma.insuranceProvider.create.mockResolvedValue(buildProviderRow())

      const result = await service.create('org_1', {
        name: 'Acme Insurance',
        code: 'ACME',
        type: 'INSURANCE_COMPANY' as never,
      })

      expect(result.name).toBe('Acme Insurance')
    })

    it('rejects a duplicate code within the org', async () => {
      prisma.insuranceProvider.findUnique.mockResolvedValue(buildProviderRow())

      await expect(
        service.create('org_1', { name: 'Dup', code: 'ACME', type: 'INSURANCE_COMPANY' as never }),
      ).rejects.toThrow(ConflictException)
    })
  })

  describe('update', () => {
    it('throws NotFoundException for an unknown provider', async () => {
      prisma.insuranceProvider.findFirst.mockResolvedValue(null)

      await expect(service.update('org_1', 'missing', { isActive: false })).rejects.toThrow(NotFoundException)
    })

    it('updates an existing provider', async () => {
      prisma.insuranceProvider.findFirst.mockResolvedValue(buildProviderRow())
      prisma.insuranceProvider.update.mockResolvedValue(buildProviderRow({ isActive: false }))

      const result = await service.update('org_1', 'prov_1', { isActive: false })
      expect(result.isActive).toBe(false)
    })
  })

  describe('requireProvider', () => {
    it('throws NotFoundException when not found', async () => {
      prisma.insuranceProvider.findFirst.mockResolvedValue(null)
      await expect(service.requireProvider('org_1', 'missing')).rejects.toThrow(NotFoundException)
    })
  })

  describe('list', () => {
    it('returns paginated results', async () => {
      prisma.insuranceProvider.findMany.mockResolvedValue([buildProviderRow()])
      prisma.insuranceProvider.count.mockResolvedValue(1)

      const result = await service.list('org_1', {})
      expect(result.data).toHaveLength(1)
      expect(result.pagination.total).toBe(1)
    })
  })
})
