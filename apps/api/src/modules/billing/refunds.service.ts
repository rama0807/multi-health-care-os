import { CreateRefundDto, InvoiceStatus, PaymentMode, Refund, RefundQuery, RefundStatus, RejectRefundDto } from '@medicore/types'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { InvoiceStatus as PrismaInvoiceStatus, Prisma, Refund as PrismaRefund, RefundStatus as PrismaRefundStatus } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

/**
 * Refunds - see ADR-0015. A `billing.manage` scope holder's request is
 * auto-approved and completed immediately; anyone else's lands `PENDING`
 * until a manage-scope holder approves it - the same approval-workflow
 * shape as `InvoicesService`'s discount fields. Any completed refund
 * (partial or full) flips the invoice to `REFUNDED`, mirroring
 * `DispenseOrder`'s `RETURNED`-on-any-return precedent (ADR-0014).
 */
@Injectable()
export class RefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(organizationId: string, query: RefundQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20

    const where: Prisma.RefundWhereInput = { organizationId }
    if (query.invoiceId) where.invoiceId = query.invoiceId
    if (query.status) where.status = query.status as unknown as PrismaRefundStatus

    const [data, total] = await Promise.all([
      this.prisma.refund.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.refund.count({ where }),
    ])

    return {
      data: data.map((r) => this.toResponse(r)),
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

  async getById(organizationId: string, id: string): Promise<Refund> {
    return this.toResponse(await this.requireRefund(organizationId, id))
  }

  async request(
    organizationId: string,
    invoiceId: string,
    dto: CreateRefundDto,
    actorUserId: string,
    canManage: boolean,
  ): Promise<Refund> {
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, organizationId } })
    if (!invoice) throw new NotFoundException('Invoice not found')

    const status = invoice.status as unknown as InvoiceStatus
    if (status !== InvoiceStatus.PAID && status !== InvoiceStatus.PARTIALLY_PAID && status !== InvoiceStatus.REFUNDED) {
      throw new BadRequestException(`Cannot refund an invoice that is ${status} - no payment has been collected yet`)
    }

    if (dto.paymentId) {
      const payment = await this.prisma.payment.findFirst({ where: { id: dto.paymentId, invoiceId, organizationId } })
      if (!payment) throw new NotFoundException('Payment not found on this invoice')
    }

    const remaining = await this.remainingRefundableAmount(invoice.id, Number(invoice.paidAmount))
    if (dto.amount > remaining) {
      throw new BadRequestException(`Refund of ${dto.amount} exceeds the refundable balance of ${remaining}`)
    }

    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })
    const settings = (org.settings ?? {}) as Record<string, unknown>
    const prefix = typeof settings.uhidPrefix === 'string' ? settings.uhidPrefix : 'MED'

    const now = new Date()
    const willComplete = canManage
    const refund = await this.prisma.$transaction(async (tx) => {
      const refundNumber = await this.generateRefundNumber(tx, organizationId, prefix)
      const created = await tx.refund.create({
        data: {
          refundNumber,
          organizationId,
          invoiceId,
          paymentId: dto.paymentId,
          amount: dto.amount,
          reason: dto.reason,
          refundMode: dto.refundMode,
          status: willComplete ? PrismaRefundStatus.COMPLETED : PrismaRefundStatus.PENDING,
          requestedByUserId: actorUserId,
          approvedByUserId: willComplete ? actorUserId : null,
          approvedAt: willComplete ? now : null,
          refundedAt: willComplete ? now : null,
        },
      })
      if (willComplete) {
        await tx.invoice.update({ where: { id: invoiceId }, data: { status: PrismaInvoiceStatus.REFUNDED } })
      }
      return created
    })

    this.eventEmitter.emit(willComplete ? 'refund.completed' : 'refund.requested', {
      refundId: refund.id,
      invoiceId,
      patientId: invoice.patientId,
      organizationId,
      userId: actorUserId,
      amount: dto.amount,
    })

    return this.toResponse(refund)
  }

  async approve(organizationId: string, id: string, actorUserId: string): Promise<Refund> {
    const refund = await this.requireRefund(organizationId, id)
    if ((refund.status as unknown as RefundStatus) !== RefundStatus.PENDING) {
      throw new BadRequestException(`Cannot approve a refund that is ${refund.status}`)
    }

    const invoice = await this.prisma.invoice.findFirstOrThrow({ where: { id: refund.invoiceId } })
    const remaining = await this.remainingRefundableAmount(invoice.id, Number(invoice.paidAmount), refund.id)
    if (Number(refund.amount) > remaining) {
      throw new BadRequestException('This refund now exceeds the invoice\'s refundable balance - reject it instead')
    }

    const now = new Date()
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.refund.update({
        where: { id },
        data: { status: PrismaRefundStatus.COMPLETED, approvedByUserId: actorUserId, approvedAt: now, refundedAt: now },
      })
      await tx.invoice.update({ where: { id: refund.invoiceId }, data: { status: PrismaInvoiceStatus.REFUNDED } })
      return result
    })

    this.eventEmitter.emit('refund.completed', {
      refundId: id,
      invoiceId: refund.invoiceId,
      patientId: invoice.patientId,
      organizationId,
      userId: actorUserId,
      amount: Number(refund.amount),
    })
    return this.toResponse(updated)
  }

  async reject(organizationId: string, id: string, dto: RejectRefundDto, actorUserId: string): Promise<Refund> {
    const refund = await this.requireRefund(organizationId, id)
    if ((refund.status as unknown as RefundStatus) !== RefundStatus.PENDING) {
      throw new BadRequestException(`Cannot reject a refund that is ${refund.status}`)
    }

    const updated = await this.prisma.refund.update({
      where: { id },
      data: { status: PrismaRefundStatus.REJECTED, rejectionReason: dto.reason },
    })

    this.eventEmitter.emit('refund.rejected', {
      refundId: id,
      invoiceId: refund.invoiceId,
      patientId: (await this.prisma.invoice.findFirstOrThrow({ where: { id: refund.invoiceId } })).patientId,
      organizationId,
      userId: actorUserId,
      reason: dto.reason,
    })
    return this.toResponse(updated)
  }

  private async remainingRefundableAmount(invoiceId: string, paidAmount: number, excludeRefundId?: string): Promise<number> {
    const completed = await this.prisma.refund.findMany({
      where: { invoiceId, status: PrismaRefundStatus.COMPLETED, ...(excludeRefundId ? { id: { not: excludeRefundId } } : {}) },
    })
    const refundedSoFar = completed.reduce((sum, r) => sum + Number(r.amount), 0)
    return Math.max(paidAmount - refundedSoFar, 0)
  }

  private async requireRefund(organizationId: string, id: string): Promise<PrismaRefund> {
    const refund = await this.prisma.refund.findFirst({ where: { id, organizationId } })
    if (!refund) throw new NotFoundException('Refund not found')
    return refund
  }

  private async generateRefundNumber(
    tx: Prisma.TransactionClient,
    organizationId: string,
    prefix: string,
  ): Promise<string> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId} || ':refund')::bigint)`

    const year = new Date().getFullYear()
    const yearStart = new Date(Date.UTC(year, 0, 1))
    const count = await tx.refund.count({ where: { organizationId, createdAt: { gte: yearStart } } })

    return `REF-${prefix}-${year}-${String(count + 1).padStart(6, '0')}`
  }

  private toResponse(refund: PrismaRefund): Refund {
    return {
      id: refund.id,
      refundNumber: refund.refundNumber,
      organizationId: refund.organizationId,
      invoiceId: refund.invoiceId,
      paymentId: refund.paymentId,
      amount: refund.amount.toString(),
      reason: refund.reason,
      refundMode: refund.refundMode as unknown as PaymentMode | null,
      status: refund.status as unknown as RefundStatus,
      requestedByUserId: refund.requestedByUserId,
      approvedByUserId: refund.approvedByUserId,
      approvedAt: refund.approvedAt,
      rejectionReason: refund.rejectionReason,
      refundedAt: refund.refundedAt,
      createdAt: refund.createdAt,
    }
  }
}
