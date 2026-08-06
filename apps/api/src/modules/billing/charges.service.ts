import { Charge, ChargeQuery, ChargeStatus, CreateChargeDto } from '@medicore/types'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Charge as PrismaCharge, ChargeStatus as PrismaChargeStatus, Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { computeLineItemAmounts } from './billing-calculations'

/**
 * The reusable Charge Engine - see ADR-0015. `create` is the single entry
 * point any clinical module (or a manual cashier action) uses to bill a
 * patient for something; `sourceModule`/`sourceId` record provenance
 * without a hard FK into each module's own tables. Invoice generation
 * (`InvoicesService`) sweeps `PENDING` charges into an invoice.
 */
@Injectable()
export class ChargesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(organizationId: string, dto: CreateChargeDto, actorUserId?: string): Promise<Charge> {
    const patient = await this.prisma.patient.findFirst({ where: { id: dto.patientId, organizationId } })
    if (!patient) throw new NotFoundException('Patient not found')

    let description = dto.description
    let unitPrice = dto.unitPrice
    let taxPercent = dto.taxPercent ?? 0

    if (dto.catalogItemId) {
      const catalogItem = await this.prisma.serviceCatalogItem.findFirst({
        where: { id: dto.catalogItemId, organizationId },
      })
      if (!catalogItem) throw new NotFoundException('Service catalog item not found')
      if (!catalogItem.isActive) throw new BadRequestException(`"${catalogItem.name}" is inactive`)
      description = description ?? catalogItem.name
      unitPrice = unitPrice ?? Number(catalogItem.price)
      taxPercent = dto.taxPercent ?? Number(catalogItem.taxPercent)
    }

    if (!description || unitPrice === undefined) {
      throw new BadRequestException('Either catalogItemId, or both description and unitPrice, must be provided')
    }

    const amounts = computeLineItemAmounts({
      quantity: dto.quantity,
      unitPrice,
      discountPercent: dto.discountPercent,
      taxPercent,
    })

    const charge = await this.prisma.charge.create({
      data: {
        organizationId,
        patientId: dto.patientId,
        encounterId: dto.encounterId,
        appointmentId: dto.appointmentId,
        sourceModule: dto.sourceModule,
        sourceId: dto.sourceId,
        catalogItemId: dto.catalogItemId,
        description,
        quantity: dto.quantity,
        unitPrice,
        discountPercent: dto.discountPercent,
        discountAmount: amounts.discountAmount,
        taxPercent,
        taxAmount: amounts.taxAmount,
        totalAmount: amounts.totalAmount,
        createdByUserId: actorUserId,
      },
    })

    this.eventEmitter.emit('charge.created', {
      chargeId: charge.id,
      patientId: charge.patientId,
      organizationId,
      userId: actorUserId,
      sourceModule: charge.sourceModule,
    })

    return this.toResponse(charge)
  }

  async list(organizationId: string, query: ChargeQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20

    const where: Prisma.ChargeWhereInput = { organizationId }
    if (query.patientId) where.patientId = query.patientId
    if (query.encounterId) where.encounterId = query.encounterId
    if (query.appointmentId) where.appointmentId = query.appointmentId
    if (query.status) where.status = query.status as unknown as PrismaChargeStatus

    const [data, total] = await Promise.all([
      this.prisma.charge.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.charge.count({ where }),
    ])

    return {
      data: data.map((c) => this.toResponse(c)),
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

  async getById(organizationId: string, id: string): Promise<Charge> {
    return this.toResponse(await this.requireCharge(organizationId, id))
  }

  /** Voids a not-yet-invoiced charge - e.g. it was raised in error. */
  async void(organizationId: string, id: string, actorUserId?: string): Promise<Charge> {
    const charge = await this.requireCharge(organizationId, id)
    if ((charge.status as unknown as ChargeStatus) !== ChargeStatus.PENDING) {
      throw new BadRequestException(`Cannot void a charge that is ${charge.status}`)
    }

    const updated = await this.prisma.charge.update({ where: { id }, data: { status: PrismaChargeStatus.VOIDED } })
    this.eventEmitter.emit('charge.voided', {
      chargeId: id,
      patientId: charge.patientId,
      organizationId,
      userId: actorUserId,
    })
    return this.toResponse(updated)
  }

  async requireCharge(organizationId: string, id: string): Promise<PrismaCharge> {
    const charge = await this.prisma.charge.findFirst({ where: { id, organizationId } })
    if (!charge) throw new NotFoundException('Charge not found')
    return charge
  }

  private toResponse(charge: PrismaCharge): Charge {
    return {
      id: charge.id,
      organizationId: charge.organizationId,
      patientId: charge.patientId,
      encounterId: charge.encounterId,
      appointmentId: charge.appointmentId,
      sourceModule: charge.sourceModule as unknown as Charge['sourceModule'],
      sourceId: charge.sourceId,
      catalogItemId: charge.catalogItemId,
      description: charge.description,
      quantity: charge.quantity,
      unitPrice: charge.unitPrice.toString(),
      discountPercent: charge.discountPercent.toString(),
      discountAmount: charge.discountAmount.toString(),
      taxPercent: charge.taxPercent.toString(),
      taxAmount: charge.taxAmount.toString(),
      totalAmount: charge.totalAmount.toString(),
      status: charge.status as unknown as ChargeStatus,
      invoiceId: charge.invoiceId,
      createdByUserId: charge.createdByUserId,
      createdAt: charge.createdAt,
    }
  }
}
