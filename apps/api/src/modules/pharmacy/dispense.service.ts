import {
  CancelDispenseOrderDto,
  CreateDispenseOrderDto,
  CreateDrugReturnDto,
  DispenseOrder,
  DispenseOrderQuery,
  DispenseOrderWithDetails,
  DispensePartialDto,
  DispenseStatus,
  DrugReturn,
  PharmacyDashboardStats,
  PrepareDispenseItemsDto,
  PrescriptionStatus,
} from '@medicore/types'
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import {
  DispenseItem as PrismaDispenseItem,
  DispenseOrder as PrismaDispenseOrder,
  DispenseStatus as PrismaDispenseStatus,
  DrugReturn as PrismaDrugReturn,
  Prisma,
} from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'
import { PrescriptionsService } from '../prescriptions/prescriptions.service'

import { DrugCatalogService } from './drug-catalog.service'

type DispenseOrderWithRelations = PrismaDispenseOrder & {
  patient: { id: string; firstName: string; lastName: string; uhid: string }
  prescription: { id: string; prescriptionNumber: string; doctorId: string; doctor: { user: { firstName: string; lastName: string } } }
  items: (PrismaDispenseItem & {
    drug: { id: string; genericName: string; brandName: string | null; batchNumber: string; expiryDate: Date } | null
  })[]
  returns: PrismaDrugReturn[]
}

const DISPENSE_ORDER_WITH_RELATIONS_INCLUDE = {
  patient: { select: { id: true, firstName: true, lastName: true, uhid: true } },
  prescription: {
    select: {
      id: true,
      prescriptionNumber: true,
      doctorId: true,
      doctor: { select: { user: { select: { firstName: true, lastName: true } } } },
    },
  },
  items: {
    include: {
      drug: { select: { id: true, genericName: true, brandName: true, batchNumber: true, expiryDate: true } },
    },
  },
  returns: { orderBy: { returnedAt: 'desc' } },
} satisfies Prisma.DispenseOrderInclude

/**
 * Dispensing workflow — see ADR-0014. `pharmacy.*` stays all-scope (staff-
 * facing, no doctor own-scope check needed, unlike laboratory/radiology).
 */
@Injectable()
export class DispenseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogService: DrugCatalogService,
    private readonly prescriptionsService: PrescriptionsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(organizationId: string, query: DispenseOrderQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20

    const where: Prisma.DispenseOrderWhereInput = { organizationId }
    if (query.patientId) where.patientId = query.patientId
    if (query.status) where.status = query.status as unknown as PrismaDispenseStatus

    const sortBy = query.sortBy ?? 'createdAt'
    const sortOrder = query.sortOrder ?? 'desc'

    const [data, total] = await Promise.all([
      this.prisma.dispenseOrder.findMany({
        where,
        include: DISPENSE_ORDER_WITH_RELATIONS_INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.dispenseOrder.count({ where }),
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

  async getById(organizationId: string, id: string): Promise<DispenseOrderWithDetails> {
    const order = await this.requireOrderWithRelations(organizationId, id)
    return this.toResponse(order)
  }

  async getDashboardStats(organizationId: string): Promise<PharmacyDashboardStats> {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const startOfTomorrow = new Date(startOfToday)
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)

    const [pending, ready, dispensedToday, lowStock, expiringSoon] = await Promise.all([
      this.prisma.dispenseOrder.count({ where: { organizationId, status: PrismaDispenseStatus.PENDING } }),
      this.prisma.dispenseOrder.count({ where: { organizationId, status: PrismaDispenseStatus.READY } }),
      // `dispensedAt` is set once, when the order first reaches DISPENSED —
      // a later return moves status to RETURNED but doesn't clear
      // `dispensedAt`, so this still counts it as dispensed today.
      this.prisma.dispenseOrder.count({
        where: {
          organizationId,
          status: { in: [PrismaDispenseStatus.DISPENSED, PrismaDispenseStatus.RETURNED] },
          dispensedAt: { gte: startOfToday, lt: startOfTomorrow },
        },
      }),
      this.catalogService.countLowStock(organizationId),
      this.catalogService.countExpiringSoon(organizationId),
    ])

    return { pending, ready, dispensedToday, lowStock, expiringSoon }
  }

  /** "Dispense prescription" — creates the one-per-prescription order, items mirroring `PrescriptionItem` 1:1. */
  async createFromPrescription(
    organizationId: string,
    dto: CreateDispenseOrderDto,
    actorUserId?: string,
  ): Promise<DispenseOrder> {
    const prescription = await this.prescriptionsService.getById(organizationId, dto.prescriptionId)
    if (prescription.status !== PrescriptionStatus.ACTIVE) {
      throw new BadRequestException(`Cannot dispense a prescription that is ${prescription.status}`)
    }

    const existing = await this.prisma.dispenseOrder.findUnique({ where: { prescriptionId: dto.prescriptionId } })
    if (existing) throw new ConflictException('This prescription already has a dispense order')

    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })
    const settings = (org.settings ?? {}) as Record<string, unknown>
    const prefix = typeof settings.uhidPrefix === 'string' ? settings.uhidPrefix : 'MED'

    const order = await this.prisma.$transaction(async (tx) => {
      const dispenseNumber = await this.generateDispenseNumber(tx, organizationId, prefix)
      return tx.dispenseOrder.create({
        data: {
          dispenseNumber,
          prescriptionId: dto.prescriptionId,
          patientId: prescription.patientId,
          organizationId,
          notes: dto.notes,
          items: {
            create: prescription.items.map((item) => ({
              prescriptionItemId: item.id,
              medicationName: item.medicationName,
              quantityRequested: item.quantity,
            })),
          },
        },
      })
    })

    this.eventEmitter.emit('dispense_order.created', {
      dispenseOrderId: order.id,
      patientId: order.patientId,
      organizationId,
      userId: actorUserId,
    })

    return this.toPlainResponse(order)
  }

  /** "Batch selection" — resolves items to catalog `Drug` batches and reserves stock. Repeatable while PENDING/PREPARING. */
  async prepareItems(
    organizationId: string,
    id: string,
    dto: PrepareDispenseItemsDto,
    actorUserId?: string,
  ): Promise<DispenseOrderWithDetails> {
    const order = await this.requireOrderWithRelations(organizationId, id)
    const currentStatus = order.status as unknown as DispenseStatus
    if (currentStatus !== DispenseStatus.PENDING && currentStatus !== DispenseStatus.PREPARING) {
      throw new BadRequestException(`Cannot select batches while the order is ${currentStatus}`)
    }

    await this.prisma.$transaction(async (tx) => {
      for (const selection of dto.items) {
        const item = order.items.find((i) => i.id === selection.dispenseItemId)
        if (!item) throw new NotFoundException(`Dispense item ${selection.dispenseItemId} not found on this order`)

        const drug = await tx.drug.findFirst({ where: { id: selection.drugId, organizationId } })
        if (!drug) throw new NotFoundException('Drug not found')
        if (!drug.isActive) throw new BadRequestException(`${drug.genericName} (batch ${drug.batchNumber}) is inactive`)

        const remaining = item.quantityRequested - item.quantityDispensed

        // Re-selecting a batch releases the previous reservation first.
        if (item.drugId && item.drugId !== drug.id) {
          await tx.drug.update({ where: { id: item.drugId }, data: { reservedStock: { decrement: remaining } } })
        }

        if (item.drugId !== drug.id) {
          const available = drug.currentStock - drug.reservedStock
          if (available < remaining) {
            throw new BadRequestException(
              `${drug.genericName} (batch ${drug.batchNumber}) has only ${available} unit(s) available — ${remaining} required`,
            )
          }
          await tx.drug.update({ where: { id: drug.id }, data: { reservedStock: { increment: remaining } } })
        }

        await tx.dispenseItem.update({ where: { id: item.id }, data: { drugId: drug.id } })
      }

      if (currentStatus === DispenseStatus.PENDING) {
        await tx.dispenseOrder.update({
          where: { id },
          data: { status: PrismaDispenseStatus.PREPARING, preparedByUserId: actorUserId },
        })
      }
    })

    if (currentStatus === DispenseStatus.PENDING) {
      this.emitStatusChanged(order, currentStatus, DispenseStatus.PREPARING, actorUserId)
    }
    return this.getById(organizationId, id)
  }

  /** Confirms every item has a batch selected and the order is ready to hand over. */
  async markReady(organizationId: string, id: string, actorUserId?: string): Promise<DispenseOrder> {
    const order = await this.requireOrderWithRelations(organizationId, id)
    const currentStatus = order.status as unknown as DispenseStatus
    if (currentStatus !== DispenseStatus.PREPARING) {
      throw new BadRequestException(`Cannot mark ready while the order is ${currentStatus}`)
    }
    if (order.items.some((i) => !i.drugId)) {
      throw new BadRequestException('Every item must have a batch selected before marking the order ready')
    }

    const updated = await this.prisma.dispenseOrder.update({
      where: { id },
      data: { status: PrismaDispenseStatus.READY, preparedByUserId: order.preparedByUserId ?? actorUserId },
    })
    this.emitStatusChanged(updated, currentStatus, DispenseStatus.READY, actorUserId)
    return this.toPlainResponse(updated)
  }

  /** "Partial dispense" — fills the specified quantities; the order stays `READY` until every item is fully filled. */
  async dispensePartial(
    organizationId: string,
    id: string,
    dto: DispensePartialDto,
    actorUserId?: string,
  ): Promise<DispenseOrderWithDetails> {
    const order = await this.requireOrderWithRelations(organizationId, id)
    if ((order.status as unknown as DispenseStatus) !== DispenseStatus.READY) {
      throw new BadRequestException(`Cannot dispense while the order is ${order.status}`)
    }

    await this.prisma.$transaction(async (tx) => {
      for (const line of dto.items) {
        const item = order.items.find((i) => i.id === line.dispenseItemId)
        if (!item) throw new NotFoundException(`Dispense item ${line.dispenseItemId} not found on this order`)
        if (!item.drugId) throw new BadRequestException(`${item.medicationName} has no batch selected`)

        const remaining = item.quantityRequested - item.quantityDispensed
        if (line.quantity > remaining) {
          throw new BadRequestException(`Cannot dispense ${line.quantity} of ${item.medicationName} — only ${remaining} remaining`)
        }

        await tx.drug.update({
          where: { id: item.drugId },
          data: { currentStock: { decrement: line.quantity }, reservedStock: { decrement: line.quantity } },
        })
        await tx.dispenseItem.update({
          where: { id: item.id },
          data: { quantityDispensed: { increment: line.quantity } },
        })
      }
    })

    this.eventEmitter.emit('dispense_order.partially_dispensed', {
      dispenseOrderId: id,
      patientId: order.patientId,
      organizationId,
      userId: actorUserId,
    })
    return this.getById(organizationId, id)
  }

  /** "Complete dispense" — fills every item's remaining quantity and moves the order to `DISPENSED`. */
  async dispenseComplete(organizationId: string, id: string, actorUserId?: string): Promise<DispenseOrderWithDetails> {
    const order = await this.requireOrderWithRelations(organizationId, id)
    const currentStatus = order.status as unknown as DispenseStatus
    if (currentStatus !== DispenseStatus.READY) {
      throw new BadRequestException(`Cannot dispense while the order is ${currentStatus}`)
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        const remaining = item.quantityRequested - item.quantityDispensed
        if (remaining <= 0) continue
        if (!item.drugId) throw new BadRequestException(`${item.medicationName} has no batch selected`)

        await tx.drug.update({
          where: { id: item.drugId },
          data: { currentStock: { decrement: remaining }, reservedStock: { decrement: remaining } },
        })
        await tx.dispenseItem.update({ where: { id: item.id }, data: { quantityDispensed: item.quantityRequested } })
      }

      await tx.dispenseOrder.update({
        where: { id },
        data: { status: PrismaDispenseStatus.DISPENSED, dispensedAt: new Date(), dispensedByUserId: actorUserId },
      })
    })

    this.emitStatusChanged(order, currentStatus, DispenseStatus.DISPENSED, actorUserId)

    // Best-effort: complete the source prescription. A cross-module call
    // (same idiom as `RadiologyOrdersService` reusing `EncountersService`),
    // not part of the same DB transaction.
    await this.prescriptionsService
      .updateStatus(organizationId, order.prescriptionId, { status: PrescriptionStatus.COMPLETED }, actorUserId)
      .catch(() => undefined)

    return this.getById(organizationId, id)
  }

  /** Pharmacist declines an unprocessed order (e.g. drug unavailable, invalid prescription) — see ADR-0014 point 5. */
  async reject(organizationId: string, id: string, dto: CancelDispenseOrderDto, actorUserId?: string): Promise<DispenseOrder> {
    return this.cancelOrReject(organizationId, id, dto, actorUserId, true)
  }

  /** Cancels an unprocessed/in-progress order — see ADR-0014 point 5. */
  async cancel(organizationId: string, id: string, dto: CancelDispenseOrderDto, actorUserId?: string): Promise<DispenseOrder> {
    return this.cancelOrReject(organizationId, id, dto, actorUserId, false)
  }

  private async cancelOrReject(
    organizationId: string,
    id: string,
    dto: CancelDispenseOrderDto,
    actorUserId: string | undefined,
    rejected: boolean,
  ): Promise<DispenseOrder> {
    const order = await this.requireOrderWithRelations(organizationId, id)
    const currentStatus = order.status as unknown as DispenseStatus
    if (currentStatus === DispenseStatus.DISPENSED || currentStatus === DispenseStatus.RETURNED || currentStatus === DispenseStatus.CANCELLED) {
      throw new BadRequestException(`Cannot ${rejected ? 'reject' : 'cancel'} an order that is ${currentStatus}`)
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        if (!item.drugId) continue
        const remaining = item.quantityRequested - item.quantityDispensed
        if (remaining > 0) {
          await tx.drug.update({ where: { id: item.drugId }, data: { reservedStock: { decrement: remaining } } })
        }
      }
      return tx.dispenseOrder.update({
        where: { id },
        data: { status: PrismaDispenseStatus.CANCELLED, rejected, cancelReason: dto.reason },
      })
    })

    this.emitStatusChanged(updated, currentStatus, DispenseStatus.CANCELLED, actorUserId, dto.reason)
    return this.toPlainResponse(updated)
  }

  // ─── Returns ────────────────────────────────────────────────────────────

  /** Medicine return against an already-dispensed item — restocks and audits (roadmap's "Adjust stock"). */
  async createReturn(
    organizationId: string,
    id: string,
    dto: CreateDrugReturnDto,
    actorUserId: string,
  ): Promise<DrugReturn> {
    const order = await this.requireOrderWithRelations(organizationId, id)
    const currentStatus = order.status as unknown as DispenseStatus
    if (currentStatus !== DispenseStatus.DISPENSED && currentStatus !== DispenseStatus.RETURNED) {
      throw new BadRequestException(`Cannot return medicine for an order that is ${currentStatus}`)
    }

    const item = order.items.find((i) => i.id === dto.dispenseItemId)
    if (!item) throw new NotFoundException('Dispense item not found on this order')

    const alreadyReturned = order.returns
      .filter((r) => r.dispenseItemId === item.id)
      .reduce((sum, r) => sum + r.quantityReturned, 0)
    const returnable = item.quantityDispensed - alreadyReturned
    if (dto.quantityReturned > returnable) {
      throw new BadRequestException(`Only ${returnable} unit(s) of ${item.medicationName} can still be returned`)
    }

    const created = await this.prisma.$transaction(async (tx) => {
      if (item.drugId) {
        await tx.drug.update({ where: { id: item.drugId }, data: { currentStock: { increment: dto.quantityReturned } } })
      }
      const drugReturn = await tx.drugReturn.create({
        data: {
          dispenseOrderId: id,
          dispenseItemId: item.id,
          drugId: item.drugId,
          organizationId,
          quantityReturned: dto.quantityReturned,
          reason: dto.reason,
          returnedByUserId: actorUserId,
        },
      })
      if (currentStatus === DispenseStatus.DISPENSED) {
        await tx.dispenseOrder.update({ where: { id }, data: { status: PrismaDispenseStatus.RETURNED } })
      }
      return drugReturn
    })

    this.eventEmitter.emit('drug_return.created', {
      dispenseOrderId: id,
      drugReturnId: created.id,
      patientId: order.patientId,
      organizationId,
      userId: actorUserId,
    })
    if (currentStatus === DispenseStatus.DISPENSED) {
      this.emitStatusChanged(order, currentStatus, DispenseStatus.RETURNED, actorUserId)
    }

    return this.toReturnResponse(created)
  }

  async listReturns(organizationId: string, id: string): Promise<DrugReturn[]> {
    await this.requireOrder(organizationId, id)
    const returns = await this.prisma.drugReturn.findMany({ where: { dispenseOrderId: id }, orderBy: { returnedAt: 'desc' } })
    return returns.map((r) => this.toReturnResponse(r))
  }

  // ─── Shared helpers ───────────────────────────────────────────────────────

  async requireOrder(organizationId: string, id: string): Promise<PrismaDispenseOrder> {
    const order = await this.prisma.dispenseOrder.findFirst({ where: { id, organizationId } })
    if (!order) throw new NotFoundException('Dispense order not found')
    return order
  }

  private async requireOrderWithRelations(organizationId: string, id: string): Promise<DispenseOrderWithRelations> {
    const order = await this.prisma.dispenseOrder.findFirst({
      where: { id, organizationId },
      include: DISPENSE_ORDER_WITH_RELATIONS_INCLUDE,
    })
    if (!order) throw new NotFoundException('Dispense order not found')
    return order as DispenseOrderWithRelations
  }

  private emitStatusChanged(
    order: PrismaDispenseOrder,
    fromStatus: DispenseStatus,
    toStatus: DispenseStatus,
    actorUserId?: string,
    reason?: string,
  ): void {
    this.eventEmitter.emit('dispense_order.status_changed', {
      dispenseOrderId: order.id,
      patientId: order.patientId,
      organizationId: order.organizationId,
      userId: actorUserId,
      fromStatus,
      toStatus,
      reason,
    })
  }

  private async generateDispenseNumber(
    tx: Prisma.TransactionClient,
    organizationId: string,
    prefix: string,
  ): Promise<string> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId} || ':dispense_order')::bigint)`

    const year = new Date().getFullYear()
    const yearStart = new Date(Date.UTC(year, 0, 1))
    const count = await tx.dispenseOrder.count({ where: { organizationId, createdAt: { gte: yearStart } } })

    return `DSP-${prefix}-${year}-${String(count + 1).padStart(6, '0')}`
  }

  private toResponse(order: DispenseOrderWithRelations): DispenseOrderWithDetails {
    return {
      ...this.toPlainResponse(order),
      patient: {
        id: order.patient.id,
        fullName: `${order.patient.firstName} ${order.patient.lastName}`,
        uhid: order.patient.uhid,
      },
      prescription: {
        id: order.prescription.id,
        prescriptionNumber: order.prescription.prescriptionNumber,
        doctorId: order.prescription.doctorId,
        doctorFullName: `${order.prescription.doctor.user.firstName} ${order.prescription.doctor.user.lastName}`,
      },
      items: order.items.map((item) => ({
        id: item.id,
        dispenseOrderId: item.dispenseOrderId,
        prescriptionItemId: item.prescriptionItemId,
        drugId: item.drugId,
        medicationName: item.medicationName,
        quantityRequested: item.quantityRequested,
        quantityDispensed: item.quantityDispensed,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        drug: item.drug,
      })),
      returns: order.returns.map((r) => this.toReturnResponse(r)),
    }
  }

  private toReturnResponse(drugReturn: PrismaDrugReturn): DrugReturn {
    return {
      id: drugReturn.id,
      dispenseOrderId: drugReturn.dispenseOrderId,
      dispenseItemId: drugReturn.dispenseItemId,
      drugId: drugReturn.drugId,
      organizationId: drugReturn.organizationId,
      quantityReturned: drugReturn.quantityReturned,
      reason: drugReturn.reason,
      returnedByUserId: drugReturn.returnedByUserId,
      returnedAt: drugReturn.returnedAt,
    }
  }

  private toPlainResponse(order: PrismaDispenseOrder): DispenseOrder {
    return {
      id: order.id,
      dispenseNumber: order.dispenseNumber,
      prescriptionId: order.prescriptionId,
      patientId: order.patientId,
      organizationId: order.organizationId,
      status: order.status as unknown as DispenseStatus,
      preparedByUserId: order.preparedByUserId,
      dispensedByUserId: order.dispensedByUserId,
      dispensedAt: order.dispensedAt,
      rejected: order.rejected,
      cancelReason: order.cancelReason,
      notes: order.notes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }
  }
}
