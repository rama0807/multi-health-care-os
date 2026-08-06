import {
  ApproveDischargeDto,
  ChargeSourceModule,
  CompleteDischargeDto,
  DischargeChecklistItem,
  DischargeChecklistItemKey,
  DischargeSummaryWithDetails,
  EncounterStatus,
  UpdateDischargeChecklistItemDto,
  UpsertDischargeSummaryDto,
} from '@medicore/types'
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { DischargeChecklistItem as PrismaDischargeChecklistItem, Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'
import { ChargesService } from '../billing/charges.service'
import { EncountersService } from '../medical-records/encounters.service'
import { DoctorRefService } from '../scheduling/doctor-ref.service'

import { AdmissionsService } from './admissions.service'
import { BedAllocationService } from './bed-allocation.service'
import { generateDischargeSummaryPdf } from './discharge-summary-pdf'

const SUMMARY_WITH_RELATIONS_INCLUDE = {
  followUpDoctor: {
    select: { id: true, specialization: true, user: { select: { firstName: true, lastName: true } } },
  },
  dischargePrescription: { select: { id: true, prescriptionNumber: true } },
} satisfies Prisma.DischargeSummaryInclude

/**
 * Discharge workflow - doctor approval → nursing checklist + discharge
 * summary → finalize (vacates the bed, raises the per-stay room charge,
 * closes the encounter, sets `AdmissionStatus.DISCHARGED`). See ADR-0019.
 */
@Injectable()
export class DischargeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly admissionsService: AdmissionsService,
    private readonly bedAllocationService: BedAllocationService,
    private readonly chargesService: ChargesService,
    private readonly encountersService: EncountersService,
    private readonly doctorRef: DoctorRefService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async approve(organizationId: string, admissionId: string, dto: ApproveDischargeDto, actorUserId: string) {
    const admission = await this.admissionsService.requireAdmission(organizationId, admissionId)
    if (admission.status !== 'ADMITTED') {
      throw new ConflictException('Only an active admission can be approved for discharge')
    }
    if (admission.dischargeApprovedAt) {
      throw new ConflictException('Discharge has already been approved for this admission')
    }

    await this.prisma.$transaction([
      this.prisma.admission.update({
        where: { id: admissionId },
        data: {
          dischargeApprovedAt: new Date(),
          dischargeApprovedByUserId: actorUserId,
          dischargeCondition: dto.dischargeCondition,
          expectedDischargeAt: dto.expectedDischargeAt ?? admission.expectedDischargeAt,
        },
      }),
      this.prisma.dischargeChecklistItem.createMany({
        data: Object.values(DischargeChecklistItemKey).map((itemKey) => ({
          admissionId,
          organizationId,
          itemKey: itemKey as unknown as Prisma.DischargeChecklistItemCreateManyInput['itemKey'],
        })),
        skipDuplicates: true,
      }),
    ])

    this.eventEmitter.emit('ipd.discharge_approved', {
      admissionId,
      patientId: admission.patientId,
      organizationId,
      userId: actorUserId,
    })

    return this.admissionsService.getById(organizationId, admissionId)
  }

  async listChecklist(organizationId: string, admissionId: string): Promise<DischargeChecklistItem[]> {
    await this.admissionsService.requireAdmission(organizationId, admissionId)
    const items = await this.prisma.dischargeChecklistItem.findMany({
      where: { admissionId, organizationId },
      orderBy: { itemKey: 'asc' },
    })
    return items.map((i) => this.toChecklistResponse(i))
  }

  async updateChecklistItem(
    organizationId: string,
    admissionId: string,
    itemKey: DischargeChecklistItemKey,
    dto: UpdateDischargeChecklistItemDto,
    actorUserId: string,
  ): Promise<DischargeChecklistItem> {
    const admission = await this.admissionsService.requireAdmission(organizationId, admissionId)
    if (!admission.dischargeApprovedAt) {
      throw new BadRequestException('Discharge must be approved by the attending doctor first')
    }

    const item = await this.prisma.dischargeChecklistItem.findFirst({
      where: { admissionId, organizationId, itemKey: itemKey as unknown as Prisma.DischargeChecklistItemWhereInput['itemKey'] },
    })
    if (!item) throw new NotFoundException('Checklist item not found')

    const updated = await this.prisma.dischargeChecklistItem.update({
      where: { id: item.id },
      data: {
        completed: dto.completed,
        notes: dto.notes,
        completedByUserId: dto.completed ? actorUserId : null,
        completedAt: dto.completed ? new Date() : null,
      },
    })

    this.eventEmitter.emit('ipd.discharge_checklist_item_updated', {
      admissionId,
      organizationId,
      userId: actorUserId,
      itemKey,
      completed: dto.completed,
    })

    return this.toChecklistResponse(updated)
  }

  async getSummary(organizationId: string, admissionId: string): Promise<DischargeSummaryWithDetails | null> {
    await this.admissionsService.requireAdmission(organizationId, admissionId)
    const summary = await this.prisma.dischargeSummary.findFirst({
      where: { admissionId, organizationId },
      include: SUMMARY_WITH_RELATIONS_INCLUDE,
    })
    return summary ? this.toSummaryResponse(summary) : null
  }

  async upsertSummary(
    organizationId: string,
    admissionId: string,
    dto: UpsertDischargeSummaryDto,
    actorUserId: string,
  ): Promise<DischargeSummaryWithDetails> {
    const admission = await this.admissionsService.requireAdmission(organizationId, admissionId)
    if (admission.status !== 'ADMITTED') {
      throw new ConflictException('Discharge summary can only be edited on an active admission')
    }

    if (dto.followUpDoctorId) await this.doctorRef.requireDoctor(organizationId, dto.followUpDoctorId)
    if (dto.dischargePrescriptionId) {
      const prescription = await this.prisma.prescription.findFirst({
        where: { id: dto.dischargePrescriptionId, organizationId, patientId: admission.patientId },
      })
      if (!prescription) throw new NotFoundException('Discharge prescription not found for this patient')
    }

    const summary = await this.prisma.dischargeSummary.upsert({
      where: { admissionId },
      create: {
        admissionId,
        organizationId,
        finalDiagnosis: dto.finalDiagnosis,
        courseInHospital: dto.courseInHospital,
        proceduresPerformed: dto.proceduresPerformed,
        conditionAtDischarge: dto.conditionAtDischarge,
        medicationReconciliation: dto.medicationReconciliation,
        followUpInstructions: dto.followUpInstructions,
        followUpAppointmentAt: dto.followUpAppointmentAt,
        followUpDoctorId: dto.followUpDoctorId,
        dischargePrescriptionId: dto.dischargePrescriptionId,
        preparedByUserId: actorUserId,
      },
      update: {
        finalDiagnosis: dto.finalDiagnosis,
        courseInHospital: dto.courseInHospital,
        proceduresPerformed: dto.proceduresPerformed,
        conditionAtDischarge: dto.conditionAtDischarge,
        medicationReconciliation: dto.medicationReconciliation,
        followUpInstructions: dto.followUpInstructions,
        followUpAppointmentAt: dto.followUpAppointmentAt,
        followUpDoctorId: dto.followUpDoctorId,
        dischargePrescriptionId: dto.dischargePrescriptionId,
        preparedByUserId: actorUserId,
      },
      include: SUMMARY_WITH_RELATIONS_INCLUDE,
    })

    this.eventEmitter.emit('ipd.discharge_summary_saved', {
      admissionId,
      patientId: admission.patientId,
      organizationId,
      userId: actorUserId,
    })

    return this.toSummaryResponse(summary)
  }

  async generateSummaryPdf(organizationId: string, admissionId: string): Promise<{ buffer: Buffer; fileName: string }> {
    const admission = await this.admissionsService.getById(organizationId, admissionId)
    const summary = await this.prisma.dischargeSummary.findFirst({
      where: { admissionId, organizationId },
      include: SUMMARY_WITH_RELATIONS_INCLUDE,
    })
    if (!summary) throw new NotFoundException('Discharge summary has not been prepared yet')
    if (!admission.dischargedAt) throw new BadRequestException('Discharge summary PDF is available once discharge is finalized')

    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })

    const buffer = await generateDischargeSummaryPdf({
      admissionNumber: admission.admissionNumber,
      admittedAt: admission.admittedAt,
      dischargedAt: admission.dischargedAt,
      organization: { name: org.name, address: org.address, phone: org.phone, email: org.email },
      patient: { fullName: admission.patient.fullName, uhid: admission.patient.uhid },
      attendingDoctor: {
        fullName: admission.attendingDoctor.fullName,
        specialization: admission.attendingDoctor.specialization,
      },
      ward: { name: admission.ward.name },
      admissionReason: admission.admissionReason,
      finalDiagnosis: summary.finalDiagnosis,
      courseInHospital: summary.courseInHospital,
      proceduresPerformed: summary.proceduresPerformed,
      conditionAtDischarge: summary.conditionAtDischarge,
      medicationReconciliation: summary.medicationReconciliation,
      followUpInstructions: summary.followUpInstructions,
      followUpAppointmentAt: summary.followUpAppointmentAt,
      followUpDoctor: summary.followUpDoctor
        ? {
            fullName: `${summary.followUpDoctor.user.firstName} ${summary.followUpDoctor.user.lastName}`,
            specialization: summary.followUpDoctor.specialization,
          }
        : null,
      dischargePrescription: summary.dischargePrescription
        ? { prescriptionNumber: summary.dischargePrescription.prescriptionNumber }
        : null,
    })

    return { buffer, fileName: `${admission.admissionNumber}-discharge-summary.pdf` }
  }

  /**
   * Finalizes discharge: vacates the bed (reuses `BedAllocationService.vacate`'s
   * bed→CLEANING pattern), raises a per-stay room charge via the Charge Engine
   * (days stayed × `Room.chargesPerDay` - elapsed time from `admittedAt` to now,
   * rounded up to the next whole day, minimum 1 day), closes the encounter, and
   * sets `AdmissionStatus.DISCHARGED`.
   */
  async complete(organizationId: string, admissionId: string, dto: CompleteDischargeDto, actorUserId: string) {
    const admission = await this.admissionsService.requireAdmission(organizationId, admissionId)
    if (admission.status !== 'ADMITTED') {
      throw new ConflictException(`Admission is already ${admission.status.toLowerCase()}`)
    }
    if (!admission.dischargeApprovedAt) {
      throw new BadRequestException('Discharge must be approved by the attending doctor first')
    }

    const checklist = await this.prisma.dischargeChecklistItem.findMany({ where: { admissionId, organizationId } })
    const incomplete = checklist.filter((i) => !i.completed)
    if (incomplete.length > 0) {
      throw new ConflictException(`${incomplete.length} discharge checklist item(s) are not yet complete`)
    }

    const summary = await this.prisma.dischargeSummary.findFirst({ where: { admissionId, organizationId } })
    if (!summary) {
      throw new BadRequestException('A discharge summary with a final diagnosis must be prepared first')
    }

    if (admission.bedId) {
      await this.bedAllocationService.vacate(organizationId, admissionId, { reason: 'Discharged' }, actorUserId)
    }

    const dischargedAt = new Date()
    const daysStayed = Math.max(
      1,
      Math.ceil((dischargedAt.getTime() - admission.admittedAt.getTime()) / (24 * 60 * 60 * 1000)),
    )

    if (admission.roomId) {
      const room = await this.prisma.room.findUnique({ where: { id: admission.roomId }, include: { ward: true } })
      if (room) {
        await this.chargesService.create(
          organizationId,
          {
            patientId: admission.patientId,
            encounterId: admission.encounterId ?? undefined,
            sourceModule: ChargeSourceModule.IPD,
            sourceId: admission.id,
            description: `Room charges - ${room.ward.name} (${daysStayed} day${daysStayed > 1 ? 's' : ''})`,
            quantity: daysStayed,
            unitPrice: Number(room.chargesPerDay),
            discountPercent: 0,
          },
          actorUserId,
        )
      }
    }

    if (admission.encounterId) {
      const encounter = await this.prisma.encounter.findUnique({ where: { id: admission.encounterId } })
      if (encounter && encounter.status !== 'COMPLETED') {
        await this.encountersService.updateStatus(
          organizationId,
          admission.encounterId,
          { status: EncounterStatus.COMPLETED },
          actorUserId,
        )
      }
    }

    await this.prisma.admission.update({
      where: { id: admissionId },
      data: {
        status: 'DISCHARGED',
        dischargedAt,
        dischargeNotes: dto.dischargeNotes,
        dischargeCondition: dto.dischargeCondition ?? admission.dischargeCondition,
      },
    })

    this.eventEmitter.emit('ipd.discharge_completed', {
      admissionId,
      patientId: admission.patientId,
      organizationId,
      userId: actorUserId,
      daysStayed,
    })

    return this.admissionsService.getById(organizationId, admissionId)
  }

  private toChecklistResponse(item: PrismaDischargeChecklistItem): DischargeChecklistItem {
    return {
      id: item.id,
      admissionId: item.admissionId,
      organizationId: item.organizationId,
      itemKey: item.itemKey as unknown as DischargeChecklistItemKey,
      completed: item.completed,
      completedByUserId: item.completedByUserId,
      completedAt: item.completedAt,
      notes: item.notes,
      createdAt: item.createdAt,
    }
  }

  private toSummaryResponse(summary: {
    id: string
    admissionId: string
    organizationId: string
    finalDiagnosis: string
    courseInHospital: string | null
    proceduresPerformed: string | null
    conditionAtDischarge: string | null
    medicationReconciliation: string | null
    followUpInstructions: string | null
    followUpAppointmentAt: Date | null
    followUpDoctorId: string | null
    dischargePrescriptionId: string | null
    preparedByUserId: string | null
    createdAt: Date
    updatedAt: Date
    followUpDoctor: { id: string; specialization: string; user: { firstName: string; lastName: string } } | null
    dischargePrescription: { id: string; prescriptionNumber: string } | null
  }): DischargeSummaryWithDetails {
    return {
      id: summary.id,
      admissionId: summary.admissionId,
      organizationId: summary.organizationId,
      finalDiagnosis: summary.finalDiagnosis,
      courseInHospital: summary.courseInHospital,
      proceduresPerformed: summary.proceduresPerformed,
      conditionAtDischarge: summary.conditionAtDischarge,
      medicationReconciliation: summary.medicationReconciliation,
      followUpInstructions: summary.followUpInstructions,
      followUpAppointmentAt: summary.followUpAppointmentAt,
      followUpDoctorId: summary.followUpDoctorId,
      dischargePrescriptionId: summary.dischargePrescriptionId,
      preparedByUserId: summary.preparedByUserId,
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt,
      followUpDoctor: summary.followUpDoctor
        ? {
            id: summary.followUpDoctor.id,
            fullName: `${summary.followUpDoctor.user.firstName} ${summary.followUpDoctor.user.lastName}`,
            specialization: summary.followUpDoctor.specialization,
          }
        : null,
      dischargePrescription: summary.dischargePrescription,
    }
  }
}
