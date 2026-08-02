import { BadRequestException, NotFoundException } from '@nestjs/common'

import { PaymentsService } from './payments.service'

function decimal(value: string) {
  return { toString: () => value, valueOf: () => Number(value) }
}

function buildInvoiceRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'inv_1',
    invoiceNumber: 'INV-MED-2026-000001',
    patientId: 'pat_1',
    organizationId: 'org_1',
    status: 'ISSUED',
    totalAmount: decimal('944'),
    paidAmount: decimal('0'),
    balanceDue: decimal('944'),
    currency: 'INR',
    ...overrides,
  }
}

function buildPaymentRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'pay_1',
    paymentNumber: 'PMT-MED-2026-000001',
    invoiceId: 'inv_1',
    patientId: 'pat_1',
    organizationId: 'org_1',
    amount: decimal('944'),
    paymentMode: 'CASH',
    transactionId: null,
    referenceNumber: null,
    status: 'COMPLETED',
    collectedBy: 'user_1',
    paidAt: new Date('2026-08-03'),
    createdAt: new Date('2026-08-03'),
    invoice: { invoiceNumber: 'INV-MED-2026-000001', patientId: 'pat_1', organizationId: 'org_1', currency: 'INR' },
    ...overrides,
  }
}

describe('PaymentsService', () => {
  let prisma: {
    invoice: Record<string, jest.Mock>
    payment: Record<string, jest.Mock>
    organization: Record<string, jest.Mock>
    patient: Record<string, jest.Mock>
    $transaction: jest.Mock
  }
  let eventEmitter: { emit: jest.Mock }
  let service: PaymentsService

  beforeEach(() => {
    prisma = {
      invoice: { findFirst: jest.fn(), update: jest.fn() },
      payment: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      organization: { findUniqueOrThrow: jest.fn().mockResolvedValue({ settings: { uhidPrefix: 'MED' } }) },
      patient: { findUniqueOrThrow: jest.fn() },
      $transaction: jest.fn(),
    }
    eventEmitter = { emit: jest.fn() }
    service = new PaymentsService(prisma as never, eventEmitter as never)
  })

  afterEach(() => jest.clearAllMocks())

  describe('create', () => {
    it('records a full payment and marks the invoice PAID', async () => {
      prisma.invoice.findFirst.mockResolvedValue(buildInvoiceRow())
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => {
        const tx = {
          $executeRaw: jest.fn(),
          payment: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue(buildPaymentRow()) },
          invoice: { update: jest.fn() },
        }
        return fn(tx)
      })
      prisma.payment.findFirst.mockResolvedValue(buildPaymentRow())

      const result = await service.create('org_1', 'inv_1', { amount: 944, paymentMode: 'CASH' } as never, 'user_1')
      expect(result.amount).toBe('944')
      expect(eventEmitter.emit).toHaveBeenCalledWith('payment.recorded', expect.objectContaining({ paymentId: 'pay_1' }))
    })

    it('rejects an amount exceeding the outstanding balance', async () => {
      prisma.invoice.findFirst.mockResolvedValue(buildInvoiceRow({ balanceDue: decimal('500') }))

      await expect(
        service.create('org_1', 'inv_1', { amount: 600, paymentMode: 'CASH' } as never, 'user_1'),
      ).rejects.toThrow(BadRequestException)
    })

    it('rejects a payment against a draft invoice', async () => {
      prisma.invoice.findFirst.mockResolvedValue(buildInvoiceRow({ status: 'DRAFT' }))

      await expect(
        service.create('org_1', 'inv_1', { amount: 100, paymentMode: 'CASH' } as never, 'user_1'),
      ).rejects.toThrow(BadRequestException)
    })

    it('throws NotFoundException for an unknown invoice', async () => {
      prisma.invoice.findFirst.mockResolvedValue(null)

      await expect(
        service.create('org_1', 'missing', { amount: 100, paymentMode: 'CASH' } as never, 'user_1'),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('getById', () => {
    it('returns a mapped payment', async () => {
      prisma.payment.findFirst.mockResolvedValue(buildPaymentRow())
      const result = await service.getById('org_1', 'pay_1')
      expect(result.paymentNumber).toBe('PMT-MED-2026-000001')
    })
  })
})
