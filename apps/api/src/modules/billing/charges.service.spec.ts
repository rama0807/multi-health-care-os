import { BadRequestException, NotFoundException } from '@nestjs/common'

import { ChargesService } from './charges.service'

function buildChargeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'chg_1',
    organizationId: 'org_1',
    patientId: 'pat_1',
    encounterId: null,
    appointmentId: null,
    sourceModule: 'MISCELLANEOUS',
    sourceId: null,
    catalogItemId: null,
    description: 'ECG',
    quantity: 1,
    unitPrice: { toString: () => '300' },
    discountPercent: { toString: () => '0' },
    discountAmount: { toString: () => '0' },
    taxPercent: { toString: () => '18' },
    taxAmount: { toString: () => '54' },
    totalAmount: { toString: () => '354' },
    status: 'PENDING',
    invoiceId: null,
    createdByUserId: 'user_1',
    createdAt: new Date('2026-08-03'),
    ...overrides,
  }
}

describe('ChargesService', () => {
  let prisma: {
    patient: Record<string, jest.Mock>
    serviceCatalogItem: Record<string, jest.Mock>
    charge: Record<string, jest.Mock>
  }
  let eventEmitter: { emit: jest.Mock }
  let service: ChargesService

  beforeEach(() => {
    prisma = {
      patient: { findFirst: jest.fn() },
      serviceCatalogItem: { findFirst: jest.fn() },
      charge: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
      },
    }
    eventEmitter = { emit: jest.fn() }
    service = new ChargesService(prisma as never, eventEmitter as never)
  })

  afterEach(() => jest.clearAllMocks())

  describe('create', () => {
    it('creates an ad-hoc charge and computes tax/total', async () => {
      prisma.patient.findFirst.mockResolvedValue({ id: 'pat_1' })
      prisma.charge.create.mockResolvedValue(buildChargeRow())

      const result = await service.create('org_1', {
        patientId: 'pat_1',
        sourceModule: 'MISCELLANEOUS' as never,
        description: 'ECG',
        quantity: 1,
        unitPrice: 300,
        discountPercent: 0,
        taxPercent: 18,
      } as never)

      expect(result.totalAmount).toBe('354')
      expect(prisma.charge.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ taxAmount: 54, totalAmount: 354 }) }),
      )
      expect(eventEmitter.emit).toHaveBeenCalledWith('charge.created', expect.objectContaining({ chargeId: 'chg_1' }))
    })

    it('resolves description/price from a catalog item when given', async () => {
      prisma.patient.findFirst.mockResolvedValue({ id: 'pat_1' })
      prisma.serviceCatalogItem.findFirst.mockResolvedValue({
        id: 'svc_1',
        name: 'General Consultation',
        price: { toString: () => '800', valueOf: () => 800 },
        taxPercent: { toString: () => '18', valueOf: () => 18 },
        isActive: true,
      })
      prisma.charge.create.mockResolvedValue(buildChargeRow({ description: 'General Consultation' }))

      const result = await service.create('org_1', {
        patientId: 'pat_1',
        sourceModule: 'CONSULTATION' as never,
        catalogItemId: 'svc_1',
        quantity: 1,
        discountPercent: 0,
      } as never)

      expect(result.description).toBe('General Consultation')
    })

    it('throws NotFoundException for an unknown patient', async () => {
      prisma.patient.findFirst.mockResolvedValue(null)

      await expect(
        service.create('org_1', {
          patientId: 'missing',
          sourceModule: 'MISCELLANEOUS' as never,
          description: 'X',
          quantity: 1,
          unitPrice: 10,
          discountPercent: 0,
        } as never),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('void', () => {
    it('voids a pending charge', async () => {
      prisma.charge.findFirst.mockResolvedValue(buildChargeRow())
      prisma.charge.update.mockResolvedValue(buildChargeRow({ status: 'VOIDED' }))

      const result = await service.void('org_1', 'chg_1')
      expect(result.status).toBe('VOIDED')
    })

    it('rejects voiding an already-invoiced charge', async () => {
      prisma.charge.findFirst.mockResolvedValue(buildChargeRow({ status: 'INVOICED' }))

      await expect(service.void('org_1', 'chg_1')).rejects.toThrow(BadRequestException)
    })
  })
})
