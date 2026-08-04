import { CreatePurchaseRequestDto, PurchaseRequest, PurchaseRequestQuery, RejectPurchaseRequestDto } from '@medicore/types'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Prisma, PurchaseRequestStatus } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { generateInventoryNumber, yearStart } from './inventory-numbering'
import { StoresService } from './stores.service'

const PR_INCLUDE = {
  store: { select: { id: true, name: true, code: true } },
  items: { include: { item: { select: { id: true, name: true, code: true } } } },
} satisfies Prisma.PurchaseRequestInclude

@Injectable()
export class PurchaseRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storesService: StoresService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(organizationId: string, query: PurchaseRequestQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20
    const where: Prisma.PurchaseRequestWhereInput = { organizationId }
    if (query.storeId) where.storeId = query.storeId
    if (query.status) where.status = query.status

    const [data, total] = await Promise.all([
      this.prisma.purchaseRequest.findMany({
        where,
        include: PR_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.purchaseRequest.count({ where }),
    ])
    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrev: page > 1 },
    }
  }

  async getById(organizationId: string, id: string): Promise<PurchaseRequest> {
    const pr = await this.requirePr(organizationId, id)
    return pr as unknown as PurchaseRequest
  }

  async create(organizationId: string, userId: string, dto: CreatePurchaseRequestDto): Promise<PurchaseRequest> {
    await this.storesService.requireStore(organizationId, dto.storeId)
    const created = await this.prisma.$transaction(async (tx) => {
      const requestNumber = await generateInventoryNumber(tx, organizationId, 'purchase_request', 'PR', () =>
        tx.purchaseRequest.count({ where: { organizationId, createdAt: { gte: yearStart() } } }),
      )
      return tx.purchaseRequest.create({
        data: {
          organizationId,
          requestNumber,
          storeId: dto.storeId,
          requestedByUserId: userId,
          notes: dto.notes,
          items: { create: dto.items },
        },
        include: PR_INCLUDE,
      })
    })
    this.eventEmitter.emit('purchase_request.created', {
      organizationId,
      userId,
      purchaseRequestId: created.id,
    })
    return created as unknown as PurchaseRequest
  }

  async submit(organizationId: string, id: string): Promise<PurchaseRequest> {
    const pr = await this.requirePr(organizationId, id)
    this.assertStatus(pr, [PurchaseRequestStatus.DRAFT])
    await this.prisma.purchaseRequest.update({ where: { id }, data: { status: PurchaseRequestStatus.SUBMITTED } })
    this.emitStatusChanged(organizationId, id, pr.requestedByUserId, pr.status, PurchaseRequestStatus.SUBMITTED)
    const updated = await this.requirePr(organizationId, id)
    return updated as unknown as PurchaseRequest
  }

  async approve(organizationId: string, userId: string, id: string): Promise<PurchaseRequest> {
    const pr = await this.requirePr(organizationId, id)
    this.assertStatus(pr, [PurchaseRequestStatus.SUBMITTED])
    await this.prisma.purchaseRequest.update({
      where: { id },
      data: { status: PurchaseRequestStatus.APPROVED, approvedByUserId: userId, approvedAt: new Date() },
    })
    this.emitStatusChanged(organizationId, id, userId, pr.status, PurchaseRequestStatus.APPROVED)
    const updated = await this.requirePr(organizationId, id)
    return updated as unknown as PurchaseRequest
  }

  async reject(organizationId: string, userId: string, id: string, dto: RejectPurchaseRequestDto): Promise<PurchaseRequest> {
    const pr = await this.requirePr(organizationId, id)
    this.assertStatus(pr, [PurchaseRequestStatus.SUBMITTED])
    await this.prisma.purchaseRequest.update({
      where: { id },
      data: {
        status: PurchaseRequestStatus.REJECTED,
        approvedByUserId: userId,
        approvedAt: new Date(),
        rejectionReason: dto.reason,
      },
    })
    this.emitStatusChanged(organizationId, id, userId, pr.status, PurchaseRequestStatus.REJECTED, dto.reason)
    const updated = await this.requirePr(organizationId, id)
    return updated as unknown as PurchaseRequest
  }

  async cancel(organizationId: string, id: string): Promise<PurchaseRequest> {
    const pr = await this.requirePr(organizationId, id)
    this.assertStatus(pr, [PurchaseRequestStatus.DRAFT, PurchaseRequestStatus.SUBMITTED, PurchaseRequestStatus.APPROVED])
    await this.prisma.purchaseRequest.update({ where: { id }, data: { status: PurchaseRequestStatus.CANCELLED } })
    this.emitStatusChanged(organizationId, id, pr.requestedByUserId, pr.status, PurchaseRequestStatus.CANCELLED)
    const updated = await this.requirePr(organizationId, id)
    return updated as unknown as PurchaseRequest
  }

  private emitStatusChanged(
    organizationId: string,
    purchaseRequestId: string,
    userId: string,
    fromStatus: PurchaseRequestStatus,
    toStatus: PurchaseRequestStatus,
    reason?: string,
  ) {
    this.eventEmitter.emit('purchase_request.status_changed', {
      organizationId,
      userId,
      purchaseRequestId,
      fromStatus,
      toStatus,
      reason,
    })
  }

  /** Called by `PurchaseOrdersService` once an approved PR is converted into a PO. */
  async markConverted(organizationId: string, id: string): Promise<void> {
    const pr = await this.requirePr(organizationId, id)
    this.assertStatus(pr, [PurchaseRequestStatus.APPROVED])
    await this.prisma.purchaseRequest.update({ where: { id }, data: { status: PurchaseRequestStatus.CONVERTED } })
  }

  private assertStatus(pr: { status: PurchaseRequestStatus }, allowed: PurchaseRequestStatus[]) {
    if (!allowed.includes(pr.status)) {
      throw new ConflictException(`Purchase request is ${pr.status}; expected one of ${allowed.join(', ')}`)
    }
  }

  private async requirePr(organizationId: string, id: string) {
    const pr = await this.prisma.purchaseRequest.findFirst({ where: { id, organizationId }, include: PR_INCLUDE })
    if (!pr) throw new NotFoundException('Purchase request not found')
    return pr
  }
}
