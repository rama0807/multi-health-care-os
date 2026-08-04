import {
  CreateIpdOrderDto,
  DiscontinueIpdOrderDto,
  IpdOrder,
  IpdOrderCategory,
  IpdOrderQuery,
  IpdOrderStatus,
} from '@medicore/types'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { IpdOrder as PrismaIpdOrder, Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { AdmissionsService } from './admissions.service'

/** Doctor orders against an admission — diet/fluid/activity/oxygen/isolation. */
@Injectable()
export class IpdOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly admissionsService: AdmissionsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(organizationId: string, admissionId: string, query: IpdOrderQuery) {
    await this.admissionsService.requireAdmission(organizationId, admissionId)
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20

    const where: Prisma.IpdOrderWhereInput = { admissionId, organizationId }
    if (query.category) where.category = query.category as unknown as Prisma.IpdOrderWhereInput['category']
    if (query.status) where.status = query.status as unknown as Prisma.IpdOrderWhereInput['status']

    const [data, total] = await Promise.all([
      this.prisma.ipdOrder.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.ipdOrder.count({ where }),
    ])

    return {
      data: data.map((o) => this.toResponse(o)),
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

  async create(
    organizationId: string,
    admissionId: string,
    dto: CreateIpdOrderDto,
    actorUserId: string,
  ): Promise<IpdOrder> {
    const admission = await this.admissionsService.requireAdmission(organizationId, admissionId)
    if (admission.status !== 'ADMITTED') {
      throw new ConflictException('Orders can only be placed against an active admission')
    }

    const order = await this.prisma.ipdOrder.create({
      data: {
        admissionId,
        organizationId,
        category: dto.category as unknown as Prisma.IpdOrderCreateInput['category'],
        instructions: dto.instructions,
        orderedByUserId: actorUserId,
      },
    })

    this.eventEmitter.emit('ipd.order_created', {
      ipdOrderId: order.id,
      admissionId,
      patientId: admission.patientId,
      organizationId,
      userId: actorUserId,
      category: order.category,
    })

    return this.toResponse(order)
  }

  async discontinue(
    organizationId: string,
    admissionId: string,
    orderId: string,
    dto: DiscontinueIpdOrderDto,
    actorUserId: string,
  ): Promise<IpdOrder> {
    const order = await this.requireOrder(organizationId, admissionId, orderId)
    if (order.status !== 'ACTIVE') {
      throw new ConflictException(`Order is already ${order.status.toLowerCase()}`)
    }

    const updated = await this.prisma.ipdOrder.update({
      where: { id: orderId },
      data: {
        status: 'DISCONTINUED',
        discontinuedAt: new Date(),
        discontinuedReason: dto.reason,
        discontinuedByUserId: actorUserId,
      },
    })

    this.eventEmitter.emit('ipd.order_discontinued', {
      ipdOrderId: order.id,
      admissionId,
      organizationId,
      userId: actorUserId,
      category: order.category,
    })

    return this.toResponse(updated)
  }

  private async requireOrder(organizationId: string, admissionId: string, orderId: string): Promise<PrismaIpdOrder> {
    const order = await this.prisma.ipdOrder.findFirst({ where: { id: orderId, admissionId, organizationId } })
    if (!order) throw new NotFoundException('IPD order not found')
    return order
  }

  private toResponse(order: PrismaIpdOrder): IpdOrder {
    return {
      id: order.id,
      admissionId: order.admissionId,
      organizationId: order.organizationId,
      category: order.category as unknown as IpdOrderCategory,
      instructions: order.instructions,
      status: order.status as unknown as IpdOrderStatus,
      orderedByUserId: order.orderedByUserId,
      startedAt: order.startedAt,
      discontinuedAt: order.discontinuedAt,
      discontinuedReason: order.discontinuedReason,
      discontinuedByUserId: order.discontinuedByUserId,
      createdAt: order.createdAt,
    }
  }
}
