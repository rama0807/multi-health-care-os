import {
  CreatePrescriptionDto,
  DrugInteractionWarning,
  JwtPayload,
  Prescription,
  PrescriptionQuery,
  PrescriptionStatus,
  PrescriptionWithItems,
  UpdatePrescriptionStatusDto,
} from '@medicore/types'
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import {
  Prescription as PrismaPrescription,
  PrescriptionItem as PrismaPrescriptionItem,
  PrescriptionStatus as PrismaPrescriptionStatus,
  Prisma,
} from '@prisma/client'

import { PermissionsService } from '../../common/permissions/permissions.service'
import { PrismaService } from '../../prisma/prisma.service'
import { EncountersService } from '../medical-records/encounters.service'
import { DoctorRefService } from '../scheduling/doctor-ref.service'

import { checkDrugInteractions } from './drug-interactions'
import { generatePrescriptionPdf } from './prescription-pdf'

/** ACTIVE is the only entry state; both COMPLETED and DISCONTINUED are terminal. */
const ALLOWED_TRANSITIONS: Record<PrescriptionStatus, PrescriptionStatus[]> = {
  [PrescriptionStatus.ACTIVE]: [PrescriptionStatus.COMPLETED, PrescriptionStatus.DISCONTINUED],
  [PrescriptionStatus.COMPLETED]: [],
  [PrescriptionStatus.DISCONTINUED]: [],
}

type PrescriptionWithRelations = PrismaPrescription & {
  items: PrismaPrescriptionItem[]
  patient: { id: string; firstName: string; lastName: string; uhid: string }
  doctor: { id: string; specialization: string; user: { firstName: string; lastName: string } }
}

const PRESCRIPTION_WITH_RELATIONS_INCLUDE = {
  items: true,
  patient: { select: { id: true, firstName: true, lastName: true, uhid: true } },
  doctor: { select: { id: true, specialization: true, user: { select: { firstName: true, lastName: true } } } },
} satisfies Prisma.PrescriptionInclude

@Injectable()
export class PrescriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encountersService: EncountersService,
    private readonly doctorRef: DoctorRefService,
    private readonly permissionsService: PermissionsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(organizationId: string, query: PrescriptionQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20

    const where: Prisma.PrescriptionWhereInput = { organizationId }
    if (query.patientId) where.patientId = query.patientId
    if (query.doctorId) where.doctorId = query.doctorId
    if (query.encounterId) where.encounterId = query.encounterId
    if (query.status) where.status = query.status as unknown as PrismaPrescriptionStatus

    const [data, total] = await Promise.all([
      this.prisma.prescription.findMany({
        where,
        include: PRESCRIPTION_WITH_RELATIONS_INCLUDE,
        orderBy: { prescribedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.prescription.count({ where }),
    ])

    return {
      data: data.map((p) => this.toResponse(p)),
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

  async getById(organizationId: string, id: string): Promise<PrescriptionWithItems> {
    const prescription = await this.requirePrescriptionWithRelations(organizationId, id)
    return this.toResponse(prescription)
  }

  async create(
    organizationId: string,
    dto: CreatePrescriptionDto,
    actorUserId?: string,
  ): Promise<{ prescription: Prescription; warnings: DrugInteractionWarning[] }> {
    const encounter = await this.encountersService.requireEncounter(organizationId, dto.encounterId)

    const activePrescriptions = await this.prisma.prescription.findMany({
      where: { patientId: encounter.patientId, organizationId, status: PrismaPrescriptionStatus.ACTIVE },
      include: { items: true },
    })
    const existingMedications = activePrescriptions.flatMap((p) => p.items.map((i) => i.medicationName))
    const newMedications = dto.items.map((i) => i.medicationName)
    const warnings = checkDrugInteractions([...newMedications, ...existingMedications])

    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })
    const settings = (org.settings ?? {}) as Record<string, unknown>
    const prefix = typeof settings.uhidPrefix === 'string' ? settings.uhidPrefix : 'MED'

    const prescription = await this.prisma.$transaction(async (tx) => {
      const prescriptionNumber = await this.generatePrescriptionNumber(tx, organizationId, prefix)
      return tx.prescription.create({
        data: {
          prescriptionNumber,
          patientId: encounter.patientId,
          doctorId: encounter.doctorId,
          encounterId: dto.encounterId,
          organizationId,
          notes: dto.notes,
          items: {
            create: dto.items.map((item) => ({
              medicationName: item.medicationName,
              genericName: item.genericName,
              strength: item.strength,
              form: item.form,
              dosage: item.dosage,
              frequency: item.frequency,
              duration: item.duration,
              route: item.route,
              instructions: item.instructions,
              quantity: item.quantity,
            })),
          },
        },
      })
    })

    this.eventEmitter.emit('prescription.created', {
      prescriptionId: prescription.id,
      doctorId: encounter.doctorId,
      patientId: encounter.patientId,
      organizationId,
      userId: actorUserId,
    })

    return { prescription: this.toPlainResponse(prescription), warnings }
  }

  async updateStatus(
    organizationId: string,
    id: string,
    dto: UpdatePrescriptionStatusDto,
    actorUserId?: string,
  ): Promise<Prescription> {
    const prescription = await this.requirePrescription(organizationId, id)
    const currentStatus = prescription.status as unknown as PrescriptionStatus
    const nextStatus = dto.status

    if (currentStatus === nextStatus) {
      throw new ConflictException(`Prescription is already ${nextStatus}`)
    }
    const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? []
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(`Cannot transition a prescription from ${currentStatus} to ${nextStatus}`)
    }

    const updated = await this.prisma.prescription.update({
      where: { id },
      data: { status: nextStatus as unknown as PrismaPrescriptionStatus },
    })

    this.eventEmitter.emit('prescription.status_changed', {
      prescriptionId: id,
      doctorId: prescription.doctorId,
      patientId: prescription.patientId,
      organizationId,
      userId: actorUserId,
      fromStatus: currentStatus,
      toStatus: nextStatus,
    })

    return this.toPlainResponse(updated)
  }

  async generatePdf(organizationId: string, id: string): Promise<{ buffer: Buffer; fileName: string }> {
    const prescription = await this.requirePrescriptionWithRelations(organizationId, id)
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })
    const patient = await this.prisma.patient.findUniqueOrThrow({ where: { id: prescription.patientId } })

    const buffer = await generatePrescriptionPdf({
      prescriptionNumber: prescription.prescriptionNumber,
      prescribedAt: prescription.prescribedAt,
      organization: {
        name: org.name,
        address: org.address,
        phone: org.phone,
        email: org.email,
      },
      doctor: {
        fullName: `${prescription.doctor.user.firstName} ${prescription.doctor.user.lastName}`,
        specialization: prescription.doctor.specialization,
      },
      patient: {
        fullName: `${prescription.patient.firstName} ${prescription.patient.lastName}`,
        uhid: prescription.patient.uhid,
        age: computeAge(patient.dateOfBirth),
        gender: patient.gender,
      },
      items: prescription.items.map((item) => ({
        medicationName: item.medicationName,
        genericName: item.genericName,
        strength: item.strength,
        dosage: item.dosage,
        frequency: item.frequency,
        duration: item.duration,
        route: item.route,
        instructions: item.instructions,
        quantity: item.quantity,
      })),
      notes: prescription.notes,
    })

    return { buffer, fileName: `${prescription.prescriptionNumber}.pdf` }
  }

  /**
   * `prescriptions.*` can be held at `.own` scope (a doctor managing only
   * prescriptions where they're the prescribing doctor) - same idiom as
   * `EncountersService.assertOwnScopeOk`.
   */
  async assertOwnScopeOk(organizationId: string, id: string, user: JwtPayload, action: string): Promise<void> {
    const scope = this.permissionsService.getScope(user, 'prescriptions', action)
    if (scope !== 'own') return

    const prescription = await this.requirePrescription(organizationId, id)
    const ownProfile = await this.doctorRef.findDoctorProfileForUser(organizationId, user.sub)
    if (!ownProfile || ownProfile.id !== prescription.doctorId) {
      throw new ForbiddenException('You can only access your own prescriptions')
    }
  }

  private async requirePrescription(organizationId: string, id: string): Promise<PrismaPrescription> {
    const prescription = await this.prisma.prescription.findFirst({ where: { id, organizationId } })
    if (!prescription) throw new NotFoundException('Prescription not found')
    return prescription
  }

  private async requirePrescriptionWithRelations(
    organizationId: string,
    id: string,
  ): Promise<PrescriptionWithRelations> {
    const prescription = await this.prisma.prescription.findFirst({
      where: { id, organizationId },
      include: PRESCRIPTION_WITH_RELATIONS_INCLUDE,
    })
    if (!prescription) throw new NotFoundException('Prescription not found')
    return prescription as PrescriptionWithRelations
  }

  private async generatePrescriptionNumber(
    tx: Prisma.TransactionClient,
    organizationId: string,
    prefix: string,
  ): Promise<string> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId} || ':prescription')::bigint)`

    const year = new Date().getFullYear()
    const yearStart = new Date(Date.UTC(year, 0, 1))
    const count = await tx.prescription.count({ where: { organizationId, createdAt: { gte: yearStart } } })

    return `RX-${prefix}-${year}-${String(count + 1).padStart(6, '0')}`
  }

  private toResponse(prescription: PrescriptionWithRelations): PrescriptionWithItems {
    return {
      ...this.toPlainResponse(prescription),
      items: prescription.items.map((item) => ({
        id: item.id,
        prescriptionId: item.prescriptionId,
        medicationName: item.medicationName,
        genericName: item.genericName,
        strength: item.strength,
        form: item.form,
        dosage: item.dosage,
        frequency: item.frequency,
        duration: item.duration,
        route: item.route as unknown as PrescriptionWithItems['items'][number]['route'],
        instructions: item.instructions,
        quantity: item.quantity,
        createdAt: item.createdAt,
      })),
      patient: {
        id: prescription.patient.id,
        fullName: `${prescription.patient.firstName} ${prescription.patient.lastName}`,
        uhid: prescription.patient.uhid,
      },
      doctor: {
        id: prescription.doctor.id,
        fullName: `${prescription.doctor.user.firstName} ${prescription.doctor.user.lastName}`,
        specialization: prescription.doctor.specialization,
      },
    }
  }

  private toPlainResponse(prescription: PrismaPrescription): Prescription {
    return {
      id: prescription.id,
      prescriptionNumber: prescription.prescriptionNumber,
      patientId: prescription.patientId,
      doctorId: prescription.doctorId,
      encounterId: prescription.encounterId,
      organizationId: prescription.organizationId,
      status: prescription.status as unknown as PrescriptionStatus,
      notes: prescription.notes,
      prescribedAt: prescription.prescribedAt,
      createdAt: prescription.createdAt,
      updatedAt: prescription.updatedAt,
    }
  }
}

function computeAge(dateOfBirth: Date): number {
  const diffMs = Date.now() - dateOfBirth.getTime()
  return Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000))
}
