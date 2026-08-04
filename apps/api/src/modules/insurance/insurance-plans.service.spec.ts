import { ConflictException, NotFoundException } from '@nestjs/common'

import { InsurancePlansService } from './insurance-plans.service'

function decimal(value: string) {
  return { toString: () => value }
}

function buildPlanRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'plan_1',
    organizationId: 'org_1',
    providerId: 'prov_1',
    name: 'Gold Plan',
    code: 'GOLD',
    coveragePercent: decimal('80'),
    coPayPercent: decimal('20'),
    deductible: decimal('1000'),
    annualLimit: decimal('500000'),
    perVisitLimit: null,
    networkType: 'CASHLESS',
    isActive: true,
    createdAt: new Date('2026-08-03'),
    updatedAt: new Date('2026-08-03'),
    provider: { id: 'prov_1', name: 'Acme Insurance', code: 'ACME' },
    ...overrides,
  }
}

describe('InsurancePlansService', () => {
  let prisma: { insurancePlan: Record<string, jest.Mock> }
  let providersService: { requireProvider: jest.Mock }
  let service: InsurancePlansService

  beforeEach(() => {
    prisma = {
      insurancePlan: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
    }
    providersService = { requireProvider: jest.fn().mockResolvedValue({ id: 'prov_1' }) }
    service = new InsurancePlansService(prisma as never, providersService as never)
  })

  describe('create', () => {
    it('creates a plan after validating the provider exists', async () => {
      prisma.insurancePlan.findUnique.mockResolvedValue(null)
      prisma.insurancePlan.create.mockResolvedValue(buildPlanRow())

      const result = await service.create('org_1', {
        providerId: 'prov_1',
        name: 'Gold Plan',
        code: 'GOLD',
        coveragePercent: 80,
        coPayPercent: 20,
        deductible: 1000,
        networkType: 'CASHLESS' as never,
      })

      expect(providersService.requireProvider).toHaveBeenCalledWith('org_1', 'prov_1')
      expect(result.provider.name).toBe('Acme Insurance')
    })

    it('rejects a duplicate code for the same provider', async () => {
      prisma.insurancePlan.findUnique.mockResolvedValue(buildPlanRow())

      await expect(
        service.create('org_1', {
          providerId: 'prov_1',
          name: 'Dup',
          code: 'GOLD',
          coveragePercent: 80,
          coPayPercent: 20,
          deductible: 0,
          networkType: 'CASHLESS' as never,
        }),
      ).rejects.toThrow(ConflictException)
    })
  })

  describe('update', () => {
    it('throws NotFoundException for an unknown plan', async () => {
      prisma.insurancePlan.findFirst.mockResolvedValue(null)
      await expect(service.update('org_1', 'missing', { isActive: false })).rejects.toThrow(NotFoundException)
    })
  })

  describe('requirePlan', () => {
    it('throws NotFoundException when not found', async () => {
      prisma.insurancePlan.findFirst.mockResolvedValue(null)
      await expect(service.requirePlan('org_1', 'missing')).rejects.toThrow(NotFoundException)
    })
  })
})
