import { ChargeSourceModule, InvoiceType } from '@medicore/types'
import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

import { PrismaService } from '../../prisma/prisma.service'

import { ChargesService } from './charges.service'
import { InvoicesService } from './invoices.service'

interface AppointmentStatusChangedPayload {
  appointmentId: string
  doctorId: string
  patientId: string
  organizationId: string
  userId?: string
  fromStatus?: string
  toStatus?: string
}

/**
 * "Auto-invoice generation from appointment" — see ADR-0015. Listens on the
 * same `appointment.status_changed` event `audit.listener.ts` already
 * listens to (multiple listeners on one event is the existing pattern, not
 * new — mirrors how both `AuditListener` and this class independently react
 * to `dispense_order.status_changed`-style events elsewhere). Failures are
 * logged and swallowed rather than thrown — an invoicing hiccup must never
 * block the appointment status transition that triggered it.
 */
@Injectable()
export class AppointmentInvoiceListener {
  private readonly logger = new Logger(AppointmentInvoiceListener.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly chargesService: ChargesService,
    private readonly invoicesService: InvoicesService,
  ) {}

  @OnEvent('appointment.status_changed')
  async onAppointmentStatusChanged(payload: AppointmentStatusChangedPayload): Promise<void> {
    if (payload.toStatus !== 'COMPLETED') return

    try {
      const existingInvoice = await this.prisma.invoice.findUnique({
        where: { appointmentId: payload.appointmentId },
      })
      if (existingInvoice) return

      const [appointment, doctor, encounter] = await Promise.all([
        this.prisma.appointment.findUnique({ where: { id: payload.appointmentId } }),
        this.prisma.doctor.findUnique({
          where: { id: payload.doctorId },
          include: { user: { select: { firstName: true, lastName: true } } },
        }),
        this.prisma.encounter.findUnique({ where: { appointmentId: payload.appointmentId } }),
      ])
      if (!appointment || !doctor) return

      const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: payload.organizationId } })
      const settings = (org.settings ?? {}) as Record<string, unknown>
      const gstRate = typeof settings.gstRate === 'number' ? settings.gstRate : 0

      const charge = await this.chargesService.create(
        payload.organizationId,
        {
          patientId: payload.patientId,
          appointmentId: payload.appointmentId,
          encounterId: encounter?.id,
          sourceModule: ChargeSourceModule.CONSULTATION,
          quantity: 1,
          discountPercent: 0,
          description: `Consultation — Dr. ${doctor.user.firstName} ${doctor.user.lastName}`,
          unitPrice: Number(doctor.consultationFee),
          taxPercent: gstRate,
        },
        payload.userId,
      )

      const invoiceType =
        appointment.type === 'IPD' ? InvoiceType.IPD : appointment.type === 'PROCEDURE' ? InvoiceType.PROCEDURE : InvoiceType.OPD

      await this.invoicesService.create(
        payload.organizationId,
        {
          patientId: payload.patientId,
          appointmentId: payload.appointmentId,
          encounterId: encounter?.id,
          type: invoiceType,
          items: [],
          chargeIds: [charge.id],
        },
        payload.userId,
      )
    } catch (err) {
      this.logger.warn(
        `Failed to auto-generate an invoice for appointment ${payload.appointmentId}: ${(err as Error).message}`,
      )
    }
  }
}
