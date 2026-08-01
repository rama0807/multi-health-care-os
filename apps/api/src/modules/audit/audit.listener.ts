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

  private async persistPatientEvent(payload: PatientEventPayload, action: string) {
    await this.auditService.record({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action,
      resource: 'Patient',
      resourceId: payload.patientId,
      after: payload.documentId ? { documentId: payload.documentId } : undefined,
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
}
