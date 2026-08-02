import { BadRequestException } from '@nestjs/common'

import { RefundsService } from './refunds.service'

function decimal(value: string) {
  return { toString: () => value, valueOf: () => Number(value) }
}

function buildInvoiceRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'inv_1',
    patientId: 'pat_1',
    organizationId: 'org_1',
    status: 'PAID',
    paidAmount: decimal('944'),
    ...overrides,
  }
}

function buildRefundRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'ref_1',
    refundNumber: 'REF-MED-2026-000001',
    organizationId: 'org_1',
    invoiceId: 'inv_1',
    paymentId: null,
    amount: decimal('944'),
    reason: 'Test refund',
    refundMode: 'CASH',
    status: 'PENDING',
    requestedByUserId: 'user_1',
    approvedByUserId: null,
    approvedAt: null,
    rejectionReason: null,
    refundedAt: null,
    createdAt: new Date('2026-08-03'),
    ...overrides,
  }
}

describe('RefundsService', () => {
  let prisma: {
    invoice: Record<string, jest.Mock>
    payment: Record<string, jest.Mock>
    refund: Record<string, jest.Mock>
    organization: Record<string, jest.Mock>
    $transaction: jest.Mock
  }
  let eventEmitter: { emit: jest.Mock }
  let service: RefundsService

  beforeEach(() => {
    prisma = {
      invoice: { findFirst: jest.fn(), findFirstOrThrow: jest.fn(), update: jest.fn() },
      payment: { findFirst: jest.fn() },
      refund: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
      organization: { findUniqueOrThrow: jest.fn().mockResolvedValue({ settings: { uhidPrefix: 'MED' } }) },
      $transaction: jest.fn(),
    }
    eventEmitter = { emit: jest.fn() }
    service = new RefundsService(prisma as never, eventEmitter as never)
  })

  afterEach(() => jest.clearAllMocks())

  describe('request', () => {
    it('auto-completes and marks the invoice REFUNDED when the caller can manage billing', async () => {
      prisma.invoice.findFirst.mockResolvedValue(buildInvoiceRow())
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => {
        const tx = {
          $executeRaw: jest.fn(),
          refund: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue(buildRefundRow({ status: 'COMPLETED' })) },
          invoice: { update: jest.fn() },
        }
        return fn(tx)
      })

      const result = await service.request(
        'org_1',
        'inv_1',
        { amount: 944, reason: 'Duplicate charge' } as never,
        'user_1',
        true,
      )
      expect(result.status).toBe('COMPLETED')
    })

    it('leaves the request PENDING when the caller cannot manage billing', async () => {
      prisma.invoice.findFirst.mockResolvedValue(buildInvoiceRow())
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => {
        const tx = {
          $executeRaw: jest.fn(),
          refund: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue(buildRefundRow()) },
          invoice: { update: jest.fn() },
        }
        return fn(tx)
      })

      const result = await service.request(
        'org_1',
        'inv_1',
        { amount: 944, reason: 'Duplicate charge' } as never,
        'user_2',
        false,
      )
      expect(result.status).toBe('PENDING')
    })

    it('rejects a refund exceeding the paid amount', async () => {
      prisma.invoice.findFirst.mockResolvedValue(buildInvoiceRow({ paidAmount: decimal('500') }))

      await expect(
        service.request('org_1', 'inv_1', { amount: 600, reason: 'Too much' } as never, 'user_1', true),
      ).rejects.toThrow(BadRequestException)
    })

    it('rejects a refund against an unpaid invoice', async () => {
      prisma.invoice.findFirst.mockResolvedValue(buildInvoiceRow({ status: 'DRAFT', paidAmount: decimal('0') }))

      await expect(
        service.request('org_1', 'inv_1', { amount: 100, reason: 'Test' } as never, 'user_1', true),
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe('approve', () => {
    it('completes a pending refund', async () => {
      prisma.refund.findFirst.mockResolvedValue(buildRefundRow())
      prisma.invoice.findFirstOrThrow.mockResolvedValue(buildInvoiceRow())
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => {
        const tx = { refund: { update: jest.fn().mockResolvedValue(buildRefundRow({ status: 'COMPLETED' })) }, invoice: { update: jest.fn() } }
        return fn(tx)
      })

      const result = await service.approve('org_1', 'ref_1', 'admin_1')
      expect(result.status).toBe('COMPLETED')
    })

    it('rejects approving a non-pending refund', async () => {
      prisma.refund.findFirst.mockResolvedValue(buildRefundRow({ status: 'REJECTED' }))

      await expect(service.approve('org_1', 'ref_1', 'admin_1')).rejects.toThrow(BadRequestException)
    })
  })

  describe('reject', () => {
    it('rejects a pending refund with a reason', async () => {
      prisma.refund.findFirst.mockResolvedValue(buildRefundRow())
      prisma.refund.update.mockResolvedValue(buildRefundRow({ status: 'REJECTED', rejectionReason: 'Not eligible' }))
      prisma.invoice.findFirstOrThrow.mockResolvedValue(buildInvoiceRow())

      const result = await service.reject('org_1', 'ref_1', { reason: 'Not eligible' } as never, 'admin_1')
      expect(result.status).toBe('REJECTED')
    })
  })
})
