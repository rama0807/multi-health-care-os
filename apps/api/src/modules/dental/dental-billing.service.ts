/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/require-await */
import { Injectable } from '@nestjs/common'
import { InvoiceStatus, PaymentMode } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { CreateDentalInvoiceDto, CreateDentalPaymentDto } from './dto'

@Injectable()
export class DentalBillingService {
  constructor(private readonly prisma: PrismaService) { }

  // ─── Invoices ─────────────────────────────────────────────────────────

  async createInvoice(orgId: string, userId: string, data: CreateDentalInvoiceDto) {
    let subtotal = 0
    let totalDiscountAmount = 0
    let totalTaxAmount = 0

    // First pass: calculate item totals
    const processedItems = data.items.map(item => {
      const itemSubtotal = item.quantity * item.unitPrice
      const itemDiscount = item.discountAmount || 0
      const itemTaxableAmount = Math.max(0, itemSubtotal - itemDiscount)
      const itemTaxAmount = itemTaxableAmount * (item.taxPercentage / 100)
      const itemNetAmount = itemTaxableAmount + itemTaxAmount

      subtotal += itemSubtotal
      totalDiscountAmount += itemDiscount
      totalTaxAmount += itemTaxAmount

      return {
        ...item,
        netAmount: itemNetAmount,
      }
    })

    // Invoice level discount
    if (data.discountType === 'FLAT' && data.discountValue) {
      totalDiscountAmount += data.discountValue
    } else if (data.discountType === 'PERCENTAGE' && data.discountValue) {
      const percentageDiscount = subtotal * (data.discountValue / 100)
      totalDiscountAmount += percentageDiscount
    }

    const totalAmount = Math.max(0, subtotal - totalDiscountAmount + totalTaxAmount)

    return this.prisma.dentalInvoice.create({
      data: {
        organizationId: orgId,
        createdByUserId: userId,
        invoiceNumber: `DINV-${Date.now()}`,
        patientId: data.patientId,
        dentalPatientProfileId: data.dentalPatientProfileId,
        subtotal: subtotal,
        discountAmount: totalDiscountAmount,
        taxAmount: totalTaxAmount,
        totalAmount: totalAmount,
        balanceDue: totalAmount,
        status: InvoiceStatus.DRAFT,
        discountType: data.discountType,
        discountValue: data.discountValue,
        discountReason: data.discountReason,
        notes: data.notes,
        dueDate: data.dueDate,
        items: {
          create: processedItems.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxPercentage: item.taxPercentage,
            discountAmount: item.discountAmount,
            netAmount: item.netAmount,
            ...(item.chargeId && { chargeId: item.chargeId })
          }))
        }
      },
      include: { items: true }
    })
  }

  async getInvoices(orgId: string, patientId?: string) {
    return this.prisma.dentalInvoice.findMany({
      where: {
        organizationId: orgId,
        ...(patientId && { patientId }),
      },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    })
  }

  async getInvoice(orgId: string, invoiceId: string) {
    return this.prisma.dentalInvoice.findFirstOrThrow({
      where: { organizationId: orgId, id: invoiceId },
      include: { items: true }
    })
  }

  // ─── Payments ─────────────────────────────────────────────────────────

  async recordPayment(orgId: string, userId: string, invoiceId: string, data: CreateDentalPaymentDto) {
    // We run this in a transaction to update both the payment and the invoice balance
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.dentalInvoice.findFirstOrThrow({
        where: { id: invoiceId, organizationId: orgId }
      })

      const payment = await tx.dentalPayment.create({
        data: {
          organizationId: orgId,
          invoiceId,
          patientId: data.patientId,
          amount: data.amount,
          paymentMode: data.paymentMode as PaymentMode,
          collectedByUserId: userId,
          receiptNumber: `DREC-${Date.now()}`,
          transactionId: data.transactionId,
          paymentDate: data.paymentDate || new Date(),
          notes: data.notes,
          status: 'COMPLETED'
        },
      })

      const newPaidAmount = Number(invoice.paidAmount) + Number(data.amount)
      const newBalanceDue = Math.max(0, Number(invoice.totalAmount) - newPaidAmount)

      let newStatus = invoice.status
      if (newBalanceDue <= 0) {
        newStatus = 'PAID'
      } else if (newPaidAmount > 0) {
        newStatus = 'PARTIALLY_PAID'
      }

      await tx.dentalInvoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: newPaidAmount,
          balanceDue: newBalanceDue,
          status: newStatus
        }
      })

      return payment
    })
  }
}
