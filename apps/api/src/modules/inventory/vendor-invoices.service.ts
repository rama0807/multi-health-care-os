import {
  CreateVendorInvoiceDto,
  RecordVendorInvoicePaymentDto,
  UpdateVendorInvoiceStatusDto,
  VendorInvoice,
  VendorInvoiceQuery,
} from '@medicore/types'
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Prisma, VendorInvoiceStatus } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { VendorsService } from './vendors.service'

const INVOICE_INCLUDE = { vendor: { select: { id: true, name: true, code: true } } } satisfies Prisma.VendorInvoiceInclude

@Injectable()
export class VendorInvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vendorsService: VendorsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(organizationId: string, query: VendorInvoiceQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20
    const where: Prisma.VendorInvoiceWhereInput = { organizationId }
    if (query.vendorId) where.vendorId = query.vendorId
    if (query.status) where.status = query.status

    const [data, total] = await Promise.all([
      this.prisma.vendorInvoice.findMany({
        where,
        include: INVOICE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.vendorInvoice.count({ where }),
    ])
    return {
      data: data.map((inv) => this.toResponse(inv)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrev: page > 1 },
    }
  }

  async getById(organizationId: string, id: string): Promise<VendorInvoice> {
    return this.toResponse(await this.requireInvoice(organizationId, id))
  }

  async create(organizationId: string, userId: string, dto: CreateVendorInvoiceDto): Promise<VendorInvoice> {
    await this.vendorsService.requireVendor(organizationId, dto.vendorId)
    const totalAmount = dto.amount + dto.taxAmount
    const invoice = await this.prisma.vendorInvoice
      .create({
        data: { organizationId, ...dto, totalAmount },
        include: INVOICE_INCLUDE,
      })
      .catch((e) => this.rethrowUniqueCode(e))
    this.eventEmitter.emit('vendor_invoice.created', { organizationId, userId, vendorInvoiceId: invoice.id })
    return this.toResponse(invoice)
  }

  async recordPayment(organizationId: string, userId: string, id: string, dto: RecordVendorInvoicePaymentDto): Promise<VendorInvoice> {
    const invoice = await this.requireInvoice(organizationId, id)
    if (invoice.status === VendorInvoiceStatus.CANCELLED) throw new ConflictException('Cannot pay a cancelled invoice')
    const newPaid = Number(invoice.paidAmount) + dto.amount
    if (newPaid > Number(invoice.totalAmount)) {
      throw new BadRequestException(`Payment would exceed the invoice total (balance due: ${Number(invoice.totalAmount) - Number(invoice.paidAmount)})`)
    }
    const updated = await this.prisma.vendorInvoice.update({
      where: { id },
      data: {
        paidAmount: newPaid,
        status: newPaid >= Number(invoice.totalAmount) ? VendorInvoiceStatus.PAID : invoice.status,
      },
      include: INVOICE_INCLUDE,
    })
    this.eventEmitter.emit('vendor_invoice.status_changed', {
      organizationId,
      userId,
      vendorInvoiceId: id,
      fromStatus: invoice.status,
      toStatus: updated.status,
    })
    return this.toResponse(updated)
  }

  async updateStatus(organizationId: string, userId: string, id: string, dto: UpdateVendorInvoiceStatusDto): Promise<VendorInvoice> {
    const invoice = await this.requireInvoice(organizationId, id)
    if (invoice.status === VendorInvoiceStatus.PAID || invoice.status === VendorInvoiceStatus.CANCELLED) {
      throw new ConflictException(`Cannot change status of a ${invoice.status} invoice`)
    }
    const updated = await this.prisma.vendorInvoice.update({ where: { id }, data: { status: dto.status }, include: INVOICE_INCLUDE })
    this.eventEmitter.emit('vendor_invoice.status_changed', {
      organizationId,
      userId,
      vendorInvoiceId: id,
      fromStatus: invoice.status,
      toStatus: updated.status,
    })
    return this.toResponse(updated)
  }

  private async requireInvoice(organizationId: string, id: string) {
    const invoice = await this.prisma.vendorInvoice.findFirst({ where: { id, organizationId }, include: INVOICE_INCLUDE })
    if (!invoice) throw new NotFoundException('Vendor invoice not found')
    return invoice
  }

  private rethrowUniqueCode(error: unknown): never {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      throw new ConflictException('An invoice with that number already exists for this vendor')
    }
    throw error
  }

  private toResponse(invoice: Prisma.VendorInvoiceGetPayload<{ include: typeof INVOICE_INCLUDE }>): VendorInvoice {
    return {
      id: invoice.id,
      organizationId: invoice.organizationId,
      invoiceNumber: invoice.invoiceNumber,
      vendorId: invoice.vendorId,
      purchaseOrderId: invoice.purchaseOrderId,
      goodsReceiptNoteId: invoice.goodsReceiptNoteId,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      amount: invoice.amount.toString(),
      taxAmount: invoice.taxAmount.toString(),
      totalAmount: invoice.totalAmount.toString(),
      paidAmount: invoice.paidAmount.toString(),
      status: invoice.status as unknown as VendorInvoice['status'],
      notes: invoice.notes,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
      vendor: invoice.vendor,
    }
  }
}
