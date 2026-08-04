import {
  AdjustStockDto,
  InventoryStockQuery,
  InventoryStockWithRefs,
  SetOpeningStockDto,
  UpdateStockLevelsDto,
} from '@medicore/types'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InventoryBatchStatus, InventoryStock as PrismaInventoryStock, Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

type Tx = Prisma.TransactionClient

type StockWithRefs = PrismaInventoryStock & {
  item: { id: string; name: string; code: string; trackBatch: boolean; trackExpiry: boolean; trackSerial: boolean }
  store: { id: string; name: string; code: string }
  batches: Array<{
    id: string
    organizationId: string
    itemId: string
    storeId: string
    inventoryStockId: string
    batchNumber: string | null
    serialNumber: string | null
    manufactureDate: Date | null
    expiryDate: Date | null
    quantity: number
    status: InventoryBatchStatus
    receivedAt: Date
    createdAt: Date
    updatedAt: Date
  }>
}

const STOCK_INCLUDE = {
  item: { select: { id: true, name: true, code: true, trackBatch: true, trackExpiry: true, trackSerial: true } },
  store: { select: { id: true, name: true, code: true } },
  batches: { where: { status: { not: 'CONSUMED' as InventoryBatchStatus } }, orderBy: { expiryDate: 'asc' as const } },
} satisfies Prisma.InventoryStockInclude

/**
 * Core stock ledger — also exposes `receiveStock`/`issueStock`/
 * `ensureStockRow` for other inventory services (GRN, transfers,
 * requisitions) to call from within their own transactions, so every
 * stock-affecting workflow shares one mutation path rather than each
 * reimplementing currentStock/batch bookkeeping.
 */
@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, query: InventoryStockQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20

    const where: Prisma.InventoryStockWhereInput = { organizationId }
    if (query.storeId) where.storeId = query.storeId
    if (query.itemId) where.itemId = query.itemId
    if (query.expiringWithinDays !== undefined) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() + query.expiringWithinDays)
      where.batches = { some: { expiryDate: { lte: cutoff }, status: 'AVAILABLE' } }
    }

    // `lowStockOnly` compares two columns on the same row — filtered in
    // application code, same pragmatic simplification as `Drug` (TD-0022).
    if (query.lowStockOnly) {
      const all = await this.prisma.inventoryStock.findMany({ where, include: STOCK_INCLUDE })
      const filtered = all.filter((s) => s.currentStock <= s.reorderLevel)
      const total = filtered.length
      const data = filtered.slice((page - 1) * limit, (page - 1) * limit + limit)
      return this.paginated(data.map((s) => this.toResponse(s)), page, limit, total)
    }

    const [data, total] = await Promise.all([
      this.prisma.inventoryStock.findMany({
        where,
        include: STOCK_INCLUDE,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { item: { name: 'asc' } },
      }),
      this.prisma.inventoryStock.count({ where }),
    ])
    return this.paginated(data.map((s) => this.toResponse(s)), page, limit, total)
  }

  async getById(organizationId: string, id: string): Promise<InventoryStockWithRefs> {
    const stock = await this.prisma.inventoryStock.findFirst({ where: { id, organizationId }, include: STOCK_INCLUDE })
    if (!stock) throw new NotFoundException('Stock record not found')
    return this.toResponse(stock)
  }

  async setOpeningStock(
    organizationId: string,
    userId: string,
    dto: SetOpeningStockDto,
  ): Promise<InventoryStockWithRefs> {
    const item = await this.prisma.inventoryItem.findFirst({ where: { id: dto.itemId, organizationId } })
    if (!item) throw new NotFoundException('Item not found')
    await this.requireStoreExists(organizationId, dto.storeId)

    const existing = await this.prisma.inventoryStock.findUnique({
      where: { itemId_storeId: { itemId: dto.itemId, storeId: dto.storeId } },
    })
    if (existing) throw new BadRequestException('Opening stock has already been set for this item/store')

    const stock = await this.prisma.$transaction(async (tx) => {
      const created = await tx.inventoryStock.create({
        data: {
          organizationId,
          itemId: dto.itemId,
          storeId: dto.storeId,
          currentStock: dto.quantity,
          openingStock: dto.quantity,
          openingStockDate: new Date(),
          reorderLevel: dto.reorderLevel,
          minStock: dto.minStock,
          maxStock: dto.maxStock,
        },
      })

      if (dto.quantity > 0 && (item.trackBatch || item.trackSerial || item.trackExpiry)) {
        await tx.inventoryBatch.create({
          data: {
            organizationId,
            itemId: dto.itemId,
            storeId: dto.storeId,
            inventoryStockId: created.id,
            batchNumber: dto.batchNumber,
            serialNumber: dto.serialNumber,
            expiryDate: dto.expiryDate,
            quantity: dto.quantity,
            status: 'AVAILABLE',
          },
        })
      }

      await tx.inventoryStockAdjustment.create({
        data: {
          organizationId,
          itemId: dto.itemId,
          storeId: dto.storeId,
          type: 'OPENING',
          quantityDelta: dto.quantity,
          adjustedByUserId: userId,
        },
      })

      return created
    })

    return this.getById(organizationId, stock.id)
  }

  async updateLevels(organizationId: string, id: string, dto: UpdateStockLevelsDto): Promise<InventoryStockWithRefs> {
    const stock = await this.prisma.inventoryStock.findFirst({ where: { id, organizationId } })
    if (!stock) throw new NotFoundException('Stock record not found')
    await this.prisma.inventoryStock.update({ where: { id }, data: dto })
    return this.getById(organizationId, id)
  }

  /** Damage / loss / expiry (moves units out of `currentStock` into the matching bucket) or a manual correction. */
  async adjust(organizationId: string, userId: string, dto: AdjustStockDto): Promise<InventoryStockWithRefs> {
    const stock = await this.prisma.inventoryStock.findUnique({
      where: { itemId_storeId: { itemId: dto.itemId, storeId: dto.storeId } },
    })
    if (!stock || stock.organizationId !== organizationId) throw new NotFoundException('Stock record not found')

    if (dto.type !== 'CORRECTION' && dto.quantityDelta < 0) {
      throw new BadRequestException(`${dto.type} adjustments must specify a positive quantity`)
    }

    const available = stock.currentStock - stock.reservedStock
    if (dto.type !== 'CORRECTION' && dto.quantityDelta > available) {
      throw new BadRequestException(`Only ${available} unit(s) are available to mark as ${dto.type.toLowerCase()}`)
    }
    if (dto.type === 'CORRECTION' && stock.currentStock + dto.quantityDelta < 0) {
      throw new BadRequestException('Correction would leave current stock negative')
    }

    await this.prisma.$transaction(async (tx) => {
      const bucketField =
        dto.type === 'DAMAGE' ? 'damagedStock' : dto.type === 'LOSS' ? 'lostStock' : dto.type === 'EXPIRY' ? 'expiredStock' : null

      await tx.inventoryStock.update({
        where: { id: stock.id },
        data:
          dto.type === 'CORRECTION'
            ? { currentStock: { increment: dto.quantityDelta } }
            : { currentStock: { decrement: dto.quantityDelta }, [bucketField as string]: { increment: dto.quantityDelta } },
      })

      if (dto.batchId) {
        await tx.inventoryBatch.update({
          where: { id: dto.batchId },
          data:
            dto.type === 'CORRECTION'
              ? { quantity: { increment: dto.quantityDelta } }
              : {
                  quantity: { decrement: dto.quantityDelta },
                  status:
                    dto.type === 'DAMAGE'
                      ? 'DAMAGED'
                      : dto.type === 'EXPIRY'
                        ? 'EXPIRED'
                        : dto.type === 'LOSS'
                          ? 'LOST'
                          : undefined,
                },
        })
      }

      await tx.inventoryStockAdjustment.create({
        data: {
          organizationId,
          itemId: dto.itemId,
          storeId: dto.storeId,
          batchId: dto.batchId,
          type: dto.type,
          quantityDelta: dto.type === 'CORRECTION' ? dto.quantityDelta : -dto.quantityDelta,
          reason: dto.reason,
          adjustedByUserId: userId,
        },
      })
    })

    return this.getById(organizationId, stock.id)
  }

  async countLowStock(organizationId: string): Promise<number> {
    const stocks = await this.prisma.inventoryStock.findMany({
      where: { organizationId },
      select: { currentStock: true, reorderLevel: true },
    })
    return stocks.filter((s) => s.currentStock <= s.reorderLevel).length
  }

  async countExpiringSoon(organizationId: string, withinDays = 30): Promise<number> {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + withinDays)
    return this.prisma.inventoryBatch.count({
      where: { organizationId, status: 'AVAILABLE', expiryDate: { lte: cutoff, gte: new Date() } },
    })
  }

  async countExpired(organizationId: string): Promise<number> {
    return this.prisma.inventoryBatch.count({
      where: { organizationId, status: 'AVAILABLE', expiryDate: { lt: new Date() } },
    })
  }

  async totalInventoryValue(organizationId: string): Promise<string> {
    const stocks = await this.prisma.inventoryStock.findMany({
      where: { organizationId },
      select: { currentStock: true, item: { select: { unitCost: true } } },
    })
    const total = stocks.reduce((sum, s) => sum + s.currentStock * Number(s.item.unitCost), 0)
    return total.toFixed(2)
  }

  // ── Cross-module mutation helpers (used by GRN/transfers/requisitions) ────

  async ensureStockRow(tx: Tx, organizationId: string, itemId: string, storeId: string) {
    return tx.inventoryStock.upsert({
      where: { itemId_storeId: { itemId, storeId } },
      update: {},
      create: { organizationId, itemId, storeId },
    })
  }

  /** Adds physical stock (GRN completion, transfer receipt) — creates/increments a batch when the item tracks one. */
  async receiveStock(
    tx: Tx,
    organizationId: string,
    itemId: string,
    storeId: string,
    quantity: number,
    batchInfo?: { batchNumber?: string; serialNumber?: string; manufactureDate?: Date; expiryDate?: Date },
  ): Promise<void> {
    const stockRow = await this.ensureStockRow(tx, organizationId, itemId, storeId)
    await tx.inventoryStock.update({ where: { id: stockRow.id }, data: { currentStock: { increment: quantity } } })

    const item = await tx.inventoryItem.findUniqueOrThrow({ where: { id: itemId } })
    if (item.trackBatch || item.trackSerial || item.trackExpiry) {
      await tx.inventoryBatch.create({
        data: {
          organizationId,
          itemId,
          storeId,
          inventoryStockId: stockRow.id,
          batchNumber: batchInfo?.batchNumber,
          serialNumber: batchInfo?.serialNumber,
          manufactureDate: batchInfo?.manufactureDate,
          expiryDate: batchInfo?.expiryDate,
          quantity,
          status: 'AVAILABLE',
        },
      })
    }
  }

  /** Removes physical stock (transfer dispatch, requisition issue) — guards against issuing more than is available. */
  async issueStock(
    tx: Tx,
    organizationId: string,
    itemId: string,
    storeId: string,
    quantity: number,
    batchId?: string,
  ): Promise<void> {
    const stock = await tx.inventoryStock.findUnique({ where: { itemId_storeId: { itemId, storeId } } })
    if (!stock || stock.organizationId !== organizationId) {
      throw new BadRequestException('No stock available at the source store for this item')
    }
    const available = stock.currentStock - stock.reservedStock
    if (quantity > available) {
      throw new BadRequestException(`Only ${available} unit(s) of this item are available at the source store`)
    }
    await tx.inventoryStock.update({ where: { id: stock.id }, data: { currentStock: { decrement: quantity } } })
    if (batchId) {
      await tx.inventoryBatch.update({ where: { id: batchId }, data: { quantity: { decrement: quantity } } })
    }
  }

  async recordLedger(
    tx: Tx,
    organizationId: string,
    itemId: string,
    storeId: string,
    type: 'ISSUE' | 'RECEIPT' | 'TRANSFER',
    quantityDelta: number,
    adjustedByUserId: string,
    reference?: { referenceType: string; referenceId: string },
  ): Promise<void> {
    await tx.inventoryStockAdjustment.create({
      data: {
        organizationId,
        itemId,
        storeId,
        type,
        quantityDelta,
        adjustedByUserId,
        referenceType: reference?.referenceType,
        referenceId: reference?.referenceId,
      },
    })
  }

  private async requireStoreExists(organizationId: string, storeId: string) {
    const store = await this.prisma.inventoryStore.findFirst({ where: { id: storeId, organizationId } })
    if (!store) throw new NotFoundException('Store not found')
    return store
  }

  private paginated<T>(data: T[], page: number, limit: number, total: number) {
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    }
  }

  private toResponse(stock: StockWithRefs): InventoryStockWithRefs {
    return {
      id: stock.id,
      organizationId: stock.organizationId,
      itemId: stock.itemId,
      storeId: stock.storeId,
      currentStock: stock.currentStock,
      reservedStock: stock.reservedStock,
      damagedStock: stock.damagedStock,
      expiredStock: stock.expiredStock,
      lostStock: stock.lostStock,
      availableStock: stock.currentStock - stock.reservedStock - stock.damagedStock - stock.expiredStock - stock.lostStock,
      reorderLevel: stock.reorderLevel,
      minStock: stock.minStock,
      maxStock: stock.maxStock,
      openingStock: stock.openingStock,
      openingStockDate: stock.openingStockDate,
      createdAt: stock.createdAt,
      updatedAt: stock.updatedAt,
      item: stock.item,
      store: stock.store,
      batches: stock.batches as unknown as InventoryStockWithRefs['batches'],
    }
  }
}
