import {
  ApplyDiscountDto,
  CancelInvoiceDto,
  CreateInvoiceDto,
  DiscountApprovalStatus,
  Invoice,
  InvoiceItem,
  InvoiceQuery,
  InvoiceStatus,
  InvoiceWithDetails,
  Payment,
  PaymentMode,
  PaymentStatus,
  Refund,
  RefundStatus,
  RejectDiscountDto,
} from '@medicore/types'
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import {
  DiscountApprovalStatus as PrismaDiscountApprovalStatus,
  Invoice as PrismaInvoice,
  InvoiceItem as PrismaInvoiceItem,
  InvoiceStatus as PrismaInvoiceStatus,
  InvoiceType as PrismaInvoiceType,
  Payment as PrismaPayment,
  Prisma,
  Refund as PrismaRefund,
} from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { computeInvoiceTotals, computeLineItemAmounts, LineItemInput } from './billing-calculations'
import { generateInvoicePdf } from './billing-invoice-pdf'

type InvoiceWithRelations = PrismaInvoice & {
  patient: { id: string; firstName: string; lastName: string; uhid: string }
  items: PrismaInvoiceItem[]
  payments: PrismaPayment[]
  refunds: PrismaRefund[]
}

const INVOICE_WITH_RELATIONS_INCLUDE = {
  patient: { select: { id: true, firstName: true, lastName: true, uhid: true } },
  items: { orderBy: { createdAt: 'asc' } },
  payments: { orderBy: { paidAt: 'asc' } },
  refunds: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.InvoiceInclude

/**
 * Invoicing - see ADR-0015. `billing.*` stays all-scope (staff-facing), so
 * no own-scope check is needed. Created DRAFT, either from manual line
 * items and/or by sweeping the patient's existing `PENDING` charges (see
 * `ChargesService`) - at least one of the two is required.
 */
@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(organizationId: string, query: InvoiceQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20

    const where: Prisma.InvoiceWhereInput = { organizationId }
    if (query.patientId) where.patientId = query.patientId
    if (query.status) where.status = query.status as unknown as PrismaInvoiceStatus
    if (query.type) where.type = query.type as unknown as PrismaInvoiceType
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      }
    }

    const sortBy = query.sortBy ?? 'createdAt'
    const sortOrder = query.sortOrder ?? 'desc'

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: INVOICE_WITH_RELATIONS_INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ])

    return {
      data: data.map((i) => this.toResponse(i as InvoiceWithRelations)),
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

  async getById(organizationId: string, id: string): Promise<InvoiceWithDetails> {
    return this.toResponse(await this.requireInvoiceWithRelations(organizationId, id))
  }

  async create(organizationId: string, dto: CreateInvoiceDto, actorUserId?: string): Promise<InvoiceWithDetails> {
    const patient = await this.prisma.patient.findFirst({ where: { id: dto.patientId, organizationId } })
    if (!patient) throw new NotFoundException('Patient not found')

    const adHocInputs: LineItemInput[] = dto.items.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent,
      taxPercent: item.taxPercent,
    }))

    let charges: Array<{
      id: string
      description: string
      sourceModule: string
      quantity: number
      unitPrice: Prisma.Decimal
      discountPercent: Prisma.Decimal
      taxPercent: Prisma.Decimal
    }> = []
    if (dto.chargeIds.length > 0) {
      charges = await this.prisma.charge.findMany({
        where: { id: { in: dto.chargeIds }, organizationId, patientId: dto.patientId, status: 'PENDING' },
      })
      if (charges.length !== dto.chargeIds.length) {
        throw new BadRequestException(
          'One or more charges are invalid, already invoiced, voided, or belong to a different patient',
        )
      }
    }

    const chargeInputs: LineItemInput[] = charges.map((c) => ({
      quantity: c.quantity,
      unitPrice: Number(c.unitPrice),
      discountPercent: Number(c.discountPercent),
      taxPercent: Number(c.taxPercent),
    }))

    const totals = computeInvoiceTotals([...adHocInputs, ...chargeInputs])

    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })
    const settings = (org.settings ?? {}) as Record<string, unknown>
    const prefix = typeof settings.uhidPrefix === 'string' ? settings.uhidPrefix : 'MED'
    const currency = typeof settings.currency === 'string' ? settings.currency : 'INR'

    const invoice = await this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await this.generateInvoiceNumber(tx, organizationId, prefix)

      const itemsToCreate = [
        ...dto.items.map((item) => {
          const amounts = computeLineItemAmounts(item)
          return {
            itemName: item.itemName,
            itemCode: item.itemCode,
            category: item.category,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountPercent: item.discountPercent,
            taxPercent: item.taxPercent,
            totalPrice: amounts.totalAmount,
          }
        }),
        ...charges.map((c) => ({
          itemName: c.description,
          itemCode: null,
          category: c.sourceModule,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
          discountPercent: c.discountPercent,
          taxPercent: c.taxPercent,
          totalPrice: computeLineItemAmounts({
            quantity: c.quantity,
            unitPrice: Number(c.unitPrice),
            discountPercent: Number(c.discountPercent),
            taxPercent: Number(c.taxPercent),
          }).totalAmount,
        })),
      ]

      const created = await tx.invoice.create({
        data: {
          invoiceNumber,
          patientId: dto.patientId,
          encounterId: dto.encounterId,
          appointmentId: dto.appointmentId,
          organizationId,
          type: dto.type,
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
          paidAmount: 0,
          balanceDue: totals.totalAmount,
          currency,
          notes: dto.notes,
          dueDate: dto.dueDate,
          createdByUserId: actorUserId,
          items: { create: itemsToCreate },
        },
      })

      if (charges.length > 0) {
        await tx.charge.updateMany({
          where: { id: { in: charges.map((c) => c.id) } },
          data: { status: 'INVOICED', invoiceId: created.id },
        })
      }

      return created
    })

    this.eventEmitter.emit('invoice.created', {
      invoiceId: invoice.id,
      patientId: invoice.patientId,
      organizationId,
      userId: actorUserId,
    })

    return this.getById(organizationId, invoice.id)
  }

  /** "Manual line-item addition" - only while the invoice is still DRAFT. */
  async addItem(
    organizationId: string,
    id: string,
    item: { itemName: string; itemCode?: string; category: string; quantity: number; unitPrice: number; discountPercent: number; taxPercent: number },
    actorUserId?: string,
  ): Promise<InvoiceWithDetails> {
    const invoice = await this.requireInvoiceWithRelations(organizationId, id)
    if ((invoice.status as unknown as InvoiceStatus) !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Line items can only be added while the invoice is a draft')
    }

    const amounts = computeLineItemAmounts(item)
    await this.prisma.$transaction(async (tx) => {
      await tx.invoiceItem.create({
        data: {
          invoiceId: id,
          itemName: item.itemName,
          itemCode: item.itemCode,
          category: item.category,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
          taxPercent: item.taxPercent,
          totalPrice: amounts.totalAmount,
        },
      })
      await this.recomputeTotals(tx, invoice)
    })

    this.eventEmitter.emit('invoice.item_added', { invoiceId: id, patientId: invoice.patientId, organizationId, userId: actorUserId })
    return this.getById(organizationId, id)
  }

  /**
   * Discount request - see ADR-0015. `canManage` (caller holds
   * `billing.manage`) auto-approves and applies the discount immediately;
   * otherwise the request lands `PENDING` for a manage-scope holder to
   * approve/reject, and totals are left untouched until then.
   */
  async applyDiscount(
    organizationId: string,
    id: string,
    dto: ApplyDiscountDto,
    actorUserId: string,
    canManage: boolean,
  ): Promise<InvoiceWithDetails> {
    const invoice = await this.requireInvoiceWithRelations(organizationId, id)
    this.assertDiscountEligible(invoice)

    if (canManage) {
      const totals = computeInvoiceTotals(this.toLineItemInputs(invoice.items), {
        type: dto.discountType,
        value: dto.discountValue,
      })
      await this.prisma.invoice.update({
        where: { id },
        data: {
          discountType: dto.discountType,
          discountValue: dto.discountValue,
          discountReason: dto.reason,
          discountApprovalStatus: PrismaDiscountApprovalStatus.APPROVED,
          discountRequestedByUserId: actorUserId,
          discountApprovedByUserId: actorUserId,
          discountApprovedAt: new Date(),
          discountAmount: totals.discountAmount,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
          balanceDue: totals.totalAmount - Number(invoice.paidAmount),
        },
      })
      this.eventEmitter.emit('invoice.discount_approved', {
        invoiceId: id,
        patientId: invoice.patientId,
        organizationId,
        userId: actorUserId,
      })
    } else {
      await this.prisma.invoice.update({
        where: { id },
        data: {
          discountType: dto.discountType,
          discountValue: dto.discountValue,
          discountReason: dto.reason,
          discountApprovalStatus: PrismaDiscountApprovalStatus.PENDING,
          discountRequestedByUserId: actorUserId,
          discountApprovedByUserId: null,
          discountApprovedAt: null,
        },
      })
      this.eventEmitter.emit('invoice.discount_requested', {
        invoiceId: id,
        patientId: invoice.patientId,
        organizationId,
        userId: actorUserId,
      })
    }

    return this.getById(organizationId, id)
  }

  async approveDiscount(organizationId: string, id: string, actorUserId: string): Promise<InvoiceWithDetails> {
    const invoice = await this.requireInvoiceWithRelations(organizationId, id)
    if ((invoice.discountApprovalStatus as unknown as DiscountApprovalStatus) !== DiscountApprovalStatus.PENDING) {
      throw new BadRequestException('No pending discount request on this invoice')
    }
    if (Number(invoice.paidAmount) > 0) {
      throw new ConflictException('A payment was recorded since this discount was requested - reject it instead')
    }

    const totals = computeInvoiceTotals(this.toLineItemInputs(invoice.items), {
      type: invoice.discountType as unknown as 'FLAT' | 'PERCENTAGE',
      value: Number(invoice.discountValue),
    })

    await this.prisma.invoice.update({
      where: { id },
      data: {
        discountApprovalStatus: PrismaDiscountApprovalStatus.APPROVED,
        discountApprovedByUserId: actorUserId,
        discountApprovedAt: new Date(),
        discountAmount: totals.discountAmount,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        balanceDue: totals.totalAmount,
      },
    })

    this.eventEmitter.emit('invoice.discount_approved', {
      invoiceId: id,
      patientId: invoice.patientId,
      organizationId,
      userId: actorUserId,
    })
    return this.getById(organizationId, id)
  }

  async rejectDiscount(
    organizationId: string,
    id: string,
    dto: RejectDiscountDto,
    actorUserId: string,
  ): Promise<InvoiceWithDetails> {
    const invoice = await this.requireInvoiceWithRelations(organizationId, id)
    if ((invoice.discountApprovalStatus as unknown as DiscountApprovalStatus) !== DiscountApprovalStatus.PENDING) {
      throw new BadRequestException('No pending discount request on this invoice')
    }

    await this.prisma.invoice.update({
      where: { id },
      data: { discountApprovalStatus: PrismaDiscountApprovalStatus.REJECTED },
    })

    this.eventEmitter.emit('invoice.discount_rejected', {
      invoiceId: id,
      patientId: invoice.patientId,
      organizationId,
      userId: actorUserId,
      reason: dto.reason,
    })
    return this.getById(organizationId, id)
  }

  /** DRAFT -> ISSUED. Requires no pending discount approval and at least one line item. */
  async finalize(organizationId: string, id: string, actorUserId?: string): Promise<InvoiceWithDetails> {
    const invoice = await this.requireInvoiceWithRelations(organizationId, id)
    if ((invoice.status as unknown as InvoiceStatus) !== InvoiceStatus.DRAFT) {
      throw new BadRequestException(`Cannot finalize an invoice that is ${invoice.status}`)
    }
    if (invoice.items.length === 0) {
      throw new BadRequestException('Cannot finalize an invoice with no line items')
    }
    if ((invoice.discountApprovalStatus as unknown as DiscountApprovalStatus) === DiscountApprovalStatus.PENDING) {
      throw new BadRequestException('Resolve the pending discount request before finalizing')
    }

    await this.prisma.invoice.update({
      where: { id },
      data: { status: PrismaInvoiceStatus.ISSUED, finalizedAt: new Date() },
    })

    this.eventEmitter.emit('invoice.status_changed', {
      invoiceId: id,
      patientId: invoice.patientId,
      organizationId,
      userId: actorUserId,
      fromStatus: InvoiceStatus.DRAFT,
      toStatus: InvoiceStatus.ISSUED,
    })
    return this.getById(organizationId, id)
  }

  /** Cancels a not-yet-paid invoice and releases any swept charges back to `PENDING` for re-billing. */
  async cancel(organizationId: string, id: string, dto: CancelInvoiceDto, actorUserId?: string): Promise<InvoiceWithDetails> {
    const invoice = await this.requireInvoiceWithRelations(organizationId, id)
    const currentStatus = invoice.status as unknown as InvoiceStatus
    if (currentStatus !== InvoiceStatus.DRAFT && currentStatus !== InvoiceStatus.ISSUED) {
      throw new BadRequestException(`Cannot cancel an invoice that is ${currentStatus}`)
    }
    if (Number(invoice.paidAmount) > 0) {
      throw new BadRequestException('Cannot cancel an invoice that has payments recorded - refund it instead')
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.charge.updateMany({
        where: { invoiceId: id, status: 'INVOICED' },
        data: { status: 'PENDING', invoiceId: null },
      })
      await tx.invoice.update({
        where: { id },
        data: { status: PrismaInvoiceStatus.CANCELLED, cancelledAt: new Date(), cancelReason: dto.reason },
      })
    })

    this.eventEmitter.emit('invoice.status_changed', {
      invoiceId: id,
      patientId: invoice.patientId,
      organizationId,
      userId: actorUserId,
      fromStatus: currentStatus,
      toStatus: InvoiceStatus.CANCELLED,
      reason: dto.reason,
    })
    return this.getById(organizationId, id)
  }

  async generatePdf(organizationId: string, id: string): Promise<{ buffer: Buffer; fileName: string }> {
    const invoice = await this.requireInvoiceWithRelations(organizationId, id)
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })

    const buffer = await generateInvoicePdf({
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      createdAt: invoice.createdAt,
      dueDate: invoice.dueDate,
      organization: { name: org.name, address: org.address, phone: org.phone, email: org.email, taxId: org.taxId },
      patient: { fullName: `${invoice.patient.firstName} ${invoice.patient.lastName}`, uhid: invoice.patient.uhid },
      items: invoice.items.map((item) => ({
        itemName: item.itemName,
        category: item.category,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
        discountPercent: item.discountPercent.toString(),
        taxPercent: item.taxPercent.toString(),
        totalPrice: item.totalPrice.toString(),
      })),
      subtotal: invoice.subtotal.toString(),
      discountAmount: invoice.discountAmount.toString(),
      taxAmount: invoice.taxAmount.toString(),
      totalAmount: invoice.totalAmount.toString(),
      paidAmount: invoice.paidAmount.toString(),
      balanceDue: invoice.balanceDue.toString(),
      currency: invoice.currency,
      notes: invoice.notes,
    })

    return { buffer, fileName: `${invoice.invoiceNumber}.pdf` }
  }

  // ─── Shared helpers ───────────────────────────────────────────────────────

  async requireInvoice(organizationId: string, id: string): Promise<PrismaInvoice> {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, organizationId } })
    if (!invoice) throw new NotFoundException('Invoice not found')
    return invoice
  }

  async requireInvoiceWithRelations(organizationId: string, id: string): Promise<InvoiceWithRelations> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, organizationId },
      include: INVOICE_WITH_RELATIONS_INCLUDE,
    })
    if (!invoice) throw new NotFoundException('Invoice not found')
    return invoice as InvoiceWithRelations
  }

  private assertDiscountEligible(invoice: InvoiceWithRelations): void {
    const status = invoice.status as unknown as InvoiceStatus
    if (status !== InvoiceStatus.DRAFT && status !== InvoiceStatus.ISSUED) {
      throw new BadRequestException(`Cannot apply a discount to an invoice that is ${status}`)
    }
    if (Number(invoice.paidAmount) > 0) {
      throw new BadRequestException('Cannot apply a discount after payments have been recorded')
    }
    if ((invoice.discountApprovalStatus as unknown as DiscountApprovalStatus) === DiscountApprovalStatus.PENDING) {
      throw new ConflictException('A discount request is already pending approval')
    }
  }

  private toLineItemInputs(items: PrismaInvoiceItem[]): LineItemInput[] {
    return items.map((item) => ({
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      discountPercent: Number(item.discountPercent),
      taxPercent: Number(item.taxPercent),
    }))
  }

  private async recomputeTotals(tx: Prisma.TransactionClient, invoice: InvoiceWithRelations): Promise<void> {
    const items = await tx.invoiceItem.findMany({ where: { invoiceId: invoice.id } })
    const invoiceLevelDiscount =
      (invoice.discountApprovalStatus as unknown as DiscountApprovalStatus) === DiscountApprovalStatus.APPROVED &&
      invoice.discountType
        ? { type: invoice.discountType as unknown as 'FLAT' | 'PERCENTAGE', value: Number(invoice.discountValue) }
        : null
    const totals = computeInvoiceTotals(this.toLineItemInputs(items), invoiceLevelDiscount)
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        balanceDue: totals.totalAmount - Number(invoice.paidAmount),
      },
    })
  }

  private async generateInvoiceNumber(
    tx: Prisma.TransactionClient,
    organizationId: string,
    prefix: string,
  ): Promise<string> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId} || ':invoice')::bigint)`

    const year = new Date().getFullYear()
    const yearStart = new Date(Date.UTC(year, 0, 1))
    const count = await tx.invoice.count({ where: { organizationId, createdAt: { gte: yearStart } } })

    return `INV-${prefix}-${year}-${String(count + 1).padStart(6, '0')}`
  }

  private toResponse(invoice: InvoiceWithRelations): InvoiceWithDetails {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      patientId: invoice.patientId,
      appointmentId: invoice.appointmentId,
      encounterId: invoice.encounterId,
      organizationId: invoice.organizationId,
      status: invoice.status as unknown as InvoiceStatus,
      type: invoice.type as unknown as Invoice['type'],
      subtotal: invoice.subtotal.toString(),
      discountAmount: invoice.discountAmount.toString(),
      taxAmount: invoice.taxAmount.toString(),
      totalAmount: invoice.totalAmount.toString(),
      paidAmount: invoice.paidAmount.toString(),
      balanceDue: invoice.balanceDue.toString(),
      currency: invoice.currency,
      notes: invoice.notes,
      dueDate: invoice.dueDate,
      createdByUserId: invoice.createdByUserId,
      discountType: invoice.discountType as unknown as Invoice['discountType'],
      discountValue: invoice.discountValue?.toString() ?? null,
      discountReason: invoice.discountReason,
      discountApprovalStatus: invoice.discountApprovalStatus as unknown as DiscountApprovalStatus,
      discountRequestedByUserId: invoice.discountRequestedByUserId,
      discountApprovedByUserId: invoice.discountApprovedByUserId,
      discountApprovedAt: invoice.discountApprovedAt,
      finalizedAt: invoice.finalizedAt,
      cancelledAt: invoice.cancelledAt,
      cancelReason: invoice.cancelReason,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
      patient: {
        id: invoice.patient.id,
        fullName: `${invoice.patient.firstName} ${invoice.patient.lastName}`,
        uhid: invoice.patient.uhid,
      },
      items: invoice.items.map((item) => this.toItemResponse(item)),
      payments: invoice.payments.map((p): Payment => ({
        id: p.id,
        paymentNumber: p.paymentNumber,
        invoiceId: p.invoiceId,
        patientId: p.patientId,
        organizationId: p.organizationId,
        amount: p.amount.toString(),
        paymentMode: p.paymentMode as unknown as PaymentMode,
        transactionId: p.transactionId,
        referenceNumber: p.referenceNumber,
        status: p.status as unknown as PaymentStatus,
        collectedBy: p.collectedBy,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
      })),
      refunds: invoice.refunds.map((r): Refund => ({
        id: r.id,
        refundNumber: r.refundNumber,
        organizationId: r.organizationId,
        invoiceId: r.invoiceId,
        paymentId: r.paymentId,
        amount: r.amount.toString(),
        reason: r.reason,
        refundMode: r.refundMode as unknown as PaymentMode | null,
        status: r.status as unknown as RefundStatus,
        requestedByUserId: r.requestedByUserId,
        approvedByUserId: r.approvedByUserId,
        approvedAt: r.approvedAt,
        rejectionReason: r.rejectionReason,
        refundedAt: r.refundedAt,
        createdAt: r.createdAt,
      })),
    }
  }

  private toItemResponse(item: PrismaInvoiceItem): InvoiceItem {
    return {
      id: item.id,
      invoiceId: item.invoiceId,
      itemName: item.itemName,
      itemCode: item.itemCode,
      category: item.category,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toString(),
      discountPercent: item.discountPercent.toString(),
      taxPercent: item.taxPercent.toString(),
      totalPrice: item.totalPrice.toString(),
      createdAt: item.createdAt,
    }
  }
}
