import {
  CreateStoreRequisitionDto,
  IssueStoreRequisitionDto,
  ReceiveStoreRequisitionDto,
  RejectStoreRequisitionDto,
  StoreRequisition,
  StoreRequisitionQuery,
} from '@medicore/types'
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Prisma, RequisitionStatus } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { generateInventoryNumber, yearStart } from './inventory-numbering'
import { StockService } from './stock.service'
import { StoresService } from './stores.service'

const REQ_INCLUDE = {
  fromStore: { select: { id: true, name: true, code: true } },
  toStore: { select: { id: true, name: true, code: true } },
  items: { include: { item: { select: { id: true, name: true, code: true } } } },
} satisfies Prisma.StoreRequisitionInclude

type ReqWithIncludes = Prisma.StoreRequisitionGetPayload<{ include: typeof REQ_INCLUDE }>

@Injectable()
export class RequisitionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
    private readonly storesService: StoresService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(organizationId: string, query: StoreRequisitionQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20
    const where: Prisma.StoreRequisitionWhereInput = { organizationId }
    if (query.fromStoreId) where.fromStoreId = query.fromStoreId
    if (query.toStoreId) where.toStoreId = query.toStoreId
    if (query.status) where.status = query.status

    const [data, total] = await Promise.all([
      this.prisma.storeRequisition.findMany({
        where,
        include: REQ_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.storeRequisition.count({ where }),
    ])
    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrev: page > 1 },
    }
  }

  async getById(organizationId: string, id: string): Promise<StoreRequisition> {
    const req = await this.requireReq(organizationId, id)
    return req as unknown as StoreRequisition
  }

  async create(organizationId: string, userId: string, dto: CreateStoreRequisitionDto): Promise<StoreRequisition> {
    if (dto.fromStoreId === dto.toStoreId) throw new BadRequestException('Requesting and fulfilling stores must differ')
    await this.storesService.requireStore(organizationId, dto.fromStoreId)
    await this.storesService.requireStore(organizationId, dto.toStoreId)

    const created = await this.prisma.$transaction(async (tx) => {
      const requisitionNumber = await generateInventoryNumber(tx, organizationId, 'store_requisition', 'REQ', () =>
        tx.storeRequisition.count({ where: { organizationId, createdAt: { gte: yearStart() } } }),
      )
      return tx.storeRequisition.create({
        data: {
          organizationId,
          requisitionNumber,
          fromStoreId: dto.fromStoreId,
          toStoreId: dto.toStoreId,
          requestedByUserId: userId,
          priority: dto.priority,
          notes: dto.notes,
          items: {
            create: dto.items.map((item) => ({ itemId: item.itemId, quantityRequested: item.quantityRequested })),
          },
        },
        include: REQ_INCLUDE,
      })
    })
    this.eventEmitter.emit('store_requisition.created', { organizationId, userId, storeRequisitionId: created.id })
    return created as unknown as StoreRequisition
  }

  async approve(organizationId: string, userId: string, id: string): Promise<StoreRequisition> {
    const req = await this.requireReq(organizationId, id)
    this.assertStatus(req, [RequisitionStatus.REQUESTED])
    await this.prisma.storeRequisition.update({
      where: { id },
      data: { status: RequisitionStatus.APPROVED, approvedByUserId: userId, approvedAt: new Date() },
    })
    this.emitStatusChanged(organizationId, id, userId, req.status, RequisitionStatus.APPROVED)
    const updated = await this.requireReq(organizationId, id)
    return updated as unknown as StoreRequisition
  }

  async reject(organizationId: string, userId: string, id: string, dto: RejectStoreRequisitionDto): Promise<StoreRequisition> {
    const req = await this.requireReq(organizationId, id)
    this.assertStatus(req, [RequisitionStatus.REQUESTED])
    await this.prisma.storeRequisition.update({
      where: { id },
      data: {
        status: RequisitionStatus.REJECTED,
        approvedByUserId: userId,
        approvedAt: new Date(),
        rejectionReason: dto.reason,
      },
    })
    this.emitStatusChanged(organizationId, id, userId, req.status, RequisitionStatus.REJECTED, dto.reason)
    const updated = await this.requireReq(organizationId, id)
    return updated as unknown as StoreRequisition
  }

  /** Deducts stock from the fulfilling store (`fromStoreId`) for each issued item. */
  async issue(organizationId: string, userId: string, id: string, dto: IssueStoreRequisitionDto): Promise<StoreRequisition> {
    const req = await this.requireReq(organizationId, id)
    this.assertStatus(req, [RequisitionStatus.APPROVED, RequisitionStatus.PARTIALLY_ISSUED])
    const itemById = new Map(req.items.map((item) => [item.id, item]))

    await this.prisma.$transaction(async (tx) => {
      for (const line of dto.items) {
        const reqItem = itemById.get(line.storeRequisitionItemId)
        if (!reqItem) throw new BadRequestException('One or more items do not belong to this requisition')
        const remaining = reqItem.quantityRequested - reqItem.quantityIssued
        if (line.quantityIssued > remaining) {
          throw new BadRequestException(`Cannot issue ${line.quantityIssued} - only ${remaining} remain requested`)
        }
        await this.stockService.issueStock(tx, organizationId, reqItem.itemId, req.fromStoreId, line.quantityIssued, line.batchId)
        await this.stockService.recordLedger(tx, organizationId, reqItem.itemId, req.fromStoreId, 'ISSUE', -line.quantityIssued, userId, {
          referenceType: 'StoreRequisition',
          referenceId: req.id,
        })
        await tx.storeRequisitionItem.update({
          where: { id: line.storeRequisitionItemId },
          data: { quantityIssued: { increment: line.quantityIssued }, batchId: line.batchId },
        })
      }

      const updatedItems = await tx.storeRequisitionItem.findMany({ where: { storeRequisitionId: id } })
      const fullyIssued = updatedItems.every((item) => item.quantityIssued >= item.quantityRequested)
      await tx.storeRequisition.update({
        where: { id },
        data: {
          status: fullyIssued ? RequisitionStatus.ISSUED : RequisitionStatus.PARTIALLY_ISSUED,
          issuedByUserId: userId,
          issuedAt: new Date(),
        },
      })
    })
    const updated = await this.requireReq(organizationId, id)
    this.emitStatusChanged(organizationId, id, userId, req.status, updated.status)
    return updated as unknown as StoreRequisition
  }

  /** Adds stock at the requesting store (`toStoreId`) once it physically arrives. */
  async receive(organizationId: string, userId: string, id: string, dto: ReceiveStoreRequisitionDto): Promise<StoreRequisition> {
    const req = await this.requireReq(organizationId, id)
    this.assertStatus(req, [RequisitionStatus.ISSUED, RequisitionStatus.PARTIALLY_ISSUED])
    const itemById = new Map(req.items.map((item) => [item.id, item]))

    await this.prisma.$transaction(async (tx) => {
      for (const line of dto.items) {
        const reqItem = itemById.get(line.storeRequisitionItemId)
        if (!reqItem) throw new BadRequestException('One or more items do not belong to this requisition')
        const remaining = reqItem.quantityIssued - reqItem.quantityReceived
        if (line.quantityReceived > remaining) {
          throw new BadRequestException(`Cannot receive ${line.quantityReceived} - only ${remaining} unit(s) are in transit`)
        }
        await this.stockService.receiveStock(tx, organizationId, reqItem.itemId, req.toStoreId, line.quantityReceived)
        await this.stockService.recordLedger(tx, organizationId, reqItem.itemId, req.toStoreId, 'TRANSFER', line.quantityReceived, userId, {
          referenceType: 'StoreRequisition',
          referenceId: req.id,
        })
        await tx.storeRequisitionItem.update({
          where: { id: line.storeRequisitionItemId },
          data: { quantityReceived: { increment: line.quantityReceived } },
        })
      }

      const updatedItems = await tx.storeRequisitionItem.findMany({ where: { storeRequisitionId: id } })
      const fullyReceived = updatedItems.every((item) => item.quantityReceived >= item.quantityIssued && item.quantityIssued > 0)
      if (fullyReceived) {
        await tx.storeRequisition.update({
          where: { id },
          data: { status: RequisitionStatus.RECEIVED, receivedByUserId: userId, receivedAt: new Date() },
        })
      }
    })
    const updated = await this.requireReq(organizationId, id)
    this.emitStatusChanged(organizationId, id, userId, req.status, updated.status)
    return updated as unknown as StoreRequisition
  }

  async cancel(organizationId: string, userId: string, id: string): Promise<StoreRequisition> {
    const req = await this.requireReq(organizationId, id)
    this.assertStatus(req, [RequisitionStatus.REQUESTED, RequisitionStatus.APPROVED])
    await this.prisma.storeRequisition.update({ where: { id }, data: { status: RequisitionStatus.CANCELLED } })
    this.emitStatusChanged(organizationId, id, userId, req.status, RequisitionStatus.CANCELLED)
    const cancelled = await this.requireReq(organizationId, id)
    return cancelled as unknown as StoreRequisition
  }

  private emitStatusChanged(
    organizationId: string,
    storeRequisitionId: string,
    userId: string,
    fromStatus: RequisitionStatus,
    toStatus: RequisitionStatus,
    reason?: string,
  ) {
    this.eventEmitter.emit('store_requisition.status_changed', {
      organizationId,
      userId,
      storeRequisitionId,
      fromStatus,
      toStatus,
      reason,
    })
  }

  private assertStatus(req: ReqWithIncludes, allowed: RequisitionStatus[]) {
    if (!allowed.includes(req.status)) {
      throw new ConflictException(`Requisition is ${req.status}; expected one of ${allowed.join(', ')}`)
    }
  }

  private async requireReq(organizationId: string, id: string): Promise<ReqWithIncludes> {
    const req = await this.prisma.storeRequisition.findFirst({ where: { id, organizationId }, include: REQ_INCLUDE })
    if (!req) throw new NotFoundException('Store requisition not found')
    return req
  }
}
