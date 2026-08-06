import { CreateStockTransferDto, InventoryStockTransfer, InventoryStockTransferQuery } from '@medicore/types'
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Prisma, StockTransferStatus } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { generateInventoryNumber, yearStart } from './inventory-numbering'
import { StockService } from './stock.service'
import { StoresService } from './stores.service'

const TRANSFER_INCLUDE = { items: true } satisfies Prisma.InventoryStockTransferInclude

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
    private readonly storesService: StoresService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(organizationId: string, query: InventoryStockTransferQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20
    const where: Prisma.InventoryStockTransferWhereInput = { organizationId }
    if (query.status) where.status = query.status
    if (query.storeId) where.OR = [{ fromStoreId: query.storeId }, { toStoreId: query.storeId }]

    const [data, total] = await Promise.all([
      this.prisma.inventoryStockTransfer.findMany({
        where,
        include: TRANSFER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.inventoryStockTransfer.count({ where }),
    ])
    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrev: page > 1 },
    }
  }

  async getById(organizationId: string, id: string): Promise<InventoryStockTransfer> {
    const transfer = await this.requireTransfer(organizationId, id)
    return transfer as unknown as InventoryStockTransfer
  }

  async create(organizationId: string, userId: string, dto: CreateStockTransferDto): Promise<InventoryStockTransfer> {
    if (dto.fromStoreId === dto.toStoreId) throw new BadRequestException('Source and destination stores must differ')
    await this.storesService.requireStore(organizationId, dto.fromStoreId)
    await this.storesService.requireStore(organizationId, dto.toStoreId)

    const transfer = await this.prisma.$transaction(async (tx) => {
      const transferNumber = await generateInventoryNumber(tx, organizationId, 'stock_transfer', 'TRF', () =>
        tx.inventoryStockTransfer.count({ where: { organizationId, createdAt: { gte: yearStart() } } }),
      )
      return tx.inventoryStockTransfer.create({
        data: {
          organizationId,
          transferNumber,
          fromStoreId: dto.fromStoreId,
          toStoreId: dto.toStoreId,
          requestedByUserId: userId,
          notes: dto.notes,
          items: { create: dto.items },
        },
        include: TRANSFER_INCLUDE,
      })
    })
    this.eventEmitter.emit('inventory_stock_transfer.created', { organizationId, userId, transferId: transfer.id })
    return transfer as unknown as InventoryStockTransfer
  }

  /** Deducts stock from the source store - the transfer is now physically in motion. */
  async dispatch(organizationId: string, userId: string, id: string): Promise<InventoryStockTransfer> {
    const transfer = await this.requireTransfer(organizationId, id)
    if (transfer.status !== StockTransferStatus.DRAFT) {
      throw new ConflictException(`Cannot dispatch a transfer in status ${transfer.status}`)
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        await this.stockService.issueStock(tx, organizationId, item.itemId, transfer.fromStoreId, item.quantity, item.batchId ?? undefined)
        await this.stockService.recordLedger(tx, organizationId, item.itemId, transfer.fromStoreId, 'TRANSFER', -item.quantity, userId, {
          referenceType: 'InventoryStockTransfer',
          referenceId: transfer.id,
        })
      }
      await tx.inventoryStockTransfer.update({
        where: { id },
        data: { status: StockTransferStatus.IN_TRANSIT, dispatchedByUserId: userId, dispatchedAt: new Date() },
      })
    })
    this.emitStatusChanged(organizationId, id, userId, transfer.status, StockTransferStatus.IN_TRANSIT)
    const dispatched = await this.requireTransfer(organizationId, id)
    return dispatched as unknown as InventoryStockTransfer
  }

  /** Adds stock at the destination store, completing the transfer. */
  async receive(organizationId: string, userId: string, id: string): Promise<InventoryStockTransfer> {
    const transfer = await this.requireTransfer(organizationId, id)
    if (transfer.status !== StockTransferStatus.IN_TRANSIT) {
      throw new ConflictException(`Cannot receive a transfer in status ${transfer.status}`)
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        await this.stockService.receiveStock(tx, organizationId, item.itemId, transfer.toStoreId, item.quantity)
        await this.stockService.recordLedger(tx, organizationId, item.itemId, transfer.toStoreId, 'TRANSFER', item.quantity, userId, {
          referenceType: 'InventoryStockTransfer',
          referenceId: transfer.id,
        })
      }
      await tx.inventoryStockTransfer.update({
        where: { id },
        data: { status: StockTransferStatus.COMPLETED, receivedByUserId: userId, receivedAt: new Date() },
      })
    })
    this.emitStatusChanged(organizationId, id, userId, transfer.status, StockTransferStatus.COMPLETED)
    const received = await this.requireTransfer(organizationId, id)
    return received as unknown as InventoryStockTransfer
  }

  async cancel(organizationId: string, userId: string, id: string, reason?: string): Promise<InventoryStockTransfer> {
    const transfer = await this.requireTransfer(organizationId, id)
    if (transfer.status === StockTransferStatus.COMPLETED || transfer.status === StockTransferStatus.CANCELLED) {
      throw new ConflictException(`Cannot cancel a transfer in status ${transfer.status}`)
    }

    await this.prisma.$transaction(async (tx) => {
      // A transfer already dispatched (stock deducted from source) is put back before cancelling.
      if (transfer.status === StockTransferStatus.IN_TRANSIT) {
        for (const item of transfer.items) {
          await this.stockService.receiveStock(tx, organizationId, item.itemId, transfer.fromStoreId, item.quantity)
          await this.stockService.recordLedger(tx, organizationId, item.itemId, transfer.fromStoreId, 'TRANSFER', item.quantity, userId, {
            referenceType: 'InventoryStockTransfer',
            referenceId: transfer.id,
          })
        }
      }
      await tx.inventoryStockTransfer.update({
        where: { id },
        data: { status: StockTransferStatus.CANCELLED, cancelReason: reason },
      })
    })
    this.emitStatusChanged(organizationId, id, userId, transfer.status, StockTransferStatus.CANCELLED, reason)
    const cancelled = await this.requireTransfer(organizationId, id)
    return cancelled as unknown as InventoryStockTransfer
  }

  private emitStatusChanged(
    organizationId: string,
    transferId: string,
    userId: string,
    fromStatus: StockTransferStatus,
    toStatus: StockTransferStatus,
    reason?: string,
  ) {
    this.eventEmitter.emit('inventory_stock_transfer.status_changed', {
      organizationId,
      userId,
      transferId,
      fromStatus,
      toStatus,
      reason,
    })
  }

  private async requireTransfer(organizationId: string, id: string) {
    const transfer = await this.prisma.inventoryStockTransfer.findFirst({
      where: { id, organizationId },
      include: TRANSFER_INCLUDE,
    })
    if (!transfer) throw new NotFoundException('Stock transfer not found')
    return transfer
  }
}
