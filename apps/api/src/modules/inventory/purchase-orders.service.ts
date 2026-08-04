import {
  CancelPurchaseOrderDto,
  CreatePurchaseOrderDto,
  PurchaseOrder,
  PurchaseOrderQuery,
  PurchaseRequestStatus as SharedPurchaseRequestStatus,
} from '@medicore/types'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Prisma, PurchaseOrderStatus } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { generateInventoryNumber, yearStart } from './inventory-numbering'
import { PurchaseRequestsService } from './purchase-requests.service'
import { StoresService } from './stores.service'
import { VendorsService } from './vendors.service'

const PO_INCLUDE = {
  vendor: { select: { id: true, name: true, code: true } },
  store: { select: { id: true, name: true, code: true } },
  items: { include: { item: { select: { id: true, name: true, code: true } } } },
} satisfies Prisma.PurchaseOrderInclude

type PoWithIncludes = Prisma.PurchaseOrderGetPayload<{ include: typeof PO_INCLUDE }>

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vendorsService: VendorsService,
    private readonly storesService: StoresService,
    private readonly purchaseRequestsService: PurchaseRequestsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(organizationId: string, query: PurchaseOrderQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20
    const where: Prisma.PurchaseOrderWhereInput = { organizationId }
    if (query.vendorId) where.vendorId = query.vendorId
    if (query.storeId) where.storeId = query.storeId
    if (query.status) where.status = query.status

    const [data, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        include: PO_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.purchaseOrder.count({ where }),
    ])
    return {
      data: data.map((po) => this.toResponse(po)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrev: page > 1 },
    }
  }

  async getById(organizationId: string, id: string): Promise<PurchaseOrder> {
    return this.toResponse(await this.requirePo(organizationId, id))
  }

  async create(organizationId: string, userId: string, dto: CreatePurchaseOrderDto): Promise<PurchaseOrder> {
    await this.vendorsService.requireVendor(organizationId, dto.vendorId)
    await this.storesService.requireStore(organizationId, dto.storeId)
    if (dto.purchaseRequestId) {
      const pr = await this.purchaseRequestsService.getById(organizationId, dto.purchaseRequestId)
      if (pr.status !== SharedPurchaseRequestStatus.APPROVED) {
        throw new ConflictException('The linked purchase request must be Approved before converting it to a PO')
      }
    }

    const po = await this.prisma.$transaction(async (tx) => {
      const poNumber = await generateInventoryNumber(tx, organizationId, 'purchase_order', 'PO', () =>
        tx.purchaseOrder.count({ where: { organizationId, createdAt: { gte: yearStart() } } }),
      )
      return tx.purchaseOrder.create({
        data: {
          organizationId,
          poNumber,
          vendorId: dto.vendorId,
          storeId: dto.storeId,
          purchaseRequestId: dto.purchaseRequestId,
          expectedDeliveryDate: dto.expectedDeliveryDate,
          notes: dto.notes,
          items: { create: dto.items },
        },
        include: PO_INCLUDE,
      })
    })

    if (dto.purchaseRequestId) {
      await this.purchaseRequestsService.markConverted(organizationId, dto.purchaseRequestId)
    }
    this.eventEmitter.emit('purchase_order.created', { organizationId, userId, purchaseOrderId: po.id })
    return this.toResponse(po)
  }

  async submit(organizationId: string, userId: string, id: string): Promise<PurchaseOrder> {
    const po = await this.requirePo(organizationId, id)
    this.assertStatus(po, [PurchaseOrderStatus.DRAFT])
    await this.prisma.purchaseOrder.update({ where: { id }, data: { status: PurchaseOrderStatus.SUBMITTED } })
    this.emitStatusChanged(organizationId, id, userId, po.status, PurchaseOrderStatus.SUBMITTED)
    return this.getById(organizationId, id)
  }

  async approve(organizationId: string, userId: string, id: string): Promise<PurchaseOrder> {
    const po = await this.requirePo(organizationId, id)
    this.assertStatus(po, [PurchaseOrderStatus.SUBMITTED])
    await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.APPROVED, approvedByUserId: userId, approvedAt: new Date() },
    })
    this.emitStatusChanged(organizationId, id, userId, po.status, PurchaseOrderStatus.APPROVED)
    return this.getById(organizationId, id)
  }

  async send(organizationId: string, userId: string, id: string): Promise<PurchaseOrder> {
    const po = await this.requirePo(organizationId, id)
    this.assertStatus(po, [PurchaseOrderStatus.APPROVED])
    await this.prisma.purchaseOrder.update({ where: { id }, data: { status: PurchaseOrderStatus.SENT } })
    this.emitStatusChanged(organizationId, id, userId, po.status, PurchaseOrderStatus.SENT)
    return this.getById(organizationId, id)
  }

  async cancel(organizationId: string, userId: string, id: string, dto: CancelPurchaseOrderDto): Promise<PurchaseOrder> {
    const po = await this.requirePo(organizationId, id)
    this.assertStatus(po, [
      PurchaseOrderStatus.DRAFT,
      PurchaseOrderStatus.SUBMITTED,
      PurchaseOrderStatus.APPROVED,
      PurchaseOrderStatus.SENT,
    ])
    await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.CANCELLED, cancelReason: dto.reason },
    })
    this.emitStatusChanged(organizationId, id, userId, po.status, PurchaseOrderStatus.CANCELLED, dto.reason)
    return this.getById(organizationId, id)
  }

  private emitStatusChanged(
    organizationId: string,
    purchaseOrderId: string,
    userId: string,
    fromStatus: PurchaseOrderStatus,
    toStatus: PurchaseOrderStatus,
    reason?: string,
  ) {
    this.eventEmitter.emit('purchase_order.status_changed', {
      organizationId,
      userId,
      purchaseOrderId,
      fromStatus,
      toStatus,
      reason,
    })
  }

  /** Used by `GoodsReceiptService` to validate/update the PO once a GRN is completed. */
  async requirePoForReceipt(organizationId: string, id: string): Promise<PoWithIncludes> {
    const po = await this.requirePo(organizationId, id)
    if (po.status !== PurchaseOrderStatus.SENT && po.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED) {
      throw new ConflictException(`Purchase order is ${po.status}; it must be Sent or Partially received to record a GRN`)
    }
    return po
  }

  async recomputeReceiptStatus(organizationId: string, id: string): Promise<void> {
    const po = await this.requirePo(organizationId, id)
    const fullyReceived = po.items.every((item) => item.quantityReceived >= item.quantityOrdered)
    const anyReceived = po.items.some((item) => item.quantityReceived > 0)
    await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: fullyReceived ? PurchaseOrderStatus.RECEIVED : anyReceived ? PurchaseOrderStatus.PARTIALLY_RECEIVED : po.status },
    })
  }

  private assertStatus(po: PoWithIncludes, allowed: PurchaseOrderStatus[]) {
    if (!allowed.includes(po.status)) {
      throw new ConflictException(`Purchase order is ${po.status}; expected one of ${allowed.join(', ')}`)
    }
  }

  private async requirePo(organizationId: string, id: string): Promise<PoWithIncludes> {
    const po = await this.prisma.purchaseOrder.findFirst({ where: { id, organizationId }, include: PO_INCLUDE })
    if (!po) throw new NotFoundException('Purchase order not found')
    return po
  }

  private toResponse(po: PoWithIncludes): PurchaseOrder {
    const totalAmount = po.items.reduce(
      (sum, item) => sum + item.quantityOrdered * Number(item.unitPrice) * (1 + Number(item.taxPercent) / 100),
      0,
    )
    return {
      id: po.id,
      organizationId: po.organizationId,
      poNumber: po.poNumber,
      vendorId: po.vendorId,
      storeId: po.storeId,
      purchaseRequestId: po.purchaseRequestId,
      status: po.status as unknown as PurchaseOrder['status'],
      expectedDeliveryDate: po.expectedDeliveryDate,
      approvedByUserId: po.approvedByUserId,
      approvedAt: po.approvedAt,
      cancelReason: po.cancelReason,
      notes: po.notes,
      createdAt: po.createdAt,
      updatedAt: po.updatedAt,
      vendor: po.vendor,
      store: po.store,
      items: po.items.map((item) => ({
        id: item.id,
        purchaseOrderId: item.purchaseOrderId,
        itemId: item.itemId,
        quantityOrdered: item.quantityOrdered,
        quantityReceived: item.quantityReceived,
        unitPrice: item.unitPrice.toString(),
        taxPercent: item.taxPercent.toString(),
        item: item.item,
      })),
      totalAmount: totalAmount.toFixed(2),
    }
  }
}
