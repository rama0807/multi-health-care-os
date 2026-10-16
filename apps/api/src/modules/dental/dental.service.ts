/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await */
import { Injectable, NotFoundException } from '@nestjs/common'
import { DentalLabCaseStatus } from '@prisma/client'

import { StorageService } from '../../common/storage/storage.service'
import { PrismaService } from '../../prisma/prisma.service'

import type {
  CreateDentalChairDto,
  CreateDentalClinicalNoteDto,
  CreateDentalEncounterDto,
  CreateDentalImagingRecordDto,
  CreateDentalMedicalHistoryDto,
  CreateDentalPatientProfileDto,
  CreateDentalProcedureDto,
  CreateDentalRecallDto,
  CreateDentalSafetyAlertDto,
  CreateDentalVendorDto,
  CreateLabCaseDto,
  CreateOdontogramDto,
  CreateTreatmentPlanDto,
  RecordAcceptanceDto,
  UpdateDentalChairDto,
  UpdateDentalClinicalNoteDto,
  UpdateDentalEncounterDto,
  UpdateDentalPatientProfileDto,
  UpdateDentalVendorDto,
  UpdateLabCaseStatusDto,
} from './dto'


/**
 * Core service for all Dental OS data operations.
 *
 * Every query is scoped by `organizationId` — the same row-level isolation
 * pattern used throughout the Hospital modules. The `DentalGuard` at the
 * controller layer is defense-in-depth; the primary isolation boundary is here.
 */
@Injectable()
export class DentalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) { }

  // ═══════════════════════════════════════════════════════════════════════════
  // Patient Profile
  // ═══════════════════════════════════════════════════════════════════════════

  async getPatientProfile(orgId: string, patientId: string) {
    return this.prisma.dentalPatientProfile.findFirst({
      where: { organizationId: orgId, patientId },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, uhid: true, phone: true, dateOfBirth: true, gender: true } },
        medicalHistories: { orderBy: { recordedAt: 'desc' }, take: 1 },
        safetyAlerts: { where: { isActive: true }, orderBy: { createdAt: 'desc' } },
      },
    })
  }

  async createPatientProfile(orgId: string, dto: CreateDentalPatientProfileDto) {
    return this.prisma.dentalPatientProfile.create({
      data: { organizationId: orgId, ...dto },
    })
  }

  async updatePatientProfile(orgId: string, patientId: string, dto: UpdateDentalPatientProfileDto) {
    const profile = await this.prisma.dentalPatientProfile.findFirst({
      where: { organizationId: orgId, patientId },
    })
    if (!profile) throw new NotFoundException('Dental patient profile not found')

    return this.prisma.dentalPatientProfile.update({
      where: { id: profile.id },
      data: dto,
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Medical History & Safety Alerts
  // ═══════════════════════════════════════════════════════════════════════════

  private async ensureProfile(orgId: string, patientId: string) {
    await this.prisma.dentalPatientProfile.upsert({
      where: { patientId },
      create: {
        organizationId: orgId,
        patientId: patientId,
      },
      update: {}
    })
  }

  async createMedicalHistory(orgId: string, userId: string, dto: CreateDentalMedicalHistoryDto) {
    await this.ensureProfile(orgId, dto.patientId)
    return this.prisma.dentalMedicalHistory.create({
      data: {
        organizationId: orgId,
        patientId: dto.patientId,
        allergies: dto.allergies,
        currentMedications: dto.currentMedications,
        conditions: dto.conditions,
        isPregnant: dto.isPregnant,
        preMedicationNotes: dto.preMedicationNotes,
        emergencyContact: dto.emergencyContact,
        recordedByUserId: userId,
      },
    })
  }

  async createSafetyAlert(orgId: string, userId: string, dto: CreateDentalSafetyAlertDto) {
    await this.ensureProfile(orgId, dto.patientId)
    return this.prisma.dentalSafetyAlert.create({
      data: {
        organizationId: orgId,
        patientId: dto.patientId,
        alertType: dto.alertType,
        severity: dto.severity,
        description: dto.description,
        isActive: dto.isActive,
        createdByUserId: userId,
      },
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Imaging & CBCT/RVG
  // ═══════════════════════════════════════════════════════════════════════════

  async listImagingRecords(orgId: string, patientId: string) {
    return this.prisma.dentalImagingRecord.findMany({
      where: { organizationId: orgId, patientId },
      orderBy: { takenAt: 'desc' },
    })
  }

  async createImagingRecord(orgId: string, userId: string, dto: CreateDentalImagingRecordDto) {
    return this.prisma.dentalImagingRecord.create({
      data: {
        organizationId: orgId,
        patientId: dto.patientId,
        encounterId: dto.encounterId,
        imagingType: dto.imagingType,
        title: dto.title,
        storagePath: dto.storagePath,
        storageKey: dto.storageKey,
        mimeType: dto.mimeType,
        fileSizeBytes: dto.fileSizeBytes,
        notes: dto.notes,
        takenByUserId: userId,
      },
    })
  }

  async uploadImagingRecord(
    orgId: string,
    userId: string,
    patientId: string,
    dto: CreateDentalImagingRecordDto,
    file: { buffer: Buffer; fileName: string; mimeType: string; size: number }
  ) {
    const key = `dental-imaging/${orgId}/${patientId}/${Date.now()}-${file.fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const fileUrl = await this.storageService.upload({ key, buffer: file.buffer, mimeType: file.mimeType })

    return this.prisma.dentalImagingRecord.create({
      data: {
        organizationId: orgId,
        patientId,
        encounterId: dto.encounterId,
        imagingType: dto.imagingType,
        title: dto.title || `${dto.imagingType} Scan`,
        storagePath: fileUrl,
        storageKey: key,
        mimeType: file.mimeType,
        fileSizeBytes: file.size,
        notes: dto.notes,
        takenByUserId: userId,
      },
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Ledger / Billing
  // ═══════════════════════════════════════════════════════════════════════════

  async listLedger(orgId: string, patientId: string) {
    return this.prisma.invoice.findMany({
      where: { organizationId: orgId, patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        payments: true,
      }
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Chairs
  // ═══════════════════════════════════════════════════════════════════════════

  async listChairs(orgId: string) {
    return this.prisma.dentalChair.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { name: 'asc' },
    })
  }

  async createChair(orgId: string, dto: CreateDentalChairDto) {
    return this.prisma.dentalChair.create({
      data: { organizationId: orgId, ...dto },
    })
  }

  async updateChair(orgId: string, id: string, dto: UpdateDentalChairDto) {
    await this.findChairOrFail(orgId, id)
    return this.prisma.dentalChair.update({ where: { id }, data: dto })
  }

  private async findChairOrFail(orgId: string, id: string) {
    const chair = await this.prisma.dentalChair.findFirst({
      where: { id, organizationId: orgId },
    })
    if (!chair) throw new NotFoundException('Dental chair not found')
    return chair
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Encounters
  // ═══════════════════════════════════════════════════════════════════════════

  async listEncounters(orgId: string, patientId?: string, page = 1, limit = 20) {
    const where = { organizationId: orgId, ...(patientId ? { patientId } : {}) }
    const [data, total] = await Promise.all([
      this.prisma.dentalEncounter.findMany({
        where,
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, uhid: true } },
          chair: { select: { id: true, name: true } },
        },
        orderBy: { visitDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.dentalEncounter.count({ where }),
    ])
    return { data, total, page, limit }
  }

  async getEncounter(orgId: string, id: string) {
    const encounter = await this.prisma.dentalEncounter.findFirst({
      where: { id, organizationId: orgId },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, uhid: true, phone: true, dateOfBirth: true, gender: true } },
        chair: { select: { id: true, name: true } },
        clinicalNotes: { orderBy: { createdAt: 'desc' } },
        odontograms: { include: { teeth: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        procedures: { orderBy: { performedAt: 'desc' } },
        imagingRecords: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!encounter) throw new NotFoundException('Dental encounter not found')
    return encounter
  }

  async createEncounter(orgId: string, _userId: string, dto: CreateDentalEncounterDto) {
    return this.prisma.dentalEncounter.create({
      data: {
        organizationId: orgId,
        dentistId: dto.dentistId,
        patientId: dto.patientId,
        appointmentId: dto.appointmentId,
        chairId: dto.chairId,
        assistantId: dto.assistantId,
        chiefComplaint: dto.chiefComplaint,
        visitDate: dto.visitDate ?? new Date(),
      },
    })
  }

  async updateEncounter(orgId: string, id: string, dto: UpdateDentalEncounterDto) {
    await this.findEncounterOrFail(orgId, id)
    return this.prisma.dentalEncounter.update({ where: { id }, data: dto })
  }

  private async findEncounterOrFail(orgId: string, id: string) {
    const encounter = await this.prisma.dentalEncounter.findFirst({
      where: { id, organizationId: orgId },
    })
    if (!encounter) throw new NotFoundException('Dental encounter not found')
    return encounter
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Clinical Notes
  // ═══════════════════════════════════════════════════════════════════════════

  async createClinicalNote(orgId: string, userId: string, dto: CreateDentalClinicalNoteDto) {
    return this.prisma.dentalClinicalNote.create({
      data: {
        organizationId: orgId,
        createdByUserId: userId,
        encounterId: dto.encounterId,
        patientId: dto.patientId,
        templateId: dto.templateId,
        subjective: dto.subjective,
        objective: dto.objective,
        assessment: dto.assessment,
        plan: dto.plan,
        additionalNotes: dto.additionalNotes,
      },
    })
  }

  async updateClinicalNote(orgId: string, id: string, dto: UpdateDentalClinicalNoteDto) {
    const note = await this.prisma.dentalClinicalNote.findFirst({
      where: { id, organizationId: orgId },
    })
    if (!note) throw new NotFoundException('Clinical note not found')
    if (note.isSigned) throw new NotFoundException('Cannot edit a signed note')

    return this.prisma.dentalClinicalNote.update({ where: { id }, data: dto })
  }

  async signClinicalNote(orgId: string, id: string, userId: string) {
    const note = await this.prisma.dentalClinicalNote.findFirst({
      where: { id, organizationId: orgId },
    })
    if (!note) throw new NotFoundException('Clinical note not found')

    return this.prisma.dentalClinicalNote.update({
      where: { id },
      data: { isSigned: true, signedAt: new Date(), signedByUserId: userId },
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Odontogram
  // ═══════════════════════════════════════════════════════════════════════════

  async getLatestOdontogram(orgId: string, patientId: string) {
    return this.prisma.odontogram.findFirst({
      where: { organizationId: orgId, patientId },
      include: { teeth: { orderBy: { toothNumber: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async createOdontogram(orgId: string, userId: string, dto: CreateOdontogramDto) {
    return this.prisma.odontogram.create({
      data: {
        organizationId: orgId,
        patientId: dto.patientId,
        encounterId: dto.encounterId,
        recordedByUserId: userId,
        notes: dto.notes,
        teeth: {
          create: dto.teeth.map((t) => ({
            toothNumber: t.toothNumber,
            condition: t.condition,
            surfaces: t.surfaces,
            notes: t.notes,
          })),
        },
      },
      include: { teeth: { orderBy: { toothNumber: 'asc' } } },
    })
  }

  async getToothHistory(orgId: string, patientId: string, toothNumber: number) {
    return this.prisma.toothHistory.findMany({
      where: { organizationId: orgId, patientId, toothNumber },
      orderBy: { recordedAt: 'desc' },
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Treatment Plans
  // ═══════════════════════════════════════════════════════════════════════════

  async listTreatmentPlans(orgId: string, patientId?: string) {
    return this.prisma.dentalTreatmentPlan.findMany({
      where: { organizationId: orgId, ...(patientId ? { patientId } : {}) },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, uhid: true } },
        options: {
          include: {
            acceptance: true,
            treatmentPlan: true
          },
          orderBy: { label: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getTreatmentPlan(orgId: string, id: string) {
    const plan = await this.prisma.dentalTreatmentPlan.findFirst({
      where: { id, organizationId: orgId },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, uhid: true } },
        options: {
          include: {
            treatmentPlan: true,
            acceptance: true,
          },
          orderBy: { label: 'asc' },
        },
      },
    })
    if (!plan) throw new NotFoundException('Treatment plan not found')
    return plan
  }

  async createTreatmentPlan(orgId: string, userId: string, dto: CreateTreatmentPlanDto) {
    return this.prisma.dentalTreatmentPlan.create({
      data: {
        organizationId: orgId,
        createdByUserId: userId,
        patientId: dto.patientId,
        encounterId: dto.encounterId,
        title: dto.title,
        description: dto.description,
        expiresAt: dto.expiresAt,
        notes: dto.notes,
        options: {
          create: dto.options.map((opt) => ({
            label: opt.label,
            totalCost: opt.totalCost,
            discount: opt.discount,
            netCost: opt.netCost,
            notes: opt.notes,
            treatmentPlan: {
              create: opt.items.map((item) => ({
                toothNumber: item.toothNumber,
                surfaces: item.surfaces,
                procedureName: item.procedureName,
                procedureCode: item.procedureCode,
                sequence: item.sequence,
                estimatedCost: item.estimatedCost,
                estimatedVisits: item.estimatedVisits,
                durationMinutes: item.durationMinutes,
                notes: item.notes,
              })),
            },
          })),
        },
      },
      include: { options: { include: { treatmentPlan: true } } },
    })
  }

  async recordAcceptance(orgId: string, userId: string, patientId: string, dto: RecordAcceptanceDto) {
    const data = {
      status: dto.status,
      acceptedAt: dto.status === 'ACCEPTED' ? new Date() : null,
      declinedAt: dto.status === 'DECLINED' ? new Date() : null,
      callbackDate: dto.callbackDate,
      notes: dto.notes,
      recordedByUserId: userId,
    }

    return this.prisma.treatmentAcceptance.upsert({
      where: { optionId: dto.optionId },
      create: {
        organizationId: orgId,
        optionId: dto.optionId,
        patientId,
        ...data,
      },
      update: data,
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Procedures
  // ═══════════════════════════════════════════════════════════════════════════

  async createProcedure(orgId: string, userId: string, dto: CreateDentalProcedureDto) {
    return this.prisma.dentalProcedure.create({
      data: {
        organizationId: orgId,
        performedByUserId: userId,
        patientId: dto.patientId,
        encounterId: dto.encounterId,
        toothNumber: dto.toothNumber,
        surfaces: dto.surfaces,
        procedureName: dto.procedureName,
        procedureCode: dto.procedureCode,
        cost: dto.cost,
        notes: dto.notes,
      },
    })
  }

  async listProcedures(orgId: string, patientId?: string, encounterId?: string) {
    return this.prisma.dentalProcedure.findMany({
      where: {
        organizationId: orgId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, uhid: true } },
      },
      orderBy: { performedAt: 'desc' },
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Vendors
  // ═══════════════════════════════════════════════════════════════════════════

  async listVendors(orgId: string) {
    return this.prisma.dentalVendor.findMany({
      where: { organizationId: orgId },
      orderBy: { name: 'asc' },
    })
  }

  async getVendor(orgId: string, id: string) {
    const vendor = await this.prisma.dentalVendor.findFirst({
      where: { id, organizationId: orgId },
    })
    if (!vendor) throw new NotFoundException('Vendor not found')
    return vendor
  }

  async createVendor(orgId: string, dto: CreateDentalVendorDto) {
    return this.prisma.dentalVendor.create({
      data: { organizationId: orgId, ...dto },
    })
  }

  async updateVendor(orgId: string, id: string, dto: UpdateDentalVendorDto) {
    await this.getVendor(orgId, id)
    return this.prisma.dentalVendor.update({ where: { id }, data: dto })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Lab Cases
  // ═══════════════════════════════════════════════════════════════════════════

  async listLabCases(orgId: string, patientId?: string, status?: DentalLabCaseStatus) {
    return this.prisma.dentalLabCase.findMany({
      where: {
        organizationId: orgId,
        ...(patientId ? { patientId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, uhid: true } },
        vendor: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getLabCase(orgId: string, id: string) {
    const labCase = await this.prisma.dentalLabCase.findFirst({
      where: { id, organizationId: orgId },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, uhid: true } },
        vendor: true,
        measurements: { orderBy: { toothNumber: 'asc' } },
        timeline: { orderBy: { occurredAt: 'desc' } },
        pickups: { orderBy: { createdAt: 'desc' } },
        receivings: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!labCase) throw new NotFoundException('Lab case not found')
    return labCase
  }

  async createLabCase(orgId: string, userId: string, dto: CreateLabCaseDto) {
    return this.prisma.dentalLabCase.create({
      data: {
        organizationId: orgId,
        createdByUserId: userId,
        patientId: dto.patientId,
        procedureId: dto.procedureId,
        vendorId: dto.vendorId,
        restorationName: dto.restorationName,
        notes: dto.notes,
        measurements: dto.measurements
          ? {
            create: dto.measurements.map((m) => ({
              organizationId: orgId,
              toothNumber: m.toothNumber,
              restorationMaterial: m.restorationMaterial,
              shade: m.shade,
              shadeSystem: m.shadeSystem,
              measurements: (m.measurements ?? {}) as any,
              impressionType: m.impressionType,
              scanInfo: m.scanInfo,
              notes: m.notes,
              recordedByUserId: userId,
            })),
          }
          : undefined,
        timeline: {
          create: { status: 'DRAFT', userId, notes: 'Lab case created' },
        },
      },
      include: { measurements: true, timeline: true },
    })
  }

  async updateLabCaseStatus(orgId: string, id: string, userId: string, dto: UpdateLabCaseStatusDto) {
    await this.getLabCase(orgId, id)

    return this.prisma.$transaction([
      this.prisma.dentalLabCase.update({
        where: { id },
        data: { status: dto.status as DentalLabCaseStatus },
      }),
      this.prisma.dentalLabCaseTimeline.create({
        data: {
          labCaseId: id,
          status: dto.status as DentalLabCaseStatus,
          userId,
          notes: dto.notes,
        },
      }),
    ])
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Recalls
  // ═══════════════════════════════════════════════════════════════════════════

  async listRecalls(orgId: string, patientId?: string) {
    return this.prisma.dentalRecall.findMany({
      where: {
        organizationId: orgId,
        ...(patientId ? { patientId } : {}),
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, uhid: true, phone: true } },
      },
      orderBy: { dueDate: 'asc' },
    })
  }

  async createRecall(orgId: string, userId: string, dto: CreateDentalRecallDto) {
    return this.prisma.dentalRecall.create({
      data: {
        organizationId: orgId,
        createdByUserId: userId,
        patientId: dto.patientId,
        recallType: dto.recallType,
        dueDate: dto.dueDate,
        notes: dto.notes,
      },
    })
  }


}
