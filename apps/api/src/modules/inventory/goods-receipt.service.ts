import { CreateGoodsReceiptNoteDto, CreateVendorReturnDto, GoodsReceiptNote, GoodsReceiptQuery, VendorReturn } from '@medicore/types'
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { GrnStatus, Prisma, VendorReturnStatus } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { generateInventoryNumber, yearStart } from './inventory-numbering'
import { PurchaseOrdersService } from './purchase-orders.service'
import { StockService } from './stock.service'
import { StoresService } from './stores.service'
import { VendorsService } from './vendors.service'

const GRN_INCLUDE = {
  purchaseOrder: { select: { id: true, poNumber: true } },
  store: { select: { id: true, name: true, code: true } },
  items: { include: { item: { select: { id: true, name: true, code: true } } } },
} satisfies Prisma.GoodsReceiptNoteInclude

const RETURN_INCLUDE = {
  vendor: { select: { id: true, name: true, code: true } },
  items: { include: { item: { select: { id: true, name: true, code: true } } } },
} satisfies Prisma.VendorReturnInclude

@Injectable()
export class GoodsReceiptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
    private readonly purchaseOrdersService: PurchaseOrdersService,
    private readonly vendorsService: VendorsService,
    private readonly storesService: StoresService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Goods Receipt Notes ────────────────────────────────────────────────

  async list(organizationId: string, query: GoodsReceiptQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20
    const where: Prisma.GoodsReceiptNoteWhereInput = { organizationId }
    if (query.storeId) where.storeId = query.storeId
    if (query.purchaseOrderId) where.purchaseOrderId = query.purchaseOrderId
    if (query.status) where.status = query.status

    const [data, total] = await Promise.all([
      this.prisma.goodsReceiptNote.findMany({
        where,
        include: GRN_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.goodsReceiptNote.count({ where }),
    ])
    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrev: page > 1 },
    }
  }

  async getById(organizationId: string, id: string): Promise<GoodsReceiptNote> {
    const grn = await this.requireGrn(organizationId, id)
    return grn as unknown as GoodsReceiptNote
  }

  async create(organizationId: string, userId: string, dto: CreateGoodsReceiptNoteDto): Promise<GoodsReceiptNote> {
    const po = await this.purchaseOrdersService.requirePoForReceipt(organizationId, dto.purchaseOrderId)
    const poItemById = new Map(po.items.map((item) => [item.id, item]))

    for (const item of dto.items) {
      const poItem = poItemById.get(item.purchaseOrderItemId)
      if (!poItem) throw new BadRequestException('One or more items do not belong to this purchase order')
      const remaining = poItem.quantityOrdered - poItem.quantityReceived
      if (item.quantityReceived > remaining) {
        throw new BadRequestException(`Cannot receive ${item.quantityReceived} of "${poItem.itemId}" — only ${remaining} remain on the PO`)
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const grnNumber = await generateInventoryNumber(tx, organizationId, 'grn', 'GRN', () =>
        tx.goodsReceiptNote.count({ where: { organizationId, createdAt: { gte: yearStart() } } }),
      )
      const itemsWithIds = dto.items.map((item) => ({
        ...item,
        itemId: poItemById.get(item.purchaseOrderItemId)!.itemId,
      }))
      return tx.goodsReceiptNote.create({
        data: {
          organizationId,
          grnNumber,
          purchaseOrderId: dto.purchaseOrderId,
          storeId: po.storeId,
          receivedByUserId: userId,
          notes: dto.notes,
          items: { create: itemsWithIds },
        },
        include: GRN_INCLUDE,
      })
    })
    this.eventEmitter.emit('goods_receipt_note.created', { organizationId, userId, goodsReceiptNoteId: created.id })
    return created as unknown as GoodsReceiptNote
  }

  /** Applies the physical stock receipt and updates the source PO's fulfillment state. */
  async complete(organizationId: string, id: string): Promise<GoodsReceiptNote> {
    const grn = await this.requireGrn(organizationId, id)
    if (grn.status !== GrnStatus.DRAFT) throw new ConflictException(`GRN is ${grn.status}; expected Draft`)

    await this.prisma.$transaction(async (tx) => {
      for (const item of grn.items) {
        await this.stockService.receiveStock(tx, organizationId, item.itemId, grn.storeId, item.quantityReceived, {
          batchNumber: item.batchNumber ?? undefined,
          serialNumber: item.serialNumber ?? undefined,
          manufactureDate: item.manufactureDate ?? undefined,
          expiryDate: item.expiryDate ?? undefined,
        })
        await this.stockService.recordLedger(tx, organizationId, item.itemId, grn.storeId, 'RECEIPT', item.quantityReceived, grn.receivedByUserId, {
          referenceType: 'GoodsReceiptNote',
          referenceId: grn.id,
        })
        await tx.purchaseOrderItem.update({
          where: { id: item.purchaseOrderItemId },
          data: { quantityReceived: { increment: item.quantityReceived } },
        })
      }
      await tx.goodsReceiptNote.update({ where: { id }, data: { status: GrnStatus.COMPLETED } })
    })

    await this.purchaseOrdersService.recomputeReceiptStatus(organizationId, grn.purchaseOrderId)
    this.eventEmitter.emit('goods_receipt_note.completed', { organizationId, userId: grn.receivedByUserId, goodsReceiptNoteId: id })
    const completed = await this.requireGrn(organizationId, id)
    return completed as unknown as GoodsReceiptNote
  }

  async cancel(organizationId: string, userId: string, id: string): Promise<GoodsReceiptNote> {
    const grn = await this.requireGrn(organizationId, id)
    if (grn.status !== GrnStatus.DRAFT) throw new ConflictException(`GRN is ${grn.status}; only a Draft GRN can be cancelled`)
    await this.prisma.goodsReceiptNote.update({ where: { id }, data: { status: GrnStatus.CANCELLED } })
    this.eventEmitter.emit('goods_receipt_note.cancelled', { organizationId, userId, goodsReceiptNoteId: id })
    const cancelled = await this.requireGrn(organizationId, id)
    return cancelled as unknown as GoodsReceiptNote
  }

  private async requireGrn(organizationId: string, id: string) {
    const grn = await this.prisma.goodsReceiptNote.findFirst({ where: { id, organizationId }, include: GRN_INCLUDE })
    if (!grn) throw new NotFoundException('Goods receipt note not found')
    return grn
  }

  // ── Vendor Returns ─────────────────────────────────────────────────────

  async listReturns(organizationId: string) {
    return this.prisma.vendorReturn.findMany({ where: { organizationId }, include: RETURN_INCLUDE, orderBy: { createdAt: 'desc' } })
  }

  async getReturnById(organizationId: string, id: string): Promise<VendorReturn> {
    const vendorReturn = await this.requireReturn(organizationId, id)
    return vendorReturn as unknown as VendorReturn
  }

  /** Goods physically leave the store back to the vendor as soon as the return is recorded. */
  async createReturn(organizationId: string, userId: string, dto: CreateVendorReturnDto): Promise<VendorReturn> {
    await this.vendorsService.requireVendor(organizationId, dto.vendorId)
    await this.storesService.requireStore(organizationId, dto.storeId)

    const vendorReturn = await this.prisma.$transaction(async (tx) => {
      const returnNumber = await generateInventoryNumber(tx, organizationId, 'vendor_return', 'VRTN', () =>
        tx.vendorReturn.count({ where: { organizationId, createdAt: { gte: yearStart() } } }),
      )
      for (const item of dto.items) {
        await this.stockService.issueStock(tx, organizationId, item.itemId, dto.storeId, item.quantity, item.batchId)
        await this.stockService.recordLedger(tx, organizationId, item.itemId, dto.storeId, 'ISSUE', -item.quantity, userId)
      }
      return tx.vendorReturn.create({
        data: {
          organizationId,
          returnNumber,
          vendorId: dto.vendorId,
          goodsReceiptNoteId: dto.goodsReceiptNoteId,
          storeId: dto.storeId,
          reason: dto.reason,
          returnedByUserId: userId,
          status: VendorReturnStatus.SENT,
          items: { create: dto.items },
        },
        include: RETURN_INCLUDE,
      })
    })
    this.eventEmitter.emit('vendor_return.created', { organizationId, userId, vendorReturnId: vendorReturn.id })
    return vendorReturn as unknown as VendorReturn
  }

  async acknowledgeReturn(organizationId: string, userId: string, id: string): Promise<VendorReturn> {
    const vendorReturn = await this.requireReturn(organizationId, id)
    if (vendorReturn.status !== VendorReturnStatus.SENT) throw new ConflictException(`Return is ${vendorReturn.status}; expected Sent`)
    await this.prisma.vendorReturn.update({ where: { id }, data: { status: VendorReturnStatus.ACKNOWLEDGED } })
    this.eventEmitter.emit('vendor_return.acknowledged', { organizationId, userId, vendorReturnId: id })
    const acknowledged = await this.requireReturn(organizationId, id)
    return acknowledged as unknown as VendorReturn
  }

  private async requireReturn(organizationId: string, id: string) {
    const vendorReturn = await this.prisma.vendorReturn.findFirst({ where: { id, organizationId }, include: RETURN_INCLUDE })
    if (!vendorReturn) throw new NotFoundException('Vendor return not found')
    return vendorReturn
  }
}
