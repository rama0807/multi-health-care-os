import {
  AdministerDoseDto,
  CreateAdHocDoseDto,
  GenerateScheduledDosesDto,
  MedicationAdministrationQuery,
  MedicationAdministrationStatus,
  MedicationAdministrationType,
  MedicationAdministrationWithDetails,
  RecordDoseExceptionDto,
} from '@medicore/types'
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { MedicationAdministration as PrismaMedicationAdministration, Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { AdmissionsService } from './admissions.service'

const WITH_ITEM_INCLUDE = {
  prescriptionItem: {
    select: { id: true, medicationName: true, dosage: true, route: true, frequency: true },
  },
} satisfies Prisma.MedicationAdministrationInclude

type DoseWithItem = PrismaMedicationAdministration & {
  prescriptionItem: { id: string; medicationName: string; dosage: string; route: string; frequency: string }
}

/**
 * Medication Administration Record — one row per scheduled/PRN/STAT dose
 * instance. Reuses `Prescription`/`PrescriptionItem` as the source of what's
 * prescribed (see ADR-0019); this service owns only the admin-log lifecycle.
 */
@Injectable()
export class MedicationAdministrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly admissionsService: AdmissionsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(organizationId: string, admissionId: string, query: MedicationAdministrationQuery) {
    await this.admissionsService.requireAdmission(organizationId, admissionId)
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 200) : 50

    const where: Prisma.MedicationAdministrationWhereInput = { admissionId, organizationId }
    if (query.prescriptionItemId) where.prescriptionItemId = query.prescriptionItemId
    if (query.type) where.type = query.type as unknown as Prisma.MedicationAdministrationWhereInput['type']
    if (query.status) where.status = query.status as unknown as Prisma.MedicationAdministrationWhereInput['status']

    const [data, total] = await Promise.all([
      this.prisma.medicationAdministration.findMany({
        where,
        include: WITH_ITEM_INCLUDE,
        orderBy: { scheduledAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.medicationAdministration.count({ where }),
    ])

    return {
      data: (data as DoseWithItem[]).map((d) => this.toResponse(d)),
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

  async generateScheduled(
    organizationId: string,
    admissionId: string,
    dto: GenerateScheduledDosesDto,
    actorUserId: string,
  ): Promise<{ created: number }> {
    const admission = await this.admissionsService.requireAdmission(organizationId, admissionId)
    if (admission.status !== 'ADMITTED') {
      throw new ConflictException('Doses can only be scheduled for an active admission')
    }
    const item = await this.requirePrescriptionItemForPatient(organizationId, dto.prescriptionItemId, admission.patientId)

    const startDate = dto.startDate ?? new Date()
    const rows: Prisma.MedicationAdministrationCreateManyInput[] = []
    for (let day = 0; day < dto.days; day++) {
      for (const time of dto.times) {
        const [hours, minutes] = time.split(':').map(Number)
        const scheduledAt = new Date(startDate)
        scheduledAt.setDate(scheduledAt.getDate() + day)
        scheduledAt.setHours(hours, minutes, 0, 0)
        rows.push({
          admissionId,
          prescriptionItemId: item.id,
          organizationId,
          type: 'SCHEDULED',
          scheduledAt,
          route: dto.route ?? item.route,
          createdByUserId: actorUserId,
        })
      }
    }

    const result = await this.prisma.medicationAdministration.createMany({ data: rows })

    this.eventEmitter.emit('ipd.mar_scheduled', {
      admissionId,
      prescriptionItemId: item.id,
      patientId: admission.patientId,
      organizationId,
      userId: actorUserId,
      count: result.count,
    })

    return { created: result.count }
  }

  async createAdHoc(
    organizationId: string,
    admissionId: string,
    dto: CreateAdHocDoseDto,
    actorUserId: string,
  ): Promise<MedicationAdministrationWithDetails> {
    const admission = await this.admissionsService.requireAdmission(organizationId, admissionId)
    if (admission.status !== 'ADMITTED') {
      throw new ConflictException('Doses can only be recorded for an active admission')
    }
    const item = await this.requirePrescriptionItemForPatient(organizationId, dto.prescriptionItemId, admission.patientId)

    const dose = await this.prisma.medicationAdministration.create({
      data: {
        admissionId,
        prescriptionItemId: item.id,
        organizationId,
        type: dto.type as unknown as Prisma.MedicationAdministrationCreateInput['type'],
        scheduledAt: dto.scheduledAt ?? new Date(),
        route: dto.route ?? item.route,
        notes: dto.notes,
        createdByUserId: actorUserId,
      },
      include: WITH_ITEM_INCLUDE,
    })

    this.eventEmitter.emit('ipd.mar_dose_created', {
      medicationAdministrationId: dose.id,
      admissionId,
      patientId: admission.patientId,
      organizationId,
      userId: actorUserId,
      type: dose.type,
    })

    return this.toResponse(dose as DoseWithItem)
  }

  async administer(
    organizationId: string,
    admissionId: string,
    doseId: string,
    dto: AdministerDoseDto,
    actorUserId: string,
  ): Promise<MedicationAdministrationWithDetails> {
    const dose = await this.requirePendingDose(organizationId, admissionId, doseId)

    const updated = await this.prisma.medicationAdministration.update({
      where: { id: doseId },
      data: {
        status: 'ADMINISTERED',
        administeredAt: new Date(),
        doseGiven: dto.doseGiven,
        route: dto.route ?? dose.route,
        notes: dto.notes,
        barcodeVerified: dto.barcodeVerified,
        scannedCode: dto.scannedCode,
        nurseSignature: dto.nurseSignature,
        administeredByUserId: actorUserId,
      },
      include: WITH_ITEM_INCLUDE,
    })

    this.eventEmitter.emit('ipd.mar_dose_status_changed', {
      medicationAdministrationId: dose.id,
      admissionId,
      organizationId,
      userId: actorUserId,
      fromStatus: dose.status,
      toStatus: 'ADMINISTERED',
    })

    return this.toResponse(updated as DoseWithItem)
  }

  async recordException(
    organizationId: string,
    admissionId: string,
    doseId: string,
    status: Exclude<MedicationAdministrationStatus, 'PENDING' | 'ADMINISTERED' | 'CANCELLED'>,
    dto: RecordDoseExceptionDto,
    actorUserId: string,
  ): Promise<MedicationAdministrationWithDetails> {
    const dose = await this.requirePendingDose(organizationId, admissionId, doseId)

    const updated = await this.prisma.medicationAdministration.update({
      where: { id: doseId },
      data: {
        status: status as unknown as Prisma.MedicationAdministrationUpdateInput['status'],
        notes: dto.notes,
        nurseSignature: dto.nurseSignature,
        administeredByUserId: actorUserId,
      },
      include: WITH_ITEM_INCLUDE,
    })

    this.eventEmitter.emit('ipd.mar_dose_status_changed', {
      medicationAdministrationId: dose.id,
      admissionId,
      organizationId,
      userId: actorUserId,
      fromStatus: dose.status,
      toStatus: status,
    })

    return this.toResponse(updated as DoseWithItem)
  }

  private async requirePendingDose(
    organizationId: string,
    admissionId: string,
    doseId: string,
  ): Promise<PrismaMedicationAdministration> {
    const dose = await this.prisma.medicationAdministration.findFirst({
      where: { id: doseId, admissionId, organizationId },
    })
    if (!dose) throw new NotFoundException('MAR entry not found')
    if (dose.status !== 'PENDING') {
      throw new ConflictException(`This dose is already recorded as ${dose.status.toLowerCase()}`)
    }
    return dose
  }

  private async requirePrescriptionItemForPatient(organizationId: string, prescriptionItemId: string, patientId: string) {
    const item = await this.prisma.prescriptionItem.findFirst({
      where: { id: prescriptionItemId, prescription: { organizationId, patientId } },
    })
    if (!item) throw new BadRequestException('Prescription item not found for this patient')
    return item
  }

  private toResponse(dose: DoseWithItem): MedicationAdministrationWithDetails {
    return {
      id: dose.id,
      admissionId: dose.admissionId,
      prescriptionItemId: dose.prescriptionItemId,
      organizationId: dose.organizationId,
      type: dose.type as unknown as MedicationAdministrationType,
      scheduledAt: dose.scheduledAt,
      administeredAt: dose.administeredAt,
      status: dose.status as unknown as MedicationAdministrationStatus,
      doseGiven: dose.doseGiven,
      route: dose.route,
      notes: dose.notes,
      barcodeVerified: dose.barcodeVerified,
      scannedCode: dose.scannedCode,
      administeredByUserId: dose.administeredByUserId,
      nurseSignature: dose.nurseSignature,
      createdByUserId: dose.createdByUserId,
      createdAt: dose.createdAt,
      updatedAt: dose.updatedAt,
      prescriptionItem: dose.prescriptionItem,
    }
  }
}
