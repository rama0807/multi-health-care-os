import { CreatePaymentDto, InvoiceStatus, Payment, PaymentMode, PaymentQuery, PaymentStatus } from '@medicore/types'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { InvoiceStatus as PrismaInvoiceStatus, Payment as PrismaPayment, Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { generateReceiptPdf } from './billing-receipt-pdf'

type PaymentWithInvoice = PrismaPayment & {
  invoice: { invoiceNumber: string; patientId: string; organizationId: string; currency: string }
}

const PAYMENT_WITH_INVOICE_INCLUDE = {
  invoice: { select: { invoiceNumber: true, patientId: true, organizationId: true, currency: true } },
} satisfies Prisma.PaymentInclude

/**
 * Payment collection — see ADR-0015. Cash/card/UPI/bank transfer (NEFT/
 * RTGS)/cheque all share one `PaymentMode` enum and one endpoint; calling
 * it more than once against the same invoice (different modes and/or
 * partial amounts) is how both split and partial payments work — there is
 * deliberately no separate "split payment" endpoint.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(organizationId: string, query: PaymentQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20

    const where: Prisma.PaymentWhereInput = { organizationId }
    if (query.invoiceId) where.invoiceId = query.invoiceId
    if (query.patientId) where.patientId = query.patientId
    if (query.paymentMode) where.paymentMode = query.paymentMode as unknown as Prisma.PaymentWhereInput['paymentMode']
    if (query.dateFrom || query.dateTo) {
      where.paidAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: PAYMENT_WITH_INVOICE_INCLUDE,
        orderBy: { paidAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ])

    return {
      data: data.map((p) => this.toResponse(p as PaymentWithInvoice)),
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

  async getById(organizationId: string, id: string): Promise<Payment> {
    return this.toResponse(await this.requirePaymentWithInvoice(organizationId, id))
  }

  /** Records one payment against an invoice — see this class's doc comment for split/partial semantics. */
  async create(organizationId: string, invoiceId: string, dto: CreatePaymentDto, actorUserId?: string): Promise<Payment> {
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, organizationId } })
    if (!invoice) throw new NotFoundException('Invoice not found')

    const status = invoice.status as unknown as InvoiceStatus
    if (status !== InvoiceStatus.ISSUED && status !== InvoiceStatus.PARTIALLY_PAID) {
      throw new BadRequestException(`Cannot record a payment against an invoice that is ${status}`)
    }

    const balanceDue = Number(invoice.balanceDue)
    if (dto.amount > balanceDue) {
      throw new BadRequestException(`Payment of ${dto.amount} exceeds the outstanding balance of ${balanceDue}`)
    }

    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })
    const settings = (org.settings ?? {}) as Record<string, unknown>
    const prefix = typeof settings.uhidPrefix === 'string' ? settings.uhidPrefix : 'MED'

    const newPaidAmount = Number(invoice.paidAmount) + dto.amount
    const newBalanceDue = Number(invoice.totalAmount) - newPaidAmount
    const newStatus = newBalanceDue <= 0 ? PrismaInvoiceStatus.PAID : PrismaInvoiceStatus.PARTIALLY_PAID

    const payment = await this.prisma.$transaction(async (tx) => {
      const paymentNumber = await this.generatePaymentNumber(tx, organizationId, prefix)
      const created = await tx.payment.create({
        data: {
          paymentNumber,
          invoiceId,
          patientId: invoice.patientId,
          organizationId,
          amount: dto.amount,
          paymentMode: dto.paymentMode,
          transactionId: dto.transactionId,
          referenceNumber: dto.referenceNumber,
          collectedBy: actorUserId,
        },
      })
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { paidAmount: newPaidAmount, balanceDue: Math.max(newBalanceDue, 0), status: newStatus },
      })
      return created
    })

    this.eventEmitter.emit('payment.recorded', {
      paymentId: payment.id,
      invoiceId,
      patientId: invoice.patientId,
      organizationId,
      userId: actorUserId,
      amount: dto.amount,
      paymentMode: dto.paymentMode,
    })

    return this.getById(organizationId, payment.id)
  }

  async generateReceiptPdf(organizationId: string, id: string): Promise<{ buffer: Buffer; fileName: string }> {
    const payment = await this.requirePaymentWithInvoice(organizationId, id)
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })
    const patient = await this.prisma.patient.findUniqueOrThrow({ where: { id: payment.patientId } })

    const buffer = await generateReceiptPdf({
      paymentNumber: payment.paymentNumber,
      invoiceNumber: payment.invoice.invoiceNumber,
      paidAt: payment.paidAt,
      amount: payment.amount.toString(),
      paymentMode: payment.paymentMode,
      transactionId: payment.transactionId,
      referenceNumber: payment.referenceNumber,
      collectedBy: payment.collectedBy,
      currency: payment.invoice.currency,
      organization: { name: org.name, address: org.address, phone: org.phone, email: org.email, taxId: org.taxId },
      patient: { fullName: `${patient.firstName} ${patient.lastName}`, uhid: patient.uhid },
    })

    return { buffer, fileName: `${payment.paymentNumber}.pdf` }
  }

  private async requirePaymentWithInvoice(organizationId: string, id: string): Promise<PaymentWithInvoice> {
    const payment = await this.prisma.payment.findFirst({
      where: { id, organizationId },
      include: PAYMENT_WITH_INVOICE_INCLUDE,
    })
    if (!payment) throw new NotFoundException('Payment not found')
    return payment as PaymentWithInvoice
  }

  private async generatePaymentNumber(
    tx: Prisma.TransactionClient,
    organizationId: string,
    prefix: string,
  ): Promise<string> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId} || ':payment')::bigint)`

    const year = new Date().getFullYear()
    const yearStart = new Date(Date.UTC(year, 0, 1))
    const count = await tx.payment.count({ where: { organizationId, createdAt: { gte: yearStart } } })

    return `PMT-${prefix}-${year}-${String(count + 1).padStart(6, '0')}`
  }

  private toResponse(payment: PaymentWithInvoice): Payment {
    return {
      id: payment.id,
      paymentNumber: payment.paymentNumber,
      invoiceId: payment.invoiceId,
      patientId: payment.patientId,
      organizationId: payment.organizationId,
      amount: payment.amount.toString(),
      paymentMode: payment.paymentMode as unknown as PaymentMode,
      transactionId: payment.transactionId,
      referenceNumber: payment.referenceNumber,
      status: payment.status as unknown as PaymentStatus,
      collectedBy: payment.collectedBy,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
    }
  }
}
