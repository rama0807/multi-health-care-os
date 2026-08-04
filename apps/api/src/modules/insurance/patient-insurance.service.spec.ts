import { PatientInsuranceStatus } from '@medicore/types'
import { ConflictException, NotFoundException } from '@nestjs/common'

import { PatientInsuranceService } from './patient-insurance.service'

function decimal(value: string) {
  return { toString: () => value }
}

function buildCoverageRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'cov_1',
    organizationId: 'org_1',
    patientId: 'pat_1',
    providerId: 'prov_1',
    planId: 'plan_1',
    type: 'PRIMARY',
    memberId: 'MEM-1',
    policyNumber: 'POL-1',
    effectiveDate: new Date('2026-01-01'),
    expiryDate: null,
    coveragePercent: null,
    status: 'ACTIVE',
    createdAt: new Date('2026-08-03'),
    updatedAt: new Date('2026-08-03'),
    provider: { id: 'prov_1', name: 'Acme Insurance', code: 'ACME' },
    plan: { id: 'plan_1', name: 'Gold Plan', code: 'GOLD', coveragePercent: decimal('80'), coPayPercent: decimal('20') },
    ...overrides,
  }
}

describe('PatientInsuranceService', () => {
  let prisma: { patient: Record<string, jest.Mock>; patientInsurance: Record<string, jest.Mock> }
  let plansService: { requirePlan: jest.Mock }
  let service: PatientInsuranceService

  beforeEach(() => {
    prisma = {
      patient: { findFirst: jest.fn().mockResolvedValue({ id: 'pat_1' }) },
      patientInsurance: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    }
    plansService = { requirePlan: jest.fn().mockResolvedValue({ id: 'plan_1', providerId: 'prov_1' }) }
    service = new PatientInsuranceService(prisma as never, plansService as never)
  })

  describe('create', () => {
    it('creates a coverage record when the plan belongs to the given provider', async () => {
      prisma.patientInsurance.findFirst.mockResolvedValue(null)
      prisma.patientInsurance.create.mockResolvedValue(buildCoverageRow())

      const result = await service.create('org_1', 'pat_1', {
        providerId: 'prov_1',
        planId: 'plan_1',
        type: 'PRIMARY' as never,
        memberId: 'MEM-1',
        policyNumber: 'POL-1',
        effectiveDate: new Date('2026-01-01'),
      })

      expect(result.memberId).toBe('MEM-1')
    })

    it('rejects when the plan does not belong to the given provider', async () => {
      plansService.requirePlan.mockResolvedValue({ id: 'plan_1', providerId: 'other_provider' })

      await expect(
        service.create('org_1', 'pat_1', {
          providerId: 'prov_1',
          planId: 'plan_1',
          type: 'PRIMARY' as never,
          memberId: 'MEM-1',
          policyNumber: 'POL-1',
          effectiveDate: new Date('2026-01-01'),
        }),
      ).rejects.toThrow(ConflictException)
    })

    it('rejects a second active coverage of the same type', async () => {
      prisma.patientInsurance.findFirst.mockResolvedValue(buildCoverageRow())

      await expect(
        service.create('org_1', 'pat_1', {
          providerId: 'prov_1',
          planId: 'plan_1',
          type: 'PRIMARY' as never,
          memberId: 'MEM-2',
          policyNumber: 'POL-2',
          effectiveDate: new Date('2026-01-01'),
        }),
      ).rejects.toThrow(ConflictException)
    })
  })

  describe('requireActiveCoverage', () => {
    it('throws NotFoundException when the coverage does not exist', async () => {
      prisma.patientInsurance.findFirst.mockResolvedValue(null)
      await expect(service.requireActiveCoverage('org_1', 'missing')).rejects.toThrow(NotFoundException)
    })

    it('throws ConflictException when the coverage is not active', async () => {
      prisma.patientInsurance.findFirst.mockResolvedValue(buildCoverageRow({ status: PatientInsuranceStatus.EXPIRED }))
      await expect(service.requireActiveCoverage('org_1', 'cov_1')).rejects.toThrow(ConflictException)
    })

    it('returns the coverage when active', async () => {
      prisma.patientInsurance.findFirst.mockResolvedValue(buildCoverageRow())
      const result = await service.requireActiveCoverage('org_1', 'cov_1')
      expect(result.id).toBe('cov_1')
    })
  })
})
