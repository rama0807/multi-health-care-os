import { CreateStockAuditDto, RecordAuditCountDto, StockAudit, StockAuditQuery } from '@medicore/types'
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Prisma, StockAuditStatus } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { generateInventoryNumber, yearStart } from './inventory-numbering'
import { StoresService } from './stores.service'

const AUDIT_INCLUDE = {
  store: { select: { id: true, name: true, code: true } },
  items: { include: { item: { select: { id: true, name: true, code: true } } } },
} satisfies Prisma.StockAuditInclude

type AuditWithIncludes = Prisma.StockAuditGetPayload<{ include: typeof AUDIT_INCLUDE }>

@Injectable()
export class StockAuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storesService: StoresService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(organizationId: string, query: StockAuditQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20
    const where: Prisma.StockAuditWhereInput = { organizationId }
    if (query.storeId) where.storeId = query.storeId
    if (query.status) where.status = query.status

    const [data, total] = await Promise.all([
      this.prisma.stockAudit.findMany({
        where,
        include: AUDIT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockAudit.count({ where }),
    ])
    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrev: page > 1 },
    }
  }

  async getById(organizationId: string, id: string): Promise<StockAudit> {
    const audit = await this.requireAudit(organizationId, id)
    return audit as unknown as StockAudit
  }

  /** Snapshots the store's current system stock (cycle count / physical verification). */
  async create(organizationId: string, userId: string, dto: CreateStockAuditDto): Promise<StockAudit> {
    await this.storesService.requireStore(organizationId, dto.storeId)

    const stocks = await this.prisma.inventoryStock.findMany({
      where: { organizationId, storeId: dto.storeId, ...(dto.itemIds ? { itemId: { in: dto.itemIds } } : {}) },
    })
    if (stocks.length === 0) throw new BadRequestException('No stock records found for this store to audit')

    const created = await this.prisma.$transaction(async (tx) => {
      const auditNumber = await generateInventoryNumber(tx, organizationId, 'stock_audit', 'AUD', () =>
        tx.stockAudit.count({ where: { organizationId, createdAt: { gte: yearStart() } } }),
      )
      return tx.stockAudit.create({
        data: {
          organizationId,
          auditNumber,
          storeId: dto.storeId,
          scheduledDate: dto.scheduledDate,
          conductedByUserId: userId,
          notes: dto.notes,
          items: { create: stocks.map((s) => ({ itemId: s.itemId, systemQuantity: s.currentStock })) },
        },
        include: AUDIT_INCLUDE,
      })
    })
    this.eventEmitter.emit('stock_audit.created', { organizationId, userId, stockAuditId: created.id })
    return created as unknown as StockAudit
  }

  async start(organizationId: string, userId: string, id: string): Promise<StockAudit> {
    const audit = await this.requireAudit(organizationId, id)
    this.assertStatus(audit, [StockAuditStatus.DRAFT])
    await this.prisma.stockAudit.update({ where: { id }, data: { status: StockAuditStatus.IN_PROGRESS, startedAt: new Date() } })
    this.eventEmitter.emit('stock_audit.status_changed', {
      organizationId,
      userId,
      stockAuditId: id,
      fromStatus: audit.status,
      toStatus: StockAuditStatus.IN_PROGRESS,
    })
    const updated = await this.requireAudit(organizationId, id)
    return updated as unknown as StockAudit
  }

  async recordCounts(organizationId: string, id: string, dto: RecordAuditCountDto): Promise<StockAudit> {
    const audit = await this.requireAudit(organizationId, id)
    this.assertStatus(audit, [StockAuditStatus.IN_PROGRESS])
    const itemById = new Map(audit.items.map((item) => [item.id, item]))

    await this.prisma.$transaction(async (tx) => {
      for (const line of dto.items) {
        const auditItem = itemById.get(line.stockAuditItemId)
        if (!auditItem) throw new BadRequestException('One or more items do not belong to this audit')
        await tx.stockAuditItem.update({
          where: { id: line.stockAuditItemId },
          data: {
            countedQuantity: line.countedQuantity,
            varianceQuantity: line.countedQuantity - auditItem.systemQuantity,
            remarks: line.remarks,
          },
        })
      }
    })
    const updated = await this.requireAudit(organizationId, id)
    return updated as unknown as StockAudit
  }

  /** Applies each item's variance as a `CORRECTION` adjustment, bringing system stock to match the physical count. */
  async complete(organizationId: string, userId: string, id: string): Promise<StockAudit> {
    const audit = await this.requireAudit(organizationId, id)
    this.assertStatus(audit, [StockAuditStatus.IN_PROGRESS])
    if (audit.items.some((item) => item.countedQuantity === null)) {
      throw new BadRequestException('Every item must have a counted quantity before completing the audit')
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of audit.items) {
        if (!item.varianceQuantity) continue
        await tx.inventoryStock.updateMany({
          where: { organizationId, itemId: item.itemId, storeId: audit.storeId },
          data: { currentStock: { increment: item.varianceQuantity } },
        })
        await tx.inventoryStockAdjustment.create({
          data: {
            organizationId,
            itemId: item.itemId,
            storeId: audit.storeId,
            type: 'AUDIT',
            quantityDelta: item.varianceQuantity,
            reason: `Stock audit ${audit.auditNumber} variance`,
            referenceType: 'StockAudit',
            referenceId: audit.id,
            adjustedByUserId: audit.conductedByUserId,
          },
        })
      }
      await tx.stockAudit.update({ where: { id }, data: { status: StockAuditStatus.COMPLETED, completedAt: new Date() } })
    })
    this.eventEmitter.emit('stock_audit.status_changed', {
      organizationId,
      userId,
      stockAuditId: id,
      fromStatus: audit.status,
      toStatus: StockAuditStatus.COMPLETED,
    })
    const completed = await this.requireAudit(organizationId, id)
    return completed as unknown as StockAudit
  }

  async cancel(organizationId: string, userId: string, id: string): Promise<StockAudit> {
    const audit = await this.requireAudit(organizationId, id)
    this.assertStatus(audit, [StockAuditStatus.DRAFT, StockAuditStatus.IN_PROGRESS])
    await this.prisma.stockAudit.update({ where: { id }, data: { status: StockAuditStatus.CANCELLED } })
    this.eventEmitter.emit('stock_audit.status_changed', {
      organizationId,
      userId,
      stockAuditId: id,
      fromStatus: audit.status,
      toStatus: StockAuditStatus.CANCELLED,
    })
    const cancelled = await this.requireAudit(organizationId, id)
    return cancelled as unknown as StockAudit
  }

  private assertStatus(audit: AuditWithIncludes, allowed: StockAuditStatus[]) {
    if (!allowed.includes(audit.status)) {
      throw new ConflictException(`Stock audit is ${audit.status}; expected one of ${allowed.join(', ')}`)
    }
  }

  private async requireAudit(organizationId: string, id: string): Promise<AuditWithIncludes> {
    const audit = await this.prisma.stockAudit.findFirst({ where: { id, organizationId }, include: AUDIT_INCLUDE })
    if (!audit) throw new NotFoundException('Stock audit not found')
    return audit
  }
}
