import { BadRequestException, NotFoundException } from '@nestjs/common'

import { StockService } from './stock.service'

function buildStockRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'stock_1',
    organizationId: 'org_1',
    itemId: 'item_1',
    storeId: 'store_1',
    currentStock: 100,
    reservedStock: 0,
    damagedStock: 0,
    expiredStock: 0,
    lostStock: 0,
    reorderLevel: 10,
    minStock: 5,
    maxStock: 500,
    openingStock: 100,
    openingStockDate: new Date('2026-08-01'),
    createdAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-01'),
    item: { id: 'item_1', name: 'Gloves', code: 'ITM-1', trackBatch: false, trackExpiry: false, trackSerial: false },
    store: { id: 'store_1', name: 'Central', code: 'CTR' },
    batches: [],
    ...overrides,
  }
}

describe('StockService', () => {
  let prisma: {
    inventoryStock: Record<string, jest.Mock>
    inventoryBatch: Record<string, jest.Mock>
    inventoryStockAdjustment: Record<string, jest.Mock>
    $transaction: jest.Mock
  }
  let service: StockService

  beforeEach(() => {
    prisma = {
      inventoryStock: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      inventoryBatch: { update: jest.fn(), count: jest.fn().mockResolvedValue(0) },
      inventoryStockAdjustment: { create: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    }
    // Milestone 18: stock movements announce `inventory_stock.changed`.
    service = new StockService(prisma as never, { emit: jest.fn() } as never)
  })

  afterEach(() => jest.clearAllMocks())

  describe('getById', () => {
    it('computes availableStock as current minus reserved/damaged/expired/lost', async () => {
      prisma.inventoryStock.findFirst.mockResolvedValue(
        buildStockRow({ currentStock: 100, reservedStock: 10, damagedStock: 5, expiredStock: 2, lostStock: 1 }),
      )

      const result = await service.getById('org_1', 'stock_1')

      expect(result.availableStock).toBe(82)
    })

    it('throws NotFoundException when the stock record does not exist', async () => {
      prisma.inventoryStock.findFirst.mockResolvedValue(null)
      await expect(service.getById('org_1', 'missing')).rejects.toThrow(NotFoundException)
    })
  })

  describe('adjust', () => {
    it('rejects a negative quantityDelta for DAMAGE (only CORRECTION allows negative)', async () => {
      prisma.inventoryStock.findUnique.mockResolvedValue(buildStockRow())

      await expect(
        service.adjust('org_1', 'user_1', {
          itemId: 'item_1',
          storeId: 'store_1',
          type: 'DAMAGE',
          quantityDelta: -5,
        } as never),
      ).rejects.toThrow(BadRequestException)
    })

    it('rejects marking more units damaged than are currently available', async () => {
      prisma.inventoryStock.findUnique.mockResolvedValue(buildStockRow({ currentStock: 10, reservedStock: 8 }))

      await expect(
        service.adjust('org_1', 'user_1', {
          itemId: 'item_1',
          storeId: 'store_1',
          type: 'DAMAGE',
          quantityDelta: 5,
        } as never),
      ).rejects.toThrow(BadRequestException)
    })

    it('rejects a CORRECTION that would leave current stock negative', async () => {
      prisma.inventoryStock.findUnique.mockResolvedValue(buildStockRow({ currentStock: 3 }))

      await expect(
        service.adjust('org_1', 'user_1', {
          itemId: 'item_1',
          storeId: 'store_1',
          type: 'CORRECTION',
          quantityDelta: -5,
        } as never),
      ).rejects.toThrow(BadRequestException)
    })

    it('allows a positive CORRECTION and records the ledger entry with the raw delta', async () => {
      prisma.inventoryStock.findUnique.mockResolvedValue(buildStockRow({ currentStock: 50 }))
      prisma.inventoryStock.findFirst.mockResolvedValue(buildStockRow({ currentStock: 55 }))

      await service.adjust('org_1', 'user_1', {
        itemId: 'item_1',
        storeId: 'store_1',
        type: 'CORRECTION',
        quantityDelta: 5,
        reason: 'Found extra units during shelving',
      } as never)

      expect(prisma.inventoryStock.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { currentStock: { increment: 5 } } }),
      )
      expect(prisma.inventoryStockAdjustment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'CORRECTION', quantityDelta: 5 }) }),
      )
    })

    it('records a DAMAGE adjustment as a negative ledger delta and increments damagedStock', async () => {
      prisma.inventoryStock.findUnique.mockResolvedValue(buildStockRow({ currentStock: 50, reservedStock: 0 }))
      prisma.inventoryStock.findFirst.mockResolvedValue(buildStockRow({ currentStock: 45, damagedStock: 5 }))

      await service.adjust('org_1', 'user_1', {
        itemId: 'item_1',
        storeId: 'store_1',
        type: 'DAMAGE',
        quantityDelta: 5,
      } as never)

      expect(prisma.inventoryStock.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { currentStock: { decrement: 5 }, damagedStock: { increment: 5 } } }),
      )
      expect(prisma.inventoryStockAdjustment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'DAMAGE', quantityDelta: -5 }) }),
      )
    })
  })

  describe('issueStock', () => {
    it('throws when the requested quantity exceeds what is available', async () => {
      const tx = {
        inventoryStock: { findUnique: jest.fn().mockResolvedValue(buildStockRow({ currentStock: 10, reservedStock: 8 })), update: jest.fn() },
        inventoryBatch: { update: jest.fn() },
      }

      await expect(service.issueStock(tx as never, 'org_1', 'item_1', 'store_1', 5)).rejects.toThrow(BadRequestException)
    })

    it('decrements currentStock when enough is available', async () => {
      const tx = {
        inventoryStock: { findUnique: jest.fn().mockResolvedValue(buildStockRow({ currentStock: 10, reservedStock: 0 })), update: jest.fn() },
        inventoryBatch: { update: jest.fn() },
      }

      await service.issueStock(tx as never, 'org_1', 'item_1', 'store_1', 5)

      expect(tx.inventoryStock.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { currentStock: { decrement: 5 } } }),
      )
    })
  })
})
