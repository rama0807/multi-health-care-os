import { BadRequestException, ConflictException } from '@nestjs/common'

import { InvoicesService } from './invoices.service'

function decimal(value: string) {
  return { toString: () => value, valueOf: () => Number(value) }
}

function buildInvoiceRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'inv_1',
    invoiceNumber: 'INV-MED-2026-000001',
    patientId: 'pat_1',
    appointmentId: null,
    encounterId: null,
    organizationId: 'org_1',
    status: 'DRAFT',
    type: 'OPD',
    subtotal: decimal('800'),
    discountAmount: decimal('0'),
    taxAmount: decimal('144'),
    totalAmount: decimal('944'),
    paidAmount: decimal('0'),
    balanceDue: decimal('944'),
    currency: 'INR',
    notes: null,
    dueDate: null,
    createdByUserId: 'user_1',
    discountType: null,
    discountValue: null,
    discountReason: null,
    discountApprovalStatus: 'NONE',
    discountRequestedByUserId: null,
    discountApprovedByUserId: null,
    discountApprovedAt: null,
    finalizedAt: null,
    cancelledAt: null,
    cancelReason: null,
    createdAt: new Date('2026-08-03'),
    updatedAt: new Date('2026-08-03'),
    patient: { id: 'pat_1', firstName: 'Jane', lastName: 'Doe', uhid: 'MED-2026-000001' },
    items: [
      {
        id: 'item_1',
        invoiceId: 'inv_1',
        itemName: 'General Consultation',
        itemCode: null,
        category: 'Consultation',
        quantity: 1,
        unitPrice: decimal('800'),
        discountPercent: decimal('0'),
        taxPercent: decimal('18'),
        totalPrice: decimal('944'),
        createdAt: new Date('2026-08-03'),
      },
    ],
    payments: [],
    refunds: [],
    ...overrides,
  }
}

describe('InvoicesService', () => {
  let prisma: {
    patient: Record<string, jest.Mock>
    charge: Record<string, jest.Mock>
    organization: Record<string, jest.Mock>
    invoice: Record<string, jest.Mock>
    invoiceItem: Record<string, jest.Mock>
    $transaction: jest.Mock
  }
  let eventEmitter: { emit: jest.Mock }
  let service: InvoicesService

  beforeEach(() => {
    prisma = {
      patient: { findFirst: jest.fn() },
      charge: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() },
      organization: { findUniqueOrThrow: jest.fn().mockResolvedValue({ settings: { uhidPrefix: 'MED', currency: 'INR' } }) },
      invoice: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
      },
      invoiceItem: { create: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn(),
    }
    eventEmitter = { emit: jest.fn() }
    service = new InvoicesService(prisma as never, eventEmitter as never)
  })

  afterEach(() => jest.clearAllMocks())

  describe('create', () => {
    it('creates a draft invoice from manual line items', async () => {
      prisma.patient.findFirst.mockResolvedValue({ id: 'pat_1' })
      const txInvoice = { id: 'inv_1' }
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => {
        const tx = {
          $executeRaw: jest.fn(),
          invoice: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue(txInvoice) },
          charge: { updateMany: jest.fn() },
        }
        return fn(tx)
      })
      prisma.invoice.findFirst.mockResolvedValue(buildInvoiceRow())

      const result = await service.create('org_1', {
        patientId: 'pat_1',
        type: 'OPD' as never,
        items: [
          { itemName: 'General Consultation', category: 'Consultation', quantity: 1, unitPrice: 800, discountPercent: 0, taxPercent: 18 },
        ],
        chargeIds: [],
      } as never)

      expect(result.invoiceNumber).toBe('INV-MED-2026-000001')
      expect(eventEmitter.emit).toHaveBeenCalledWith('invoice.created', expect.objectContaining({ invoiceId: 'inv_1' }))
    })

    it('rejects when a chargeId is missing/already invoiced', async () => {
      prisma.patient.findFirst.mockResolvedValue({ id: 'pat_1' })
      prisma.charge.findMany.mockResolvedValue([])

      await expect(
        service.create('org_1', { patientId: 'pat_1', type: 'OPD' as never, items: [], chargeIds: ['chg_missing'] } as never),
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe('applyDiscount', () => {
    it('auto-approves and applies totals immediately when the caller can manage billing', async () => {
      prisma.invoice.findFirst.mockResolvedValue(buildInvoiceRow())
      prisma.invoice.update.mockResolvedValue(undefined)

      await service.applyDiscount(
        'org_1',
        'inv_1',
        { discountType: 'PERCENTAGE', discountValue: 10, reason: 'Loyalty discount' } as never,
        'user_1',
        true,
      )

      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ discountApprovalStatus: 'APPROVED' }),
        }),
      )
    })

    it('leaves the request PENDING when the caller cannot manage billing', async () => {
      prisma.invoice.findFirst.mockResolvedValue(buildInvoiceRow())
      prisma.invoice.update.mockResolvedValue(undefined)

      await service.applyDiscount(
        'org_1',
        'inv_1',
        { discountType: 'FLAT', discountValue: 50, reason: 'Goodwill' } as never,
        'user_2',
        false,
      )

      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ discountApprovalStatus: 'PENDING' }) }),
      )
    })

    it('rejects a second discount request while one is already pending', async () => {
      prisma.invoice.findFirst.mockResolvedValue(buildInvoiceRow({ discountApprovalStatus: 'PENDING' }))

      await expect(
        service.applyDiscount(
          'org_1',
          'inv_1',
          { discountType: 'FLAT', discountValue: 50, reason: 'Again' } as never,
          'user_2',
          false,
        ),
      ).rejects.toThrow(ConflictException)
    })

    it('rejects a discount after a payment has been recorded', async () => {
      prisma.invoice.findFirst.mockResolvedValue(buildInvoiceRow({ paidAmount: decimal('500') }))

      await expect(
        service.applyDiscount(
          'org_1',
          'inv_1',
          { discountType: 'FLAT', discountValue: 50, reason: 'Too late' } as never,
          'user_2',
          true,
        ),
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe('finalize', () => {
    it('rejects finalizing with a pending discount request', async () => {
      prisma.invoice.findFirst.mockResolvedValue(buildInvoiceRow({ discountApprovalStatus: 'PENDING' }))

      await expect(service.finalize('org_1', 'inv_1')).rejects.toThrow(BadRequestException)
    })

    it('rejects finalizing an invoice with no items', async () => {
      prisma.invoice.findFirst.mockResolvedValue(buildInvoiceRow({ items: [] }))

      await expect(service.finalize('org_1', 'inv_1')).rejects.toThrow(BadRequestException)
    })

    it('issues a valid draft invoice', async () => {
      prisma.invoice.findFirst.mockResolvedValue(buildInvoiceRow())
      prisma.invoice.update.mockResolvedValue(undefined)

      await service.finalize('org_1', 'inv_1', 'user_1')
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'ISSUED' }) }),
      )
    })
  })

  describe('cancel', () => {
    it('rejects cancelling an invoice with payments recorded', async () => {
      prisma.invoice.findFirst.mockResolvedValue(buildInvoiceRow({ status: 'ISSUED', paidAmount: decimal('200') }))

      await expect(service.cancel('org_1', 'inv_1', { reason: 'test' } as never)).rejects.toThrow(BadRequestException)
    })

    it('cancels a draft invoice and releases swept charges', async () => {
      prisma.invoice.findFirst.mockResolvedValue(buildInvoiceRow())
      const txCharge = { updateMany: jest.fn() }
      const txInvoice = { update: jest.fn() }
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
        fn({ charge: txCharge, invoice: txInvoice }),
      )

      await service.cancel('org_1', 'inv_1', { reason: 'Duplicate' } as never, 'user_1')

      expect(txCharge.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'PENDING', invoiceId: null } }),
      )
      expect(txInvoice.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED' }) }),
      )
    })
  })
})
