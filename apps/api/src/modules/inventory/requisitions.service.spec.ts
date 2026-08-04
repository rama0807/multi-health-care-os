import { BadRequestException, ConflictException } from '@nestjs/common'

import { RequisitionsService } from './requisitions.service'

function buildRequisition(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'req_1',
    organizationId: 'org_1',
    requisitionNumber: 'REQ-2026-000001',
    fromStoreId: 'central_1',
    toStoreId: 'icu_1',
    requestedByUserId: 'user_1',
    status: 'APPROVED',
    priority: 'ROUTINE',
    notes: null,
    approvedByUserId: 'user_2',
    approvedAt: new Date('2026-08-01'),
    rejectionReason: null,
    issuedByUserId: null,
    issuedAt: null,
    receivedByUserId: null,
    receivedAt: null,
    cancelReason: null,
    createdAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-01'),
    fromStore: { id: 'central_1', name: 'Central', code: 'CTR' },
    toStore: { id: 'icu_1', name: 'ICU', code: 'ICU' },
    items: [
      {
        id: 'reqitem_1',
        storeRequisitionId: 'req_1',
        itemId: 'item_1',
        batchId: null,
        quantityRequested: 10,
        quantityIssued: 0,
        quantityReceived: 0,
        item: { id: 'item_1', name: 'Gloves', code: 'ITM-1' },
      },
    ],
    ...overrides,
  }
}

describe('RequisitionsService', () => {
  let prisma: {
    storeRequisition: Record<string, jest.Mock>
    storeRequisitionItem: Record<string, jest.Mock>
    $transaction: jest.Mock
  }
  let stockService: { issueStock: jest.Mock; receiveStock: jest.Mock; recordLedger: jest.Mock }
  let storesService: { requireStore: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let service: RequisitionsService

  beforeEach(() => {
    prisma = {
      storeRequisition: { findFirst: jest.fn(), update: jest.fn() },
      storeRequisitionItem: { update: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    }
    stockService = { issueStock: jest.fn(), receiveStock: jest.fn(), recordLedger: jest.fn() }
    storesService = { requireStore: jest.fn() }
    eventEmitter = { emit: jest.fn() }
    service = new RequisitionsService(prisma as never, stockService as never, storesService as never, eventEmitter as never)
  })

  afterEach(() => jest.clearAllMocks())

  describe('issue', () => {
    it('rejects issuing more than what remains requested', async () => {
      prisma.storeRequisition.findFirst.mockResolvedValue(buildRequisition())

      await expect(
        service.issue('org_1', 'user_1', 'req_1', {
          items: [{ storeRequisitionItemId: 'reqitem_1', quantityIssued: 20 }],
        } as never),
      ).rejects.toThrow(BadRequestException)
    })

    it('moves status to PARTIALLY_ISSUED when only some of an item is issued', async () => {
      prisma.storeRequisition.findFirst
        .mockResolvedValueOnce(buildRequisition())
        .mockResolvedValueOnce(buildRequisition({ status: 'PARTIALLY_ISSUED', items: [{ ...buildRequisition().items[0], quantityIssued: 4 }] }))
      prisma.storeRequisitionItem.findMany.mockResolvedValue([{ quantityIssued: 4, quantityRequested: 10 }])

      await service.issue('org_1', 'user_1', 'req_1', {
        items: [{ storeRequisitionItemId: 'reqitem_1', quantityIssued: 4 }],
      } as never)

      expect(prisma.storeRequisition.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PARTIALLY_ISSUED' }) }),
      )
    })

    it('moves status to ISSUED once every item is fully issued', async () => {
      prisma.storeRequisition.findFirst
        .mockResolvedValueOnce(buildRequisition())
        .mockResolvedValueOnce(buildRequisition({ status: 'ISSUED', items: [{ ...buildRequisition().items[0], quantityIssued: 10 }] }))
      prisma.storeRequisitionItem.findMany.mockResolvedValue([{ quantityIssued: 10, quantityRequested: 10 }])

      await service.issue('org_1', 'user_1', 'req_1', {
        items: [{ storeRequisitionItemId: 'reqitem_1', quantityIssued: 10 }],
      } as never)

      expect(prisma.storeRequisition.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'ISSUED' }) }),
      )
    })

    it('rejects issuing against a requisition that has not been approved', async () => {
      prisma.storeRequisition.findFirst.mockResolvedValue(buildRequisition({ status: 'REQUESTED' }))

      await expect(
        service.issue('org_1', 'user_1', 'req_1', {
          items: [{ storeRequisitionItemId: 'reqitem_1', quantityIssued: 1 }],
        } as never),
      ).rejects.toThrow(ConflictException)
    })
  })

  describe('receive', () => {
    it('only marks RECEIVED once every issued unit has also been received', async () => {
      const issuedReq = buildRequisition({ status: 'ISSUED', items: [{ ...buildRequisition().items[0], quantityIssued: 10 }] })
      prisma.storeRequisition.findFirst.mockResolvedValueOnce(issuedReq).mockResolvedValueOnce(issuedReq)
      prisma.storeRequisitionItem.findMany.mockResolvedValue([{ quantityIssued: 10, quantityReceived: 6 }])

      await service.receive('org_1', 'user_1', 'req_1', {
        items: [{ storeRequisitionItemId: 'reqitem_1', quantityReceived: 6 }],
      } as never)

      expect(prisma.storeRequisition.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'RECEIVED' }) }),
      )
    })
  })
})
