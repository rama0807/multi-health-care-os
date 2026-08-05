import { NotificationPriority, NotificationType } from '@medicore/types'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { OnEvent } from '@nestjs/event-emitter'

import { PrismaService } from '../../prisma/prisma.service'

import { NotificationsService } from './notifications.service'

/** Payload shapes as the emitting modules already publish them. */
interface BaseEvent {
  organizationId: string
  userId?: string
}
interface AppointmentEvent extends BaseEvent {
  appointmentId: string
  doctorId: string
  patientId: string
  toStatus?: string
  fromStatus?: string
}
interface EncounterEvent extends BaseEvent {
  encounterId: string
  patientId?: string
  doctorId?: string
  toStatus?: string
}
interface LabTestEvent extends BaseEvent {
  labTestId: string
  patientId?: string
  doctorId?: string
  toStatus?: string
}
interface RadiologyEvent extends BaseEvent {
  radiologyOrderId: string
  patientId?: string
  doctorId?: string
  toStatus?: string
}
interface InvoiceEvent extends BaseEvent {
  invoiceId: string
  patientId?: string
}
interface PaymentEvent extends BaseEvent {
  paymentId: string
  invoiceId: string
  amount?: number | string
  paymentMode?: string
}
interface InsuranceEvent extends BaseEvent {
  claimId?: string
  preAuthorizationId?: string
  patientId?: string
  status?: string
}
interface DispenseEvent extends BaseEvent {
  dispenseOrderId: string
  prescriptionId?: string
  patientId?: string
  toStatus?: string
}
interface AdmissionEvent extends BaseEvent {
  admissionId: string
  patientId?: string
  doctorId?: string
  bedId?: string
  toBedId?: string
}
interface StaffLeaveEvent extends BaseEvent {
  /** `StaffLeaveService` publishes this as `leaveId`, not `staffLeaveId`. */
  leaveId: string
  staffId: string
}
interface ShiftRosterEvent extends BaseEvent {
  shiftRosterId?: string
  staffId?: string
  shiftId?: string
  date?: string | Date
}
interface OrganizationEvent {
  organizationId: string
  organizationName?: string
  organizationSlug?: string
  userId?: string
}
interface HospitalEvent extends BaseEvent {
  hospitalId: string
  hospitalName?: string
  hospitalCode?: string
}

/**
 * Event integration (Checkpoint 18.4).
 *
 * **Nothing here emits a new event.** Every trigger below is an event some
 * module was already publishing for the audit trail, so no clinical, billing
 * or inventory service was modified to add notifications — the same
 * "additional listener on an existing event" pattern
 * `AppointmentInvoiceListener` established for auto-invoicing.
 *
 * Three rules hold throughout:
 *
 * 1. **Every handler swallows its own errors.** A notification failure must
 *    never roll back the clinical action that triggered it.
 * 2. **Recipients are resolved from the domain, not broadcast.** A lab result
 *    goes to the ordering doctor, not to everyone holding `laboratory.read` —
 *    a notification everyone receives is a notification everyone mutes.
 * 3. **Every send carries an `eventKey`**, so an event that fires twice (a
 *    retried transaction, a duplicated emit) produces one notification.
 *
 * Every handler also guards on the id it needs before touching the database.
 * These payloads are published by twelve modules that predate this listener
 * and are not typed at the emit site, so a field this listener expects can
 * legitimately be absent — `findUnique({ where: { id: undefined } })` throws
 * a Prisma validation error, which `safely` would swallow into log noise
 * rather than a clean no-op.
 */
@Injectable()
export class NotificationEventsListener {
  private readonly logger = new Logger(NotificationEventsListener.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── Appointments ─────────────────────────────────────────────────────────

  @OnEvent('appointment.created')
  async onAppointmentCreated(payload: AppointmentEvent): Promise<void> {
    if (!payload?.appointmentId) return

    await this.safely('appointment.created', async () => {
      const context = await this.appointmentContext(payload.appointmentId)
      if (!context) return

      await this.notifications.notify({
        organizationId: payload.organizationId,
        hospitalId: context.hospitalId,
        type: NotificationType.APPOINTMENT_BOOKED,
        recipientIds: context.doctorUserId ? [context.doctorUserId] : [],
        patientId: context.patientId,
        variables: context.variables,
        eventKey: `appointment.booked:${payload.appointmentId}`,
      })

      // The reminder is scheduled at booking time rather than swept for by a
      // nightly job: the due time is known now, and the queue already knows
      // how to hold a future-dated delivery.
      const hours = this.config.get<number>('notifications.appointmentReminderHours') ?? 24
      const remindAt = new Date(context.scheduledAt.getTime() - hours * 3600_000)
      if (remindAt.getTime() > Date.now()) {
        await this.notifications.notify({
          organizationId: payload.organizationId,
          hospitalId: context.hospitalId,
          type: NotificationType.APPOINTMENT_REMINDER,
          recipientIds: context.doctorUserId ? [context.doctorUserId] : [],
          patientId: context.patientId,
          variables: context.variables,
          scheduleAt: remindAt,
          eventKey: `appointment.reminder:${payload.appointmentId}`,
        })
      }
    })
  }

  @OnEvent('appointment.status_changed')
  async onAppointmentStatusChanged(payload: AppointmentEvent): Promise<void> {
    const type =
      payload.toStatus === 'CONFIRMED'
        ? NotificationType.APPOINTMENT_CONFIRMED
        : payload.toStatus === 'CANCELLED'
          ? NotificationType.APPOINTMENT_CANCELLED
          : null
    if (!type) return

    if (!payload?.appointmentId) return

    await this.safely('appointment.status_changed', async () => {
      const context = await this.appointmentContext(payload.appointmentId)
      if (!context) return

      await this.notifications.notify({
        organizationId: payload.organizationId,
        hospitalId: context.hospitalId,
        type,
        recipientIds: context.doctorUserId ? [context.doctorUserId] : [],
        patientId: context.patientId,
        variables: context.variables,
        eventKey: `appointment.${payload.toStatus?.toLowerCase()}:${payload.appointmentId}`,
      })

      // A cancelled appointment's reminder must not still fire.
      if (type === NotificationType.APPOINTMENT_CANCELLED) {
        await this.cancelPending(`appointment.reminder:${payload.appointmentId}`)
      }
    })
  }

  // ─── EMR ──────────────────────────────────────────────────────────────────

  @OnEvent('encounter.created')
  async onEncounterCreated(payload: EncounterEvent): Promise<void> {
    if (!payload?.encounterId) return

    await this.safely('encounter.created', async () => {
      const encounter = await this.prisma.encounter.findUnique({
        where: { id: payload.encounterId },
        select: {
          id: true,
          type: true,
          patient: { select: { id: true, firstName: true, lastName: true } },
          doctor: { select: { userId: true } },
        },
      })
      if (!encounter?.doctor?.userId) return

      await this.notifications.notify({
        organizationId: payload.organizationId,
        type: NotificationType.ENCOUNTER_CREATED,
        recipientIds: [encounter.doctor.userId],
        patientId: encounter.patient.id,
        variables: {
          patientName: fullName(encounter.patient),
          encounterType: encounter.type,
          encounterId: encounter.id,
        },
        eventKey: `encounter.created:${encounter.id}`,
      })
    })
  }

  @OnEvent('encounter.status_changed')
  async onEncounterStatusChanged(payload: EncounterEvent): Promise<void> {
    if (!payload?.encounterId) return

    await this.safely('encounter.status_changed', async () => {
      const encounter = await this.prisma.encounter.findUnique({
        where: { id: payload.encounterId },
        select: {
          id: true,
          status: true,
          patient: { select: { id: true, firstName: true, lastName: true } },
          doctor: { select: { userId: true } },
        },
      })
      if (!encounter?.doctor?.userId) return

      await this.notifications.notify({
        organizationId: payload.organizationId,
        type: NotificationType.ENCOUNTER_UPDATED,
        recipientIds: [encounter.doctor.userId],
        patientId: encounter.patient.id,
        variables: {
          patientName: fullName(encounter.patient),
          encounterStatus: encounter.status,
          encounterId: encounter.id,
        },
        eventKey: `encounter.${encounter.status.toLowerCase()}:${encounter.id}`,
      })
    })
  }

  // ─── Laboratory ───────────────────────────────────────────────────────────

  @OnEvent('lab_test.status_changed')
  async onLabTestStatusChanged(payload: LabTestEvent): Promise<void> {
    const type =
      payload.toStatus === 'SAMPLE_COLLECTED'
        ? NotificationType.LAB_SAMPLE_COLLECTED
        : payload.toStatus === 'REPORTED' || payload.toStatus === 'COMPLETED'
          ? NotificationType.LAB_RESULT_READY
          : null
    if (!type) return

    if (!payload?.labTestId) return

    await this.safely('lab_test.status_changed', async () => {
      const labTest = await this.prisma.labTest.findUnique({
        where: { id: payload.labTestId },
        select: {
          id: true,
          labOrderNumber: true,
          patient: { select: { id: true, firstName: true, lastName: true } },
          doctor: { select: { userId: true } },
          items: { select: { testName: true, abnormalType: true } },
        },
      })
      if (!labTest?.doctor?.userId) return

      // A critical value must reach the clinician regardless of quiet hours or
      // muted categories — that is exactly what CRITICAL priority is for. The
      // flags are laboratory's own (`abnormalType`, computed at result entry);
      // nothing is recomputed here.
      const critical = labTest.items.some(
        (item) => item.abnormalType === 'CRITICAL_HIGH' || item.abnormalType === 'CRITICAL_LOW',
      )
      const abnormal = labTest.items.some((item) => item.abnormalType !== null)
      // A lab order carries many tests; the order number is what identifies it.
      const testName =
        labTest.items.length === 1
          ? labTest.items[0].testName
          : `${labTest.labOrderNumber} (${labTest.items.length} tests)`

      await this.notifications.notify({
        organizationId: payload.organizationId,
        type,
        recipientIds: [labTest.doctor.userId],
        patientId: labTest.patient.id,
        priority:
          type === NotificationType.LAB_RESULT_READY && critical
            ? NotificationPriority.CRITICAL
            : undefined,
        variables: {
          testName,
          patientName: fullName(labTest.patient),
          labTestId: labTest.id,
          abnormalNote: critical
            ? ' A critical value was flagged — review immediately.'
            : abnormal
              ? ' Abnormal values were flagged.'
              : '',
        },
        eventKey: `lab_test.${type}:${labTest.id}`,
      })
    })
  }

  // ─── Radiology ────────────────────────────────────────────────────────────

  @OnEvent('radiology_order.status_changed')
  async onRadiologyStatusChanged(payload: RadiologyEvent): Promise<void> {
    if (payload.toStatus !== 'REPORTED') return

    if (!payload?.radiologyOrderId) return

    await this.safely('radiology_order.status_changed', async () => {
      const order = await this.prisma.radiologyOrder.findUnique({
        where: { id: payload.radiologyOrderId },
        select: {
          id: true,
          // There is no `studyName` column — a study is identified by its
          // modality and body part, which is what the order screen shows too.
          modality: true,
          bodyPart: true,
          patient: { select: { id: true, firstName: true, lastName: true } },
          doctor: { select: { userId: true } },
        },
      })
      if (!order?.doctor?.userId) return

      await this.notifications.notify({
        organizationId: payload.organizationId,
        type: NotificationType.RADIOLOGY_REPORT_RELEASED,
        recipientIds: [order.doctor.userId],
        patientId: order.patient.id,
        variables: {
          studyName: `${order.modality} ${order.bodyPart}`.trim(),
          patientName: fullName(order.patient),
          radiologyOrderId: order.id,
        },
        eventKey: `radiology.reported:${order.id}`,
      })
    })
  }

  // ─── Billing ──────────────────────────────────────────────────────────────

  @OnEvent('invoice.created')
  async onInvoiceCreated(payload: InvoiceEvent): Promise<void> {
    if (!payload?.invoiceId) return

    await this.safely('invoice.created', async () => {
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: payload.invoiceId },
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          patient: { select: { id: true, firstName: true, lastName: true } },
        },
      })
      if (!invoice) return

      await this.notifications.notify({
        organizationId: payload.organizationId,
        type: NotificationType.INVOICE_GENERATED,
        // Billing is a desk function, not a per-patient assignment, so this is
        // one of the few genuinely role-addressed notifications.
        roles: ['CASHIER', 'ORG_ADMIN'],
        patientId: invoice.patient.id,
        variables: {
          invoiceNumber: invoice.invoiceNumber,
          patientName: fullName(invoice.patient),
          amount: String(invoice.totalAmount),
          invoiceId: invoice.id,
        },
        eventKey: `invoice.created:${invoice.id}`,
      })
    })
  }

  @OnEvent('payment.recorded')
  async onPaymentRecorded(payload: PaymentEvent): Promise<void> {
    if (!payload?.paymentId) return

    await this.safely('payment.recorded', async () => {
      const payment = await this.prisma.payment.findUnique({
        where: { id: payload.paymentId },
        select: {
          id: true,
          amount: true,
          paymentMode: true,
          invoice: { select: { id: true, invoiceNumber: true, patientId: true } },
        },
      })
      if (!payment?.invoice) return

      await this.notifications.notify({
        organizationId: payload.organizationId,
        type: NotificationType.PAYMENT_RECEIVED,
        roles: ['CASHIER', 'ORG_ADMIN'],
        patientId: payment.invoice.patientId,
        variables: {
          invoiceNumber: payment.invoice.invoiceNumber,
          amount: String(payment.amount),
          paymentMode: payment.paymentMode,
          invoiceId: payment.invoice.id,
        },
        eventKey: `payment.recorded:${payment.id}`,
      })
    })
  }

  // ─── Insurance ────────────────────────────────────────────────────────────

  @OnEvent('insurance.preauth_decided')
  async onPreAuthDecided(payload: InsuranceEvent): Promise<void> {
    if (!payload.preAuthorizationId) return
    if (payload.status !== 'APPROVED' && payload.status !== 'PARTIALLY_APPROVED') return

    await this.safely('insurance.preauth_decided', async () => {
      const preAuth = await this.prisma.preAuthorization.findUnique({
        where: { id: payload.preAuthorizationId },
        select: {
          id: true,
          authNumber: true,
          status: true,
          approvedAmount: true,
          patient: { select: { id: true, firstName: true, lastName: true } },
        },
      })
      if (!preAuth) return

      await this.notifications.notify({
        organizationId: payload.organizationId,
        type: NotificationType.PREAUTH_APPROVED,
        roles: ['CASHIER', 'ORG_ADMIN'],
        patientId: preAuth.patient.id,
        variables: {
          patientName: fullName(preAuth.patient),
          preAuthNumber: preAuth.authNumber,
          decision: preAuth.status,
          amount: preAuth.approvedAmount ? String(preAuth.approvedAmount) : 'an undisclosed amount',
        },
        eventKey: `preauth.decided:${preAuth.id}`,
      })
    })
  }

  @OnEvent('insurance.claim_decided')
  async onClaimDecided(payload: InsuranceEvent): Promise<void> {
    if (!payload.claimId) return

    await this.safely('insurance.claim_decided', async () => {
      const claim = await this.prisma.insuranceClaim.findUnique({
        where: { id: payload.claimId },
        select: {
          id: true,
          claimNumber: true,
          status: true,
          approvedAmount: true,
          rejectionReason: true,
          patient: { select: { id: true, firstName: true, lastName: true } },
        },
      })
      if (!claim) return

      const rejected = claim.status === 'REJECTED'
      await this.notifications.notify({
        organizationId: payload.organizationId,
        type: rejected ? NotificationType.CLAIM_REJECTED : NotificationType.CLAIM_APPROVED,
        roles: ['CASHIER', 'ORG_ADMIN'],
        patientId: claim.patient.id,
        variables: {
          claimNumber: claim.claimNumber,
          patientName: fullName(claim.patient),
          decision: claim.status,
          amount: claim.approvedAmount ? String(claim.approvedAmount) : '0',
          reason: claim.rejectionReason ?? '',
          claimId: claim.id,
        },
        eventKey: `claim.decided:${claim.id}:${claim.status}`,
      })
    })
  }

  // ─── Pharmacy ─────────────────────────────────────────────────────────────

  @OnEvent('dispense_order.status_changed')
  async onDispenseStatusChanged(payload: DispenseEvent): Promise<void> {
    const type =
      payload.toStatus === 'READY'
        ? NotificationType.PRESCRIPTION_READY
        : payload.toStatus === 'DISPENSED'
          ? NotificationType.MEDICINE_DISPENSED
          : null
    if (!type) return

    if (!payload?.dispenseOrderId) return

    await this.safely('dispense_order.status_changed', async () => {
      const order = await this.prisma.dispenseOrder.findUnique({
        where: { id: payload.dispenseOrderId },
        select: {
          id: true,
          dispenseNumber: true,
          patient: { select: { id: true, firstName: true, lastName: true } },
          prescription: { select: { doctor: { select: { userId: true } } } },
        },
      })
      if (!order) return

      const doctorUserId = order.prescription?.doctor?.userId
      await this.notifications.notify({
        organizationId: payload.organizationId,
        type,
        recipientIds: doctorUserId ? [doctorUserId] : [],
        roles: doctorUserId ? undefined : ['PHARMACIST'],
        patientId: order.patient.id,
        variables: {
          patientName: fullName(order.patient),
          dispenseNumber: order.dispenseNumber,
          dispenseOrderId: order.id,
        },
        eventKey: `dispense.${type}:${order.id}`,
      })
    })
  }

  // ─── Inventory ────────────────────────────────────────────────────────────

  /**
   * `inventory_stock.changed` carries the stock row every movement touched.
   * It is the one event this milestone had to add (the inventory module
   * emitted movements, never a stock-level change) — the threshold itself is
   * evaluated *here*, from the stock row, so no reorder policy is duplicated
   * into the notification layer.
   *
   * `minStock` and `reorderLevel` are both per store-item and both optional;
   * `minStock` is the harder floor, so it wins when a row has crossed both.
   */
  @OnEvent('inventory_stock.changed')
  async onInventoryStockChanged(payload: BaseEvent & { inventoryStockId?: string }): Promise<void> {
    if (!payload.inventoryStockId) return

    await this.safely('inventory_stock.changed', async () => {
      const stock = await this.prisma.inventoryStock.findUnique({
        where: { id: payload.inventoryStockId },
        select: {
          id: true,
          currentStock: true,
          minStock: true,
          reorderLevel: true,
          item: { select: { name: true, unit: { select: { name: true } } } },
          store: { select: { name: true } },
        },
      })
      if (!stock?.item) return

      const type =
        stock.minStock > 0 && stock.currentStock <= stock.minStock
          ? NotificationType.INVENTORY_LOW_STOCK
          : stock.reorderLevel > 0 && stock.currentStock <= stock.reorderLevel
            ? NotificationType.INVENTORY_REORDER_LEVEL
            : null
      if (!type) return

      await this.notifications.notify({
        organizationId: payload.organizationId,
        type,
        roles: ['INVENTORY_MANAGER', 'ORG_ADMIN'],
        variables: {
          itemName: stock.item.name,
          storeName: stock.store?.name ?? 'the store',
          quantity: stock.currentStock,
          unit: stock.item.unit?.name ?? 'units',
          minimumStock: stock.minStock,
        },
        // Re-alerting on every movement while stock stays low would be noise.
        // Keying on the threshold means one alert per crossing; restocking
        // above it and dropping back below raises a genuinely new one only
        // once the threshold value itself changes — a deliberate trade
        // recorded in TECH_DEBT.
        eventKey: `inventory.${type}:${stock.id}:${type === NotificationType.INVENTORY_LOW_STOCK ? stock.minStock : stock.reorderLevel}`,
      })
    })
  }

  // ─── IPD ──────────────────────────────────────────────────────────────────

  @OnEvent('ipd.admission_created')
  async onAdmissionCreated(payload: AdmissionEvent): Promise<void> {
    if (!payload?.admissionId) return

    await this.safely('ipd.admission_created', async () => {
      const admission = await this.prisma.admission.findUnique({
        where: { id: payload.admissionId },
        select: {
          id: true,
          admissionNumber: true,
          patient: { select: { id: true, firstName: true, lastName: true } },
          attendingDoctor: { select: { userId: true, user: { select: { firstName: true, lastName: true } } } },
        },
      })
      if (!admission) return

      await this.notifications.notify({
        organizationId: payload.organizationId,
        type: NotificationType.IPD_ADMITTED,
        recipientIds: admission.attendingDoctor?.userId ? [admission.attendingDoctor.userId] : [],
        roles: ['NURSE'],
        patientId: admission.patient.id,
        variables: {
          patientName: fullName(admission.patient),
          admissionNumber: admission.admissionNumber,
          doctorName: admission.attendingDoctor?.user
            ? `Dr. ${fullName(admission.attendingDoctor.user)}`
            : 'the attending physician',
          admissionId: admission.id,
        },
        eventKey: `ipd.admitted:${admission.id}`,
      })
    })
  }

  @OnEvent('ipd.bed_transferred')
  async onBedTransferred(payload: AdmissionEvent): Promise<void> {
    if (!payload?.admissionId) return

    await this.safely('ipd.bed_transferred', async () => {
      const admission = await this.prisma.admission.findUnique({
        where: { id: payload.admissionId },
        select: {
          id: true,
          admissionNumber: true,
          patient: { select: { id: true, firstName: true, lastName: true } },
          attendingDoctor: { select: { userId: true } },
        },
      })
      if (!admission) return

      const bed = payload.toBedId
        ? await this.prisma.bed.findUnique({
            where: { id: payload.toBedId },
            select: { bedNumber: true },
          })
        : null

      await this.notifications.notify({
        organizationId: payload.organizationId,
        type: NotificationType.IPD_TRANSFERRED,
        recipientIds: admission.attendingDoctor?.userId ? [admission.attendingDoctor.userId] : [],
        roles: ['NURSE'],
        patientId: admission.patient.id,
        variables: {
          patientName: fullName(admission.patient),
          admissionNumber: admission.admissionNumber,
          toBed: bed?.bedNumber ?? 'a new bed',
          admissionId: admission.id,
        },
        // Keyed on the destination bed: a patient may legitimately be moved
        // more than once, and each move is its own event.
        eventKey: `ipd.transferred:${admission.id}:${payload.toBedId ?? 'unknown'}`,
      })
    })
  }

  @OnEvent('ipd.discharge_completed')
  async onDischargeCompleted(payload: AdmissionEvent): Promise<void> {
    if (!payload?.admissionId) return

    await this.safely('ipd.discharge_completed', async () => {
      const admission = await this.prisma.admission.findUnique({
        where: { id: payload.admissionId },
        select: {
          id: true,
          admissionNumber: true,
          patient: { select: { id: true, firstName: true, lastName: true } },
          attendingDoctor: { select: { userId: true } },
        },
      })
      if (!admission) return

      const variables = {
        patientName: fullName(admission.patient),
        admissionNumber: admission.admissionNumber,
        admissionId: admission.id,
      }
      const recipientIds = admission.attendingDoctor?.userId ? [admission.attendingDoctor.userId] : []

      await this.notifications.notify({
        organizationId: payload.organizationId,
        type: NotificationType.IPD_DISCHARGED,
        recipientIds,
        roles: ['NURSE', 'CASHIER'],
        patientId: admission.patient.id,
        variables,
        eventKey: `ipd.discharged:${admission.id}`,
      })

      await this.notifications.notify({
        organizationId: payload.organizationId,
        type: NotificationType.DISCHARGE_SUMMARY,
        recipientIds,
        patientId: admission.patient.id,
        variables,
        eventKey: `ipd.discharge_summary:${admission.id}`,
      })
    })
  }

  // ─── Staff ────────────────────────────────────────────────────────────────

  @OnEvent('staff.leave.approved')
  async onStaffLeaveApproved(payload: StaffLeaveEvent): Promise<void> {
    if (!payload?.leaveId) return

    await this.safely('staff.leave.approved', async () => {
      const leave = await this.prisma.staffLeave.findUnique({
        where: { id: payload.leaveId },
        select: {
          id: true,
          leaveType: true,
          startDate: true,
          endDate: true,
          staff: { select: { userId: true } },
        },
      })
      if (!leave?.staff?.userId) return

      await this.notifications.notify({
        organizationId: payload.organizationId,
        type: NotificationType.STAFF_LEAVE_APPROVED,
        recipientIds: [leave.staff.userId],
        variables: {
          leaveType: leave.leaveType,
          fromDate: dateOnly(leave.startDate),
          toDate: dateOnly(leave.endDate),
        },
        eventKey: `staff.leave_approved:${leave.id}`,
      })
    })
  }

  @OnEvent('staff.roster.assigned')
  async onShiftAssigned(payload: ShiftRosterEvent): Promise<void> {
    if (!payload.shiftRosterId) return

    await this.safely('staff.roster.assigned', async () => {
      const roster = await this.prisma.shiftRoster.findUnique({
        where: { id: payload.shiftRosterId },
        select: {
          id: true,
          date: true,
          staff: { select: { userId: true } },
          shift: { select: { name: true, startTime: true, endTime: true } },
        },
      })
      if (!roster?.staff?.userId) return

      await this.notifications.notify({
        organizationId: payload.organizationId,
        type: NotificationType.STAFF_SHIFT_ASSIGNED,
        recipientIds: [roster.staff.userId],
        variables: {
          shiftName: roster.shift?.name ?? 'assigned',
          shiftStart: roster.shift?.startTime ?? '',
          shiftEnd: roster.shift?.endTime ?? '',
          shiftDate: dateOnly(roster.date),
        },
        eventKey: `staff.shift_assigned:${roster.id}`,
      })
    })
  }

  // ─── Platform ─────────────────────────────────────────────────────────────

  @OnEvent('organization.onboarded')
  async onOrganizationOnboarded(payload: OrganizationEvent): Promise<void> {
    if (!payload?.organizationId) return

    await this.safely('organization.onboarded', async () => {
      const platformOrg = await this.prisma.organization.findFirst({
        where: { isPlatform: true },
        select: { id: true },
      })
      if (!platformOrg) return

      const organization = await this.prisma.organization.findUnique({
        where: { id: payload.organizationId },
        select: { name: true, slug: true },
      })
      if (!organization) return

      await this.notifications.notify({
        // Addressed to the *platform* tenant, not the new customer — this is
        // news for the platform owner, not for the organization being created.
        organizationId: platformOrg.id,
        type: NotificationType.ORGANIZATION_ONBOARDED,
        roles: ['SUPER_ADMIN'],
        variables: { organizationName: organization.name, organizationSlug: organization.slug },
        eventKey: `platform.org_onboarded:${payload.organizationId}`,
      })
    })
  }

  @OnEvent('hospital.created')
  async onHospitalCreated(payload: HospitalEvent): Promise<void> {
    if (!payload?.hospitalId) return

    await this.safely('hospital.created', async () => {
      const hospital = await this.prisma.hospital.findUnique({
        where: { id: payload.hospitalId },
        select: { id: true, name: true, code: true, organization: { select: { name: true } } },
      })
      if (!hospital) return

      await this.notifications.notify({
        organizationId: payload.organizationId,
        hospitalId: hospital.id,
        type: NotificationType.HOSPITAL_CREATED,
        roles: ['ORG_ADMIN'],
        variables: {
          hospitalName: hospital.name,
          hospitalCode: hospital.code,
          organizationName: hospital.organization.name,
        },
        eventKey: `hospital.created:${hospital.id}`,
      })
    })
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** Cancels an unsent notification whose triggering fact no longer holds. */
  private async cancelPending(eventKey: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { eventKey, deliveryStatus: { in: ['SCHEDULED', 'PENDING'] } },
      data: { deliveryStatus: 'CANCELLED', scheduleAt: null },
    })
    const cancelled = await this.prisma.notification.findMany({
      where: { eventKey, deliveryStatus: 'CANCELLED' },
      select: { id: true },
    })
    if (cancelled.length) {
      await this.prisma.notificationDelivery.updateMany({
        where: {
          notificationId: { in: cancelled.map((n) => n.id) },
          status: { in: ['PENDING', 'QUEUED'] },
        },
        data: { status: 'CANCELLED', nextAttemptAt: null },
      })
    }
  }

  private async appointmentContext(appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        scheduledAt: true,
        patient: { select: { id: true, firstName: true, lastName: true } },
        doctor: {
          select: {
            userId: true,
            hospitalId: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    })
    if (!appointment) return null

    const scheduledAt = appointment.scheduledAt
    return {
      patientId: appointment.patient.id,
      doctorUserId: appointment.doctor?.userId ?? null,
      hospitalId: appointment.doctor?.hospitalId ?? null,
      scheduledAt,
      variables: {
        patientName: fullName(appointment.patient),
        doctorName: appointment.doctor?.user ? `Dr. ${fullName(appointment.doctor.user)}` : 'the doctor',
        appointmentDate: dateOnly(scheduledAt),
        appointmentTime: timeOnly(scheduledAt),
        appointmentId: appointment.id,
      },
    }
  }

  /**
   * Runs a handler, logging and swallowing anything it throws. Rule 1 above:
   * an event listener that throws would surface as a failure of the clinical
   * action that emitted the event.
   */
  private async safely(event: string, work: () => Promise<void>): Promise<void> {
    try {
      await work()
    } catch (error) {
      this.logger.error(
        `Notification handling for "${event}" failed: ${(error as Error).message}`,
        (error as Error).stack,
      )
    }
  }
}

function fullName(person: { firstName: string; lastName: string }): string {
  return `${person.firstName} ${person.lastName}`.trim()
}

/** `YYYY-MM-DD` in local time — never `toISOString()`, which shifts in +05:30. */
function dateOnly(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function timeOnly(value: Date): string {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
}
