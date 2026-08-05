import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

import { PrismaService } from '../../prisma/prisma.service'

import { AuditService } from './audit.service'

interface AuthEventPayload {
  userId?: string
  orgId?: string
  email?: string
  sessionId?: string
}

interface PatientEventPayload {
  patientId: string
  organizationId: string
  userId?: string
  documentId?: string
  metadata?: Record<string, unknown>
}

interface PatientImportEventPayload {
  organizationId: string
  userId?: string
  total: number
  created: number
  failed: number
}

interface DoctorEventPayload {
  doctorId: string
  organizationId: string
  userId?: string
}

interface DoctorScheduleEventPayload {
  doctorId: string
  organizationId: string
  userId?: string
  scheduleId: string
}

interface DoctorLeaveEventPayload {
  doctorId: string
  organizationId: string
  userId?: string
  leaveId: string
}

interface DoctorDocumentEventPayload {
  doctorId: string
  organizationId: string
  userId?: string
  documentId: string
}

interface StaffEventPayload {
  staffId: string
  organizationId: string
  userId?: string
  status?: string
}

interface StaffDocumentEventPayload {
  staffId: string
  organizationId: string
  userId?: string
  documentId: string
}

interface StaffAttendanceEventPayload {
  attendanceId: string
  staffId: string
  organizationId: string
  userId?: string
}

interface StaffLeaveEventPayload {
  leaveId: string
  staffId: string
  organizationId: string
  userId?: string
}

interface AppointmentEventPayload {
  appointmentId: string
  doctorId: string
  patientId: string
  organizationId: string
  userId?: string
  fromStatus?: string
  toStatus?: string
}

interface EncounterEventPayload {
  encounterId: string
  doctorId: string
  patientId: string
  organizationId: string
  userId?: string
  fromStatus?: string
  toStatus?: string
}

interface ClinicalNoteEventPayload {
  encounterId: string
  noteId: string
  version: number
  organizationId: string
  userId?: string
}

interface PrescriptionEventPayload {
  prescriptionId: string
  doctorId: string
  patientId: string
  organizationId: string
  userId?: string
  fromStatus?: string
  toStatus?: string
}

interface LabTestEventPayload {
  labTestId: string
  doctorId: string
  patientId: string
  organizationId: string
  userId?: string
  fromStatus?: string
  toStatus?: string
}

interface RadiologyOrderEventPayload {
  radiologyOrderId: string
  doctorId: string
  patientId: string
  organizationId: string
  userId?: string
  fromStatus?: string
  toStatus?: string
  reason?: string
}

interface DispenseOrderEventPayload {
  dispenseOrderId: string
  patientId: string
  organizationId: string
  userId?: string
  fromStatus?: string
  toStatus?: string
  reason?: string
}

interface DrugReturnEventPayload {
  dispenseOrderId: string
  drugReturnId: string
  patientId: string
  organizationId: string
  userId?: string
}

interface ChargeEventPayload {
  chargeId: string
  patientId: string
  organizationId: string
  userId?: string
  sourceModule?: string
}

interface InvoiceEventPayload {
  invoiceId: string
  patientId: string
  organizationId: string
  userId?: string
  fromStatus?: string
  toStatus?: string
  reason?: string
}

interface PaymentEventPayload {
  paymentId: string
  invoiceId: string
  patientId: string
  organizationId: string
  userId?: string
  amount?: number
  paymentMode?: string
}

interface RefundEventPayload {
  refundId: string
  invoiceId: string
  patientId: string
  organizationId: string
  userId?: string
  amount?: number
  reason?: string
}

interface PreAuthEventPayload {
  preAuthId: string
  patientId?: string
  status?: string
  organizationId: string
  userId?: string
}

interface ClaimEventPayload {
  claimId: string
  patientId?: string
  status?: string
  insuranceShare?: number
  organizationId: string
  userId?: string
}

interface AdmissionEventPayload {
  admissionId: string
  patientId?: string
  attendingDoctorId?: string
  status?: string
  organizationId: string
  userId?: string
}

interface BedAllocationEventPayload {
  admissionId: string
  bedId?: string
  fromBedId?: string
  toBedId?: string
  patientId?: string
  organizationId: string
  userId?: string
}

interface NursingNoteEventPayload {
  nursingNoteId: string
  admissionId: string
  patientId: string
  organizationId: string
  userId?: string
  isEscalated?: boolean
}

interface NursingAssessmentEventPayload {
  nursingAssessmentId: string
  admissionId: string
  patientId: string
  organizationId: string
  userId?: string
  fallRiskLevel?: string | null
  bradenRiskLevel?: string | null
}

interface IntakeOutputEventPayload {
  intakeOutputRecordId: string
  admissionId: string
  patientId: string
  organizationId: string
  userId?: string
}

interface IpdOrderEventPayload {
  ipdOrderId: string
  admissionId: string
  patientId?: string
  organizationId: string
  userId?: string
  category?: string
}

interface NursingTaskEventPayload {
  nursingTaskId: string
  admissionId: string
  patientId?: string
  organizationId: string
  userId?: string
  priority?: string
  fromStatus?: string
  toStatus?: string
}

interface MarScheduledEventPayload {
  admissionId: string
  prescriptionItemId: string
  patientId: string
  organizationId: string
  userId?: string
  count: number
}

interface MedicationAdministrationEventPayload {
  medicationAdministrationId: string
  admissionId: string
  patientId?: string
  organizationId: string
  userId?: string
  type?: string
  fromStatus?: string
  toStatus?: string
}

interface DischargeEventPayload {
  admissionId: string
  patientId?: string
  organizationId: string
  userId?: string
  itemKey?: string
  completed?: boolean
  daysStayed?: number
}

// ─── General Inventory & Procurement (Milestone 13 / ADR-0020) ─────────────

interface PurchaseRequestEventPayload {
  purchaseRequestId: string
  organizationId: string
  userId?: string
  fromStatus?: string
  toStatus?: string
  reason?: string
}

interface PurchaseOrderEventPayload {
  purchaseOrderId: string
  organizationId: string
  userId?: string
  fromStatus?: string
  toStatus?: string
  reason?: string
}

interface GoodsReceiptNoteEventPayload {
  goodsReceiptNoteId: string
  organizationId: string
  userId?: string
}

interface VendorReturnEventPayload {
  vendorReturnId: string
  organizationId: string
  userId?: string
}

interface VendorInvoiceEventPayload {
  vendorInvoiceId: string
  organizationId: string
  userId?: string
  fromStatus?: string
  toStatus?: string
}

interface StoreRequisitionEventPayload {
  storeRequisitionId: string
  organizationId: string
  userId?: string
  fromStatus?: string
  toStatus?: string
  reason?: string
}

interface InventoryStockTransferEventPayload {
  transferId: string
  organizationId: string
  userId?: string
  fromStatus?: string
  toStatus?: string
  reason?: string
}

interface AssetEventPayload {
  assetId: string
  organizationId: string
  userId?: string
  assignedToUserId?: string
  assignedToDepartmentId?: string
}

interface AssetMaintenanceEventPayload {
  assetId: string
  maintenanceRecordId: string
  organizationId: string
  userId?: string
  type?: string
}

interface StockAuditEventPayload {
  stockAuditId: string
  organizationId: string
  userId?: string
  fromStatus?: string
  toStatus?: string
}

@Injectable()
export class AuditListener {
  private readonly logger = new Logger(AuditListener.name)

  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('auth.register')
  onRegister(payload: AuthEventPayload) {
    return this.persist(payload, 'user.registered', 'User')
  }

  @OnEvent('auth.login')
  onLogin(payload: AuthEventPayload) {
    return this.persist(payload, 'user.login', 'User')
  }

  @OnEvent('auth.failed_login')
  onFailedLogin(payload: AuthEventPayload) {
    return this.persist(payload, 'user.login_failed', 'User')
  }

  @OnEvent('auth.logout')
  onLogout(payload: AuthEventPayload) {
    return this.persist(payload, 'user.logout', 'User')
  }

  @OnEvent('auth.logout_all')
  onLogoutAll(payload: AuthEventPayload) {
    return this.persist(payload, 'user.logout_all', 'User')
  }

  @OnEvent('auth.password_reset')
  onPasswordReset(payload: AuthEventPayload) {
    return this.persist(payload, 'user.password_reset', 'User')
  }

  @OnEvent('auth.email_verified')
  onEmailVerified(payload: AuthEventPayload) {
    return this.persist(payload, 'user.email_verified', 'User')
  }

  @OnEvent('auth.account_locked')
  onAccountLocked(payload: AuthEventPayload) {
    return this.persist(payload, 'user.account_locked', 'User')
  }

  @OnEvent('auth.token_reuse_detected')
  onTokenReuseDetected(payload: AuthEventPayload) {
    return this.persist(payload, 'auth.token_reuse_detected', 'Session')
  }

  @OnEvent('patient.registered')
  onPatientRegistered(payload: PatientEventPayload) {
    return this.persistPatientEvent(payload, 'patient.registered')
  }

  @OnEvent('patient.updated')
  onPatientUpdated(payload: PatientEventPayload) {
    return this.persistPatientEvent(payload, 'patient.updated')
  }

  @OnEvent('patient.deleted')
  onPatientDeleted(payload: PatientEventPayload) {
    return this.persistPatientEvent(payload, 'patient.deleted')
  }

  @OnEvent('patient.restored')
  onPatientRestored(payload: PatientEventPayload) {
    return this.persistPatientEvent(payload, 'patient.restored')
  }

  @OnEvent('patient.document_uploaded')
  onPatientDocumentUploaded(payload: PatientEventPayload) {
    return this.persistPatientEvent(payload, 'patient.document_uploaded')
  }

  @OnEvent('patient.family_linked')
  onPatientFamilyLinked(payload: PatientEventPayload) {
    return this.persistPatientEvent(payload, 'patient.family_linked')
  }

  @OnEvent('patient.family_unlinked')
  onPatientFamilyUnlinked(payload: PatientEventPayload) {
    return this.persistPatientEvent(payload, 'patient.family_unlinked')
  }

  @OnEvent('patient.merged')
  onPatientMerged(payload: PatientEventPayload) {
    return this.persistPatientEvent(payload, 'patient.merged')
  }

  @OnEvent('patient.import_completed')
  onPatientImportCompleted(payload: PatientImportEventPayload) {
    return this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action: 'patient.import_completed',
      resource: 'Patient',
      resourceId: 'bulk-import',
      after: { total: payload.total, created: payload.created, failed: payload.failed },
    })
  }

  @OnEvent('doctor.created')
  onDoctorCreated(payload: DoctorEventPayload) {
    return this.persistDoctorEvent(payload, 'doctor.created')
  }

  @OnEvent('doctor.updated')
  onDoctorUpdated(payload: DoctorEventPayload) {
    return this.persistDoctorEvent(payload, 'doctor.updated')
  }

  @OnEvent('doctor.deactivated')
  onDoctorDeactivated(payload: DoctorEventPayload) {
    return this.persistDoctorEvent(payload, 'doctor.deactivated')
  }

  @OnEvent('doctor.restored')
  onDoctorRestored(payload: DoctorEventPayload) {
    return this.persistDoctorEvent(payload, 'doctor.restored')
  }

  @OnEvent('doctor.schedule.created')
  onScheduleCreated(payload: DoctorScheduleEventPayload) {
    return this.persistScheduleEvent(payload, 'doctor.schedule.created')
  }

  @OnEvent('doctor.schedule.updated')
  onScheduleUpdated(payload: DoctorScheduleEventPayload) {
    return this.persistScheduleEvent(payload, 'doctor.schedule.updated')
  }

  @OnEvent('doctor.leave.requested')
  onLeaveRequested(payload: DoctorLeaveEventPayload) {
    return this.persistLeaveEvent(payload, 'doctor.leave.requested')
  }

  @OnEvent('doctor.leave.approved')
  onLeaveApproved(payload: DoctorLeaveEventPayload) {
    return this.persistLeaveEvent(payload, 'doctor.leave.approved')
  }

  @OnEvent('doctor.leave.rejected')
  onLeaveRejected(payload: DoctorLeaveEventPayload) {
    return this.persistLeaveEvent(payload, 'doctor.leave.rejected')
  }

  @OnEvent('doctor.leave.cancelled')
  onLeaveCancelled(payload: DoctorLeaveEventPayload) {
    return this.persistLeaveEvent(payload, 'doctor.leave.cancelled')
  }

  @OnEvent('doctor.document_uploaded')
  onDoctorDocumentUploaded(payload: DoctorDocumentEventPayload) {
    return this.persistDoctorDocumentEvent(payload, 'doctor.document_uploaded')
  }

  @OnEvent('doctor.document_deleted')
  onDoctorDocumentDeleted(payload: DoctorDocumentEventPayload) {
    return this.persistDoctorDocumentEvent(payload, 'doctor.document_deleted')
  }

  @OnEvent('staff.created')
  onStaffCreated(payload: StaffEventPayload) {
    return this.persistStaffEvent(payload, 'staff.created')
  }

  @OnEvent('staff.updated')
  onStaffUpdated(payload: StaffEventPayload) {
    return this.persistStaffEvent(payload, 'staff.updated')
  }

  @OnEvent('staff.employment_status_changed')
  onStaffEmploymentStatusChanged(payload: StaffEventPayload) {
    return this.persistStaffEvent(payload, 'staff.employment_status_changed')
  }

  @OnEvent('staff.document_uploaded')
  onStaffDocumentUploaded(payload: StaffDocumentEventPayload) {
    return this.persistStaffDocumentEvent(payload, 'staff.document_uploaded')
  }

  @OnEvent('staff.document_deleted')
  onStaffDocumentDeleted(payload: StaffDocumentEventPayload) {
    return this.persistStaffDocumentEvent(payload, 'staff.document_deleted')
  }

  @OnEvent('staff.attendance.clocked_in')
  onAttendanceClockedIn(payload: StaffAttendanceEventPayload) {
    return this.persistAttendanceEvent(payload, 'staff.attendance.clocked_in')
  }

  @OnEvent('staff.attendance.clocked_out')
  onAttendanceClockedOut(payload: StaffAttendanceEventPayload) {
    return this.persistAttendanceEvent(payload, 'staff.attendance.clocked_out')
  }

  @OnEvent('staff.attendance.marked')
  onAttendanceMarked(payload: StaffAttendanceEventPayload) {
    return this.persistAttendanceEvent(payload, 'staff.attendance.marked')
  }

  @OnEvent('staff.attendance.corrected')
  onAttendanceCorrected(payload: StaffAttendanceEventPayload) {
    return this.persistAttendanceEvent(payload, 'staff.attendance.corrected')
  }

  @OnEvent('staff.leave.requested')
  onStaffLeaveRequested(payload: StaffLeaveEventPayload) {
    return this.persistStaffLeaveEvent(payload, 'staff.leave.requested')
  }

  @OnEvent('staff.leave.approved')
  onStaffLeaveApproved(payload: StaffLeaveEventPayload) {
    return this.persistStaffLeaveEvent(payload, 'staff.leave.approved')
  }

  @OnEvent('staff.leave.rejected')
  onStaffLeaveRejected(payload: StaffLeaveEventPayload) {
    return this.persistStaffLeaveEvent(payload, 'staff.leave.rejected')
  }

  @OnEvent('staff.leave.cancelled')
  onStaffLeaveCancelled(payload: StaffLeaveEventPayload) {
    return this.persistStaffLeaveEvent(payload, 'staff.leave.cancelled')
  }

  @OnEvent('appointment.created')
  onAppointmentCreated(payload: AppointmentEventPayload) {
    return this.persistAppointmentEvent(payload, 'appointment.created')
  }

  @OnEvent('appointment.status_changed')
  onAppointmentStatusChanged(payload: AppointmentEventPayload) {
    return this.persistAppointmentEvent(payload, `appointment.status_changed_to_${(payload.toStatus ?? '').toLowerCase()}`)
  }

  @OnEvent('encounter.created')
  onEncounterCreated(payload: EncounterEventPayload) {
    return this.persistEncounterEvent(payload, 'encounter.created')
  }

  @OnEvent('encounter.status_changed')
  onEncounterStatusChanged(payload: EncounterEventPayload) {
    return this.persistEncounterEvent(payload, `encounter.status_changed_to_${(payload.toStatus ?? '').toLowerCase()}`)
  }

  @OnEvent('clinical_note.created')
  onClinicalNoteCreated(payload: ClinicalNoteEventPayload) {
    return this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action: 'clinical_note.created',
      resource: 'ClinicalNote',
      resourceId: payload.noteId,
      after: { encounterId: payload.encounterId, version: payload.version },
    })
  }

  @OnEvent('prescription.created')
  onPrescriptionCreated(payload: PrescriptionEventPayload) {
    return this.persistPrescriptionEvent(payload, 'prescription.created')
  }

  @OnEvent('prescription.status_changed')
  onPrescriptionStatusChanged(payload: PrescriptionEventPayload) {
    return this.persistPrescriptionEvent(
      payload,
      `prescription.status_changed_to_${(payload.toStatus ?? '').toLowerCase()}`,
    )
  }

  @OnEvent('lab_test.ordered')
  onLabTestOrdered(payload: LabTestEventPayload) {
    return this.persistLabTestEvent(payload, 'lab_test.ordered')
  }

  @OnEvent('lab_test.status_changed')
  onLabTestStatusChanged(payload: LabTestEventPayload) {
    return this.persistLabTestEvent(payload, `lab_test.status_changed_to_${(payload.toStatus ?? '').toLowerCase()}`)
  }

  @OnEvent('lab_test.results_entered')
  onLabTestResultsEntered(payload: LabTestEventPayload) {
    return this.persistLabTestEvent(payload, 'lab_test.results_entered')
  }

  @OnEvent('radiology_order.ordered')
  onRadiologyOrderOrdered(payload: RadiologyOrderEventPayload) {
    return this.persistRadiologyOrderEvent(payload, 'radiology_order.ordered')
  }

  @OnEvent('radiology_order.status_changed')
  onRadiologyOrderStatusChanged(payload: RadiologyOrderEventPayload) {
    return this.persistRadiologyOrderEvent(
      payload,
      `radiology_order.status_changed_to_${(payload.toStatus ?? '').toLowerCase()}`,
    )
  }

  @OnEvent('radiology_order.report_drafted')
  onRadiologyOrderReportDrafted(payload: RadiologyOrderEventPayload) {
    return this.persistRadiologyOrderEvent(payload, 'radiology_order.report_drafted')
  }

  @OnEvent('dispense_order.created')
  onDispenseOrderCreated(payload: DispenseOrderEventPayload) {
    return this.persistDispenseOrderEvent(payload, 'dispense_order.created')
  }

  @OnEvent('dispense_order.status_changed')
  onDispenseOrderStatusChanged(payload: DispenseOrderEventPayload) {
    return this.persistDispenseOrderEvent(
      payload,
      `dispense_order.status_changed_to_${(payload.toStatus ?? '').toLowerCase()}`,
    )
  }

  @OnEvent('dispense_order.partially_dispensed')
  onDispenseOrderPartiallyDispensed(payload: DispenseOrderEventPayload) {
    return this.persistDispenseOrderEvent(payload, 'dispense_order.partially_dispensed')
  }

  @OnEvent('drug_return.created')
  onDrugReturnCreated(payload: DrugReturnEventPayload) {
    return this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action: 'drug_return.created',
      resource: 'DrugReturn',
      resourceId: payload.drugReturnId,
      after: { dispenseOrderId: payload.dispenseOrderId, patientId: payload.patientId },
    })
  }

  @OnEvent('charge.created')
  onChargeCreated(payload: ChargeEventPayload) {
    return this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action: 'charge.created',
      resource: 'Charge',
      resourceId: payload.chargeId,
      after: { patientId: payload.patientId, sourceModule: payload.sourceModule },
    })
  }

  @OnEvent('charge.voided')
  onChargeVoided(payload: ChargeEventPayload) {
    return this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action: 'charge.voided',
      resource: 'Charge',
      resourceId: payload.chargeId,
      after: { patientId: payload.patientId },
    })
  }

  @OnEvent('invoice.created')
  onInvoiceCreated(payload: InvoiceEventPayload) {
    return this.persistInvoiceEvent(payload, 'invoice.created')
  }

  @OnEvent('invoice.item_added')
  onInvoiceItemAdded(payload: InvoiceEventPayload) {
    return this.persistInvoiceEvent(payload, 'invoice.item_added')
  }

  @OnEvent('invoice.status_changed')
  onInvoiceStatusChanged(payload: InvoiceEventPayload) {
    return this.persistInvoiceEvent(payload, `invoice.status_changed_to_${(payload.toStatus ?? '').toLowerCase()}`)
  }

  @OnEvent('invoice.discount_requested')
  onInvoiceDiscountRequested(payload: InvoiceEventPayload) {
    return this.persistInvoiceEvent(payload, 'invoice.discount_requested')
  }

  @OnEvent('invoice.discount_approved')
  onInvoiceDiscountApproved(payload: InvoiceEventPayload) {
    return this.persistInvoiceEvent(payload, 'invoice.discount_approved')
  }

  @OnEvent('invoice.discount_rejected')
  onInvoiceDiscountRejected(payload: InvoiceEventPayload) {
    return this.persistInvoiceEvent(payload, 'invoice.discount_rejected')
  }

  @OnEvent('payment.recorded')
  onPaymentRecorded(payload: PaymentEventPayload) {
    return this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action: 'payment.recorded',
      resource: 'Payment',
      resourceId: payload.paymentId,
      after: { invoiceId: payload.invoiceId, patientId: payload.patientId, amount: payload.amount, paymentMode: payload.paymentMode },
    })
  }

  @OnEvent('refund.requested')
  onRefundRequested(payload: RefundEventPayload) {
    return this.persistRefundEvent(payload, 'refund.requested')
  }

  @OnEvent('refund.completed')
  onRefundCompleted(payload: RefundEventPayload) {
    return this.persistRefundEvent(payload, 'refund.completed')
  }

  @OnEvent('refund.rejected')
  onRefundRejected(payload: RefundEventPayload) {
    return this.persistRefundEvent(payload, 'refund.rejected')
  }

  @OnEvent('insurance.preauth_created')
  onPreAuthCreated(payload: PreAuthEventPayload) {
    return this.persistPreAuthEvent(payload, 'insurance.preauth_created')
  }

  @OnEvent('insurance.preauth_submitted')
  onPreAuthSubmitted(payload: PreAuthEventPayload) {
    return this.persistPreAuthEvent(payload, 'insurance.preauth_submitted')
  }

  @OnEvent('insurance.preauth_under_review')
  onPreAuthUnderReview(payload: PreAuthEventPayload) {
    return this.persistPreAuthEvent(payload, 'insurance.preauth_under_review')
  }

  @OnEvent('insurance.preauth_decided')
  onPreAuthDecided(payload: PreAuthEventPayload) {
    return this.persistPreAuthEvent(payload, `insurance.preauth_decided_${(payload.status ?? '').toLowerCase()}`)
  }

  @OnEvent('insurance.preauth_cancelled')
  onPreAuthCancelled(payload: PreAuthEventPayload) {
    return this.persistPreAuthEvent(payload, 'insurance.preauth_cancelled')
  }

  @OnEvent('insurance.preauth_attachment_uploaded')
  onPreAuthAttachmentUploaded(payload: PreAuthEventPayload) {
    return this.persistPreAuthEvent(payload, 'insurance.preauth_attachment_uploaded')
  }

  @OnEvent('insurance.claim_created')
  onClaimCreated(payload: ClaimEventPayload) {
    return this.persistClaimEvent(payload, 'insurance.claim_created')
  }

  @OnEvent('insurance.claim_submitted')
  onClaimSubmitted(payload: ClaimEventPayload) {
    return this.persistClaimEvent(payload, 'insurance.claim_submitted')
  }

  @OnEvent('insurance.claim_under_review')
  onClaimUnderReview(payload: ClaimEventPayload) {
    return this.persistClaimEvent(payload, 'insurance.claim_under_review')
  }

  @OnEvent('insurance.claim_decided')
  onClaimDecided(payload: ClaimEventPayload) {
    return this.persistClaimEvent(payload, `insurance.claim_decided_${(payload.status ?? '').toLowerCase()}`)
  }

  @OnEvent('insurance.claim_settled')
  onClaimSettled(payload: ClaimEventPayload) {
    return this.persistClaimEvent(payload, `insurance.claim_settled_${(payload.status ?? '').toLowerCase()}`)
  }

  @OnEvent('insurance.claim_closed')
  onClaimClosed(payload: ClaimEventPayload) {
    return this.persistClaimEvent(payload, 'insurance.claim_closed')
  }

  @OnEvent('ipd.admission_created')
  onAdmissionCreated(payload: AdmissionEventPayload) {
    return this.persistAdmissionEvent(payload, 'ipd.admission_created')
  }

  @OnEvent('ipd.admission_updated')
  onAdmissionUpdated(payload: AdmissionEventPayload) {
    return this.persistAdmissionEvent(payload, 'ipd.admission_updated')
  }

  @OnEvent('ipd.admission_cancelled')
  onAdmissionCancelled(payload: AdmissionEventPayload) {
    return this.persistAdmissionEvent(payload, 'ipd.admission_cancelled')
  }

  @OnEvent('ipd.bed_allocated')
  onBedAllocated(payload: BedAllocationEventPayload) {
    return this.persistBedAllocationEvent(payload, 'ipd.bed_allocated')
  }

  @OnEvent('ipd.bed_reserved')
  onBedReserved(payload: BedAllocationEventPayload) {
    return this.persistBedAllocationEvent(payload, 'ipd.bed_reserved')
  }

  @OnEvent('ipd.bed_reservation_cancelled')
  onBedReservationCancelled(payload: BedAllocationEventPayload) {
    return this.persistBedAllocationEvent(payload, 'ipd.bed_reservation_cancelled')
  }

  @OnEvent('ipd.bed_vacated')
  onBedVacated(payload: BedAllocationEventPayload) {
    return this.persistBedAllocationEvent(payload, 'ipd.bed_vacated')
  }

  @OnEvent('ipd.bed_transferred')
  onBedTransferred(payload: BedAllocationEventPayload) {
    return this.persistBedAllocationEvent(payload, 'ipd.bed_transferred')
  }

  @OnEvent('ipd.nursing_note_created')
  onNursingNoteCreated(payload: NursingNoteEventPayload) {
    return this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action: payload.isEscalated ? 'ipd.nursing_note_created_escalated' : 'ipd.nursing_note_created',
      resource: 'NursingNote',
      resourceId: payload.nursingNoteId,
      after: { admissionId: payload.admissionId, patientId: payload.patientId },
    })
  }

  @OnEvent('ipd.nursing_assessment_created')
  onNursingAssessmentCreated(payload: NursingAssessmentEventPayload) {
    return this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action: 'ipd.nursing_assessment_created',
      resource: 'NursingAssessment',
      resourceId: payload.nursingAssessmentId,
      after: {
        admissionId: payload.admissionId,
        patientId: payload.patientId,
        fallRiskLevel: payload.fallRiskLevel,
        bradenRiskLevel: payload.bradenRiskLevel,
      },
    })
  }

  @OnEvent('ipd.intake_output_recorded')
  onIntakeOutputRecorded(payload: IntakeOutputEventPayload) {
    return this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action: 'ipd.intake_output_recorded',
      resource: 'IntakeOutputRecord',
      resourceId: payload.intakeOutputRecordId,
      after: { admissionId: payload.admissionId, patientId: payload.patientId },
    })
  }

  @OnEvent('ipd.order_created')
  onIpdOrderCreated(payload: IpdOrderEventPayload) {
    return this.persistIpdOrderEvent(payload, 'ipd.order_created')
  }

  @OnEvent('ipd.order_discontinued')
  onIpdOrderDiscontinued(payload: IpdOrderEventPayload) {
    return this.persistIpdOrderEvent(payload, 'ipd.order_discontinued')
  }

  @OnEvent('ipd.nursing_task_created')
  onNursingTaskCreated(payload: NursingTaskEventPayload) {
    return this.persistNursingTaskEvent(payload, 'ipd.nursing_task_created')
  }

  @OnEvent('ipd.nursing_task_status_changed')
  onNursingTaskStatusChanged(payload: NursingTaskEventPayload) {
    return this.persistNursingTaskEvent(
      payload,
      `ipd.nursing_task_status_changed_to_${(payload.toStatus ?? '').toLowerCase()}`,
    )
  }

  @OnEvent('ipd.mar_scheduled')
  onMarScheduled(payload: MarScheduledEventPayload) {
    return this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action: 'ipd.mar_scheduled',
      resource: 'MedicationAdministration',
      resourceId: payload.prescriptionItemId,
      after: { admissionId: payload.admissionId, patientId: payload.patientId, count: payload.count },
    })
  }

  @OnEvent('ipd.mar_dose_created')
  onMarDoseCreated(payload: MedicationAdministrationEventPayload) {
    return this.persistMarDoseEvent(payload, 'ipd.mar_dose_created')
  }

  @OnEvent('ipd.mar_dose_status_changed')
  onMarDoseStatusChanged(payload: MedicationAdministrationEventPayload) {
    return this.persistMarDoseEvent(payload, `ipd.mar_dose_status_changed_to_${(payload.toStatus ?? '').toLowerCase()}`)
  }

  @OnEvent('ipd.discharge_approved')
  onDischargeApproved(payload: DischargeEventPayload) {
    return this.persistDischargeEvent(payload, 'ipd.discharge_approved')
  }

  @OnEvent('ipd.discharge_checklist_item_updated')
  onDischargeChecklistItemUpdated(payload: DischargeEventPayload) {
    return this.persistDischargeEvent(payload, 'ipd.discharge_checklist_item_updated')
  }

  @OnEvent('ipd.discharge_summary_saved')
  onDischargeSummarySaved(payload: DischargeEventPayload) {
    return this.persistDischargeEvent(payload, 'ipd.discharge_summary_saved')
  }

  @OnEvent('ipd.discharge_completed')
  onDischargeCompleted(payload: DischargeEventPayload) {
    return this.persistDischargeEvent(payload, 'ipd.discharge_completed')
  }

  // ── General Inventory & Procurement (Milestone 13 / ADR-0020) ───────────

  @OnEvent('purchase_request.created')
  onPurchaseRequestCreated(payload: PurchaseRequestEventPayload) {
    return this.persistPurchaseRequestEvent(payload, 'purchase_request.created')
  }

  @OnEvent('purchase_request.status_changed')
  onPurchaseRequestStatusChanged(payload: PurchaseRequestEventPayload) {
    return this.persistPurchaseRequestEvent(payload, 'purchase_request.status_changed')
  }

  @OnEvent('purchase_order.created')
  onPurchaseOrderCreated(payload: PurchaseOrderEventPayload) {
    return this.persistPurchaseOrderEvent(payload, 'purchase_order.created')
  }

  @OnEvent('purchase_order.status_changed')
  onPurchaseOrderStatusChanged(payload: PurchaseOrderEventPayload) {
    return this.persistPurchaseOrderEvent(payload, 'purchase_order.status_changed')
  }

  @OnEvent('goods_receipt_note.created')
  onGoodsReceiptNoteCreated(payload: GoodsReceiptNoteEventPayload) {
    return this.persistGoodsReceiptNoteEvent(payload, 'goods_receipt_note.created')
  }

  @OnEvent('goods_receipt_note.completed')
  onGoodsReceiptNoteCompleted(payload: GoodsReceiptNoteEventPayload) {
    return this.persistGoodsReceiptNoteEvent(payload, 'goods_receipt_note.completed')
  }

  @OnEvent('goods_receipt_note.cancelled')
  onGoodsReceiptNoteCancelled(payload: GoodsReceiptNoteEventPayload) {
    return this.persistGoodsReceiptNoteEvent(payload, 'goods_receipt_note.cancelled')
  }

  @OnEvent('vendor_return.created')
  onVendorReturnCreated(payload: VendorReturnEventPayload) {
    return this.persistVendorReturnEvent(payload, 'vendor_return.created')
  }

  @OnEvent('vendor_return.acknowledged')
  onVendorReturnAcknowledged(payload: VendorReturnEventPayload) {
    return this.persistVendorReturnEvent(payload, 'vendor_return.acknowledged')
  }

  @OnEvent('vendor_invoice.created')
  onVendorInvoiceCreated(payload: VendorInvoiceEventPayload) {
    return this.persistVendorInvoiceEvent(payload, 'vendor_invoice.created')
  }

  @OnEvent('vendor_invoice.status_changed')
  onVendorInvoiceStatusChanged(payload: VendorInvoiceEventPayload) {
    return this.persistVendorInvoiceEvent(payload, 'vendor_invoice.status_changed')
  }

  @OnEvent('store_requisition.created')
  onStoreRequisitionCreated(payload: StoreRequisitionEventPayload) {
    return this.persistStoreRequisitionEvent(payload, 'store_requisition.created')
  }

  @OnEvent('store_requisition.status_changed')
  onStoreRequisitionStatusChanged(payload: StoreRequisitionEventPayload) {
    return this.persistStoreRequisitionEvent(payload, 'store_requisition.status_changed')
  }

  @OnEvent('inventory_stock_transfer.created')
  onInventoryStockTransferCreated(payload: InventoryStockTransferEventPayload) {
    return this.persistInventoryStockTransferEvent(payload, 'inventory_stock_transfer.created')
  }

  @OnEvent('inventory_stock_transfer.status_changed')
  onInventoryStockTransferStatusChanged(payload: InventoryStockTransferEventPayload) {
    return this.persistInventoryStockTransferEvent(payload, 'inventory_stock_transfer.status_changed')
  }

  @OnEvent('asset.created')
  onAssetCreated(payload: AssetEventPayload) {
    return this.persistAssetEvent(payload, 'asset.created')
  }

  @OnEvent('asset.assigned')
  onAssetAssigned(payload: AssetEventPayload) {
    return this.persistAssetEvent(payload, 'asset.assigned')
  }

  @OnEvent('asset_maintenance.created')
  onAssetMaintenanceCreated(payload: AssetMaintenanceEventPayload) {
    return this.persistAssetMaintenanceEvent(payload, 'asset_maintenance.created')
  }

  @OnEvent('asset_maintenance.completed')
  onAssetMaintenanceCompleted(payload: AssetMaintenanceEventPayload) {
    return this.persistAssetMaintenanceEvent(payload, 'asset_maintenance.completed')
  }

  @OnEvent('stock_audit.created')
  onStockAuditCreated(payload: StockAuditEventPayload) {
    return this.persistStockAuditEvent(payload, 'stock_audit.created')
  }

  @OnEvent('stock_audit.status_changed')
  onStockAuditStatusChanged(payload: StockAuditEventPayload) {
    return this.persistStockAuditEvent(payload, 'stock_audit.status_changed')
  }

  private async persistIpdOrderEvent(payload: IpdOrderEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'IpdOrder',
      resourceId: payload.ipdOrderId,
      after: { admissionId: payload.admissionId, patientId: payload.patientId, category: payload.category },
    })
  }

  private async persistNursingTaskEvent(payload: NursingTaskEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'NursingTask',
      resourceId: payload.nursingTaskId,
      after: {
        admissionId: payload.admissionId,
        patientId: payload.patientId,
        priority: payload.priority,
        fromStatus: payload.fromStatus,
        toStatus: payload.toStatus,
      },
    })
  }

  private async persistMarDoseEvent(payload: MedicationAdministrationEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'MedicationAdministration',
      resourceId: payload.medicationAdministrationId,
      after: {
        admissionId: payload.admissionId,
        patientId: payload.patientId,
        type: payload.type,
        fromStatus: payload.fromStatus,
        toStatus: payload.toStatus,
      },
    })
  }

  private async persistDischargeEvent(payload: DischargeEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'Admission',
      resourceId: payload.admissionId,
      after: {
        patientId: payload.patientId,
        itemKey: payload.itemKey,
        completed: payload.completed,
        daysStayed: payload.daysStayed,
      },
    })
  }

  private async persistAdmissionEvent(payload: AdmissionEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'Admission',
      resourceId: payload.admissionId,
      after: { patientId: payload.patientId, attendingDoctorId: payload.attendingDoctorId, status: payload.status },
    })
  }

  private async persistBedAllocationEvent(payload: BedAllocationEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'Admission',
      resourceId: payload.admissionId,
      after: { bedId: payload.bedId, fromBedId: payload.fromBedId, toBedId: payload.toBedId, patientId: payload.patientId },
    })
  }

  private async persistPreAuthEvent(payload: PreAuthEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'PreAuthorization',
      resourceId: payload.preAuthId,
      after: { patientId: payload.patientId, status: payload.status },
    })
  }

  private async persistClaimEvent(payload: ClaimEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'InsuranceClaim',
      resourceId: payload.claimId,
      after: { patientId: payload.patientId, status: payload.status, insuranceShare: payload.insuranceShare },
    })
  }

  private async persistDoctorEvent(payload: DoctorEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'Doctor',
      resourceId: payload.doctorId,
    })
  }

  private async persistScheduleEvent(payload: DoctorScheduleEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'DoctorSchedule',
      resourceId: payload.scheduleId,
      after: { doctorId: payload.doctorId },
    })
  }

  private async persistLeaveEvent(payload: DoctorLeaveEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'DoctorLeave',
      resourceId: payload.leaveId,
      after: { doctorId: payload.doctorId },
    })
  }

  private async persistDoctorDocumentEvent(payload: DoctorDocumentEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'DoctorDocument',
      resourceId: payload.documentId,
      after: { doctorId: payload.doctorId },
    })
  }

  private async persistStaffEvent(payload: StaffEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'Staff',
      resourceId: payload.staffId,
      after: payload.status ? { status: payload.status } : undefined,
    })
  }

  private async persistStaffDocumentEvent(payload: StaffDocumentEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'StaffDocument',
      resourceId: payload.documentId,
      after: { staffId: payload.staffId },
    })
  }

  private async persistAttendanceEvent(payload: StaffAttendanceEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'Attendance',
      resourceId: payload.attendanceId,
      after: { staffId: payload.staffId },
    })
  }

  private async persistStaffLeaveEvent(payload: StaffLeaveEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'StaffLeave',
      resourceId: payload.leaveId,
      after: { staffId: payload.staffId },
    })
  }

  private async persistAppointmentEvent(payload: AppointmentEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'Appointment',
      resourceId: payload.appointmentId,
      after: { doctorId: payload.doctorId, patientId: payload.patientId, fromStatus: payload.fromStatus, toStatus: payload.toStatus },
    })
  }

  private async persistEncounterEvent(payload: EncounterEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'Encounter',
      resourceId: payload.encounterId,
      after: { doctorId: payload.doctorId, patientId: payload.patientId, fromStatus: payload.fromStatus, toStatus: payload.toStatus },
    })
  }

  private async persistPrescriptionEvent(payload: PrescriptionEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'Prescription',
      resourceId: payload.prescriptionId,
      after: {
        doctorId: payload.doctorId,
        patientId: payload.patientId,
        fromStatus: payload.fromStatus,
        toStatus: payload.toStatus,
      },
    })
  }

  private async persistLabTestEvent(payload: LabTestEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'LabTest',
      resourceId: payload.labTestId,
      after: {
        doctorId: payload.doctorId,
        patientId: payload.patientId,
        fromStatus: payload.fromStatus,
        toStatus: payload.toStatus,
      },
    })
  }

  private async persistRadiologyOrderEvent(payload: RadiologyOrderEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'RadiologyOrder',
      resourceId: payload.radiologyOrderId,
      after: {
        doctorId: payload.doctorId,
        patientId: payload.patientId,
        fromStatus: payload.fromStatus,
        toStatus: payload.toStatus,
        reason: payload.reason,
      },
    })
  }

  private async persistDispenseOrderEvent(payload: DispenseOrderEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'DispenseOrder',
      resourceId: payload.dispenseOrderId,
      after: {
        patientId: payload.patientId,
        fromStatus: payload.fromStatus,
        toStatus: payload.toStatus,
        reason: payload.reason,
      },
    })
  }

  private async persistInvoiceEvent(payload: InvoiceEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'Invoice',
      resourceId: payload.invoiceId,
      after: {
        patientId: payload.patientId,
        fromStatus: payload.fromStatus,
        toStatus: payload.toStatus,
        reason: payload.reason,
      },
    })
  }

  private async persistRefundEvent(payload: RefundEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'Refund',
      resourceId: payload.refundId,
      after: { invoiceId: payload.invoiceId, patientId: payload.patientId, amount: payload.amount, reason: payload.reason },
    })
  }

  private async persistPatientEvent(payload: PatientEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'Patient',
      resourceId: payload.patientId,
      after: payload.documentId ? { documentId: payload.documentId } : payload.metadata,
    })
  }

  private async persist(payload: AuthEventPayload, action: string, resource: string) {
    const organizationId = payload.orgId ?? (await this.resolveOrgId(payload.userId))
    if (!organizationId) {
      this.logger.warn(`Skipped audit log for "${action}" — no organization context available`)
      return
    }

    await this.auditService.record({
      organizationId,
      userId: payload.userId,
      action,
      resource,
      resourceId: payload.userId,
      after: payload.email ? { email: payload.email } : undefined,
    })
  }

  private async resolveOrgId(userId?: string): Promise<string | undefined> {
    if (!userId) return undefined
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    })
    return user?.organizationId
  }

  // ── General Inventory & Procurement (Milestone 13 / ADR-0020) ───────────

  private async persistPurchaseRequestEvent(payload: PurchaseRequestEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'PurchaseRequest',
      resourceId: payload.purchaseRequestId,
      after: { fromStatus: payload.fromStatus, toStatus: payload.toStatus, reason: payload.reason },
    })
  }

  private async persistPurchaseOrderEvent(payload: PurchaseOrderEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'PurchaseOrder',
      resourceId: payload.purchaseOrderId,
      after: { fromStatus: payload.fromStatus, toStatus: payload.toStatus, reason: payload.reason },
    })
  }

  private async persistGoodsReceiptNoteEvent(payload: GoodsReceiptNoteEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'GoodsReceiptNote',
      resourceId: payload.goodsReceiptNoteId,
    })
  }

  private async persistVendorReturnEvent(payload: VendorReturnEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'VendorReturn',
      resourceId: payload.vendorReturnId,
    })
  }

  private async persistVendorInvoiceEvent(payload: VendorInvoiceEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'VendorInvoice',
      resourceId: payload.vendorInvoiceId,
      after: { fromStatus: payload.fromStatus, toStatus: payload.toStatus },
    })
  }

  private async persistStoreRequisitionEvent(payload: StoreRequisitionEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'StoreRequisition',
      resourceId: payload.storeRequisitionId,
      after: { fromStatus: payload.fromStatus, toStatus: payload.toStatus, reason: payload.reason },
    })
  }

  private async persistInventoryStockTransferEvent(payload: InventoryStockTransferEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'InventoryStockTransfer',
      resourceId: payload.transferId,
      after: { fromStatus: payload.fromStatus, toStatus: payload.toStatus, reason: payload.reason },
    })
  }

  private async persistAssetEvent(payload: AssetEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'Asset',
      resourceId: payload.assetId,
      after: { assignedToUserId: payload.assignedToUserId, assignedToDepartmentId: payload.assignedToDepartmentId },
    })
  }

  private async persistAssetMaintenanceEvent(payload: AssetMaintenanceEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'AssetMaintenanceRecord',
      resourceId: payload.maintenanceRecordId,
      after: { assetId: payload.assetId, type: payload.type },
    })
  }

  private async persistStockAuditEvent(payload: StockAuditEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'StockAudit',
      resourceId: payload.stockAuditId,
      after: { fromStatus: payload.fromStatus, toStatus: payload.toStatus },
    })
  }
}
