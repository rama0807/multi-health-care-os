import { ConflictException, NotFoundException } from '@nestjs/common'

import { PurchaseOrdersService } from './purchase-orders.service'

function buildPo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'po_1',
    organizationId: 'org_1',
    poNumber: 'PO-2026-000001',
    vendorId: 'vendor_1',
    storeId: 'store_1',
    purchaseRequestId: null,
    status: 'DRAFT',
    expectedDeliveryDate: null,
    approvedByUserId: null,
    approvedAt: null,
    cancelReason: null,
    notes: null,
    createdAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-01'),
    vendor: { id: 'vendor_1', name: 'Acme', code: 'V1' },
    store: { id: 'store_1', name: 'Central', code: 'CTR' },
    items: [
      {
        id: 'item_1',
        purchaseOrderId: 'po_1',
        itemId: 'inv_item_1',
        quantityOrdered: 10,
        quantityReceived: 0,
        unitPrice: { toString: () => '100' },
        taxPercent: { toString: () => '18' },
        item: { id: 'inv_item_1', name: 'Gloves', code: 'ITM-1' },
      },
    ],
    ...overrides,
  }
}

describe('PurchaseOrdersService', () => {
  let prisma: { purchaseOrder: Record<string, jest.Mock>; $transaction: jest.Mock }
  let vendorsService: { requireVendor: jest.Mock }
  let storesService: { requireStore: jest.Mock }
  let purchaseRequestsService: { getById: jest.Mock; markConverted: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let service: PurchaseOrdersService

  beforeEach(() => {
    prisma = {
      purchaseOrder: { findFirst: jest.fn(), update: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    }
    vendorsService = { requireVendor: jest.fn() }
    storesService = { requireStore: jest.fn() }
    purchaseRequestsService = { getById: jest.fn(), markConverted: jest.fn() }
    eventEmitter = { emit: jest.fn() }
    service = new PurchaseOrdersService(
      prisma as never,
      vendorsService as never,
      storesService as never,
      purchaseRequestsService as never,
      eventEmitter as never,
    )
  })

  afterEach(() => jest.clearAllMocks())

  describe('getById / toResponse', () => {
    it('computes totalAmount across items including tax', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(
        buildPo({
          items: [
            {
              id: 'i1',
              purchaseOrderId: 'po_1',
              itemId: 'inv_1',
              quantityOrdered: 10,
              quantityReceived: 0,
              unitPrice: { toString: () => '100' },
              taxPercent: { toString: () => '18' },
              item: { id: 'inv_1', name: 'Gloves', code: 'ITM-1' },
            },
            {
              id: 'i2',
              purchaseOrderId: 'po_1',
              itemId: 'inv_2',
              quantityOrdered: 5,
              quantityReceived: 0,
              unitPrice: { toString: () => '50' },
              taxPercent: { toString: () => '0' },
              item: { id: 'inv_2', name: 'Syringes', code: 'ITM-2' },
            },
          ],
        }),
      )

      const result = await service.getById('org_1', 'po_1')

      // (10 * 100 * 1.18) + (5 * 50 * 1) = 1180 + 250 = 1430
      expect(result.totalAmount).toBe('1430.00')
    })

    it('throws NotFoundException for a PO in another organization', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(null)
      await expect(service.getById('org_1', 'missing')).rejects.toThrow(NotFoundException)
    })
  })

  describe('status guards', () => {
    it('rejects submitting a PO that is not in Draft', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(buildPo({ status: 'SENT' }))
      await expect(service.submit('org_1', 'user_1', 'po_1')).rejects.toThrow(ConflictException)
    })

    it('rejects sending a PO that has not been approved', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(buildPo({ status: 'DRAFT' }))
      await expect(service.send('org_1', 'user_1', 'po_1')).rejects.toThrow(ConflictException)
    })

    it('rejects cancelling an already-received PO', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(buildPo({ status: 'RECEIVED' }))
      await expect(service.cancel('org_1', 'user_1', 'po_1', { reason: 'test' } as never)).rejects.toThrow(ConflictException)
    })
  })

  describe('recomputeReceiptStatus', () => {
    it('marks the PO fully RECEIVED once every item is fully received', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(
        buildPo({ items: [{ ...buildPo().items[0], quantityOrdered: 10, quantityReceived: 10 }] }),
      )

      await service.recomputeReceiptStatus('org_1', 'po_1')

      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'RECEIVED' }) }),
      )
    })

    it('marks the PO PARTIALLY_RECEIVED when some but not all items are received', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(
        buildPo({ items: [{ ...buildPo().items[0], quantityOrdered: 10, quantityReceived: 4 }] }),
      )

      await service.recomputeReceiptStatus('org_1', 'po_1')

      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PARTIALLY_RECEIVED' }) }),
      )
    })
  })
})
