import {
  Admission,
  AdmissionQuery,
  AdmissionStatus,
  AdmissionWithDetails,
  CancelAdmissionDto,
  CreateAdmissionDto,
  JwtPayload,
  UpdateAdmissionDto,
} from '@medicore/types'
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Admission as PrismaAdmission, Prisma } from '@prisma/client'

import { PermissionsService } from '../../common/permissions/permissions.service'
import { PrismaService } from '../../prisma/prisma.service'
import { EncountersService } from '../medical-records/encounters.service'
import { DoctorRefService } from '../scheduling/doctor-ref.service'

import { BedsService } from './beds.service'
import { RoomsService } from './rooms.service'
import { WardsService } from './wards.service'

const ADMISSION_WITH_RELATIONS_INCLUDE = {
  patient: { select: { id: true, firstName: true, lastName: true, uhid: true } },
  attendingDoctor: {
    select: { id: true, specialization: true, user: { select: { firstName: true, lastName: true } } },
  },
  department: { select: { id: true, name: true, code: true } },
  ward: { select: { id: true, name: true, code: true, type: true } },
  room: { select: { id: true, roomNumber: true } },
  bed: { select: { id: true, bedNumber: true, status: true } },
  patientInsurance: {
    select: {
      id: true,
      memberId: true,
      provider: { select: { id: true, name: true } },
      plan: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.AdmissionInclude

type AdmissionWithRelations = PrismaAdmission & {
  patient: { id: string; firstName: string; lastName: string; uhid: string }
  attendingDoctor: { id: string; specialization: string; user: { firstName: string; lastName: string } }
  department: { id: string; name: string; code: string } | null
  ward: { id: string; name: string; code: string; type: string }
  room: { id: string; roomNumber: string } | null
  bed: { id: string; bedNumber: string; status: string } | null
  patientInsurance: {
    id: string
    memberId: string
    provider: { id: string; name: string }
    plan: { id: string; name: string }
  } | null
}

/** Admit / cancel workflow — see ADR-0018. Discharge is Checkpoint 12.2. */
@Injectable()
export class AdmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encountersService: EncountersService,
    private readonly doctorRef: DoctorRefService,
    private readonly wardsService: WardsService,
    private readonly roomsService: RoomsService,
    private readonly bedsService: BedsService,
    private readonly permissionsService: PermissionsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(organizationId: string, query: AdmissionQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20

    const where: Prisma.AdmissionWhereInput = { organizationId }
    if (query.patientId) where.patientId = query.patientId
    if (query.attendingDoctorId) where.attendingDoctorId = query.attendingDoctorId
    if (query.wardId) where.wardId = query.wardId
    if (query.status) where.status = query.status as unknown as Prisma.AdmissionWhereInput['status']
    if (query.type) where.type = query.type as unknown as Prisma.AdmissionWhereInput['type']
    if (query.search) where.admissionNumber = { contains: query.search, mode: 'insensitive' }
    if (query.pendingDischarge) {
      where.status = 'ADMITTED'
      where.dischargeApprovedAt = { not: null }
    }

    const [data, total] = await Promise.all([
      this.prisma.admission.findMany({
        where,
        include: ADMISSION_WITH_RELATIONS_INCLUDE,
        orderBy: { admittedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.admission.count({ where }),
    ])

    return {
      data: data.map((a) => this.toResponse(a)),
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

  async getById(organizationId: string, id: string): Promise<AdmissionWithDetails> {
    const admission = await this.requireAdmissionWithRelations(organizationId, id)
    return this.toResponse(admission)
  }

  async create(organizationId: string, dto: CreateAdmissionDto, actorUserId?: string): Promise<AdmissionWithDetails> {
    await this.requirePatient(organizationId, dto.patientId)
    await this.doctorRef.requireDoctor(organizationId, dto.attendingDoctorId)
    await this.wardsService.requireWard(organizationId, dto.wardId)

    if (dto.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, organizationId },
      })
      if (!department) throw new NotFoundException('Department not found')
    }

    let bed = null
    if (dto.bedId) {
      bed = await this.bedsService.requireBed(organizationId, dto.bedId)
      if (bed.status !== 'AVAILABLE') {
        throw new ConflictException(`Bed is currently ${bed.status.toLowerCase()} and cannot be allocated`)
      }
      if (dto.roomId && bed.roomId !== dto.roomId) {
        throw new ConflictException('Selected bed does not belong to the selected room')
      }
      if (bed.wardId !== dto.wardId) {
        throw new ConflictException('Selected bed does not belong to the selected ward')
      }
    } else if (dto.roomId) {
      const room = await this.roomsService.requireRoom(organizationId, dto.roomId)
      if (room.wardId !== dto.wardId) {
        throw new ConflictException('Selected room does not belong to the selected ward')
      }
    }

    if (dto.patientInsuranceId) {
      const coverage = await this.prisma.patientInsurance.findFirst({
        where: { id: dto.patientInsuranceId, organizationId, patientId: dto.patientId },
      })
      if (!coverage) throw new NotFoundException('Patient insurance coverage not found')
    }

    let encounterId = dto.encounterId
    if (encounterId) {
      const encounter = await this.encountersService.requireEncounter(organizationId, encounterId)
      if (encounter.patientId !== dto.patientId) {
        throw new ConflictException('The selected encounter does not belong to this patient')
      }
    } else {
      const encounter = await this.encountersService.create(
        organizationId,
        {
          patientId: dto.patientId,
          doctorId: dto.attendingDoctorId,
          type: 'IPD' as never,
          notes: dto.admissionReason,
        },
        actorUserId,
      )
      encounterId = encounter.id
    }

    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })
    const settings = (org.settings ?? {}) as Record<string, unknown>
    const prefix = typeof settings.uhidPrefix === 'string' ? settings.uhidPrefix : 'MED'

    const admission = await this.prisma.$transaction(async (tx) => {
      const admissionNumber = await this.generateAdmissionNumber(tx, organizationId, prefix)
      const created = await tx.admission.create({
        data: {
          admissionNumber,
          patientId: dto.patientId,
          encounterId,
          attendingDoctorId: dto.attendingDoctorId,
          departmentId: dto.departmentId,
          wardId: dto.wardId,
          roomId: bed?.roomId ?? dto.roomId,
          bedId: dto.bedId,
          patientInsuranceId: dto.patientInsuranceId,
          organizationId,
          type: dto.type as unknown as Prisma.AdmissionCreateInput['type'],
          admissionReason: dto.admissionReason,
          diagnosis: dto.diagnosis,
          expectedDischargeAt: dto.expectedDischargeAt,
          createdByUserId: actorUserId,
        },
        include: ADMISSION_WITH_RELATIONS_INCLUDE,
      })

      if (dto.bedId) {
        await tx.bed.update({ where: { id: dto.bedId }, data: { status: 'OCCUPIED' } })
        await tx.bedAllocation.create({
          data: {
            admissionId: created.id,
            bedId: dto.bedId,
            organizationId,
            action: 'ALLOCATED',
            performedByUserId: actorUserId,
            reason: 'Allocated at admission',
          },
        })
      }

      return created
    })

    this.eventEmitter.emit('ipd.admission_created', {
      admissionId: admission.id,
      patientId: admission.patientId,
      attendingDoctorId: admission.attendingDoctorId,
      organizationId,
      userId: actorUserId,
      status: admission.status,
    })

    return this.toResponse(admission)
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateAdmissionDto,
    actorUserId?: string,
  ): Promise<AdmissionWithDetails> {
    const admission = await this.requireAdmission(organizationId, id)
    if (admission.status !== 'ADMITTED') {
      throw new ConflictException('Only an active admission can be edited')
    }
    if (dto.attendingDoctorId) await this.doctorRef.requireDoctor(organizationId, dto.attendingDoctorId)
    if (dto.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, organizationId },
      })
      if (!department) throw new NotFoundException('Department not found')
    }

    await this.prisma.admission.update({
      where: { id },
      data: {
        attendingDoctorId: dto.attendingDoctorId,
        departmentId: dto.departmentId,
        admissionReason: dto.admissionReason,
        diagnosis: dto.diagnosis,
        expectedDischargeAt: dto.expectedDischargeAt,
      },
    })

    this.eventEmitter.emit('ipd.admission_updated', {
      admissionId: id,
      patientId: admission.patientId,
      organizationId,
      userId: actorUserId,
      status: admission.status,
    })

    return this.getById(organizationId, id)
  }

  async cancel(
    organizationId: string,
    id: string,
    dto: CancelAdmissionDto,
    actorUserId?: string,
  ): Promise<AdmissionWithDetails> {
    const admission = await this.requireAdmission(organizationId, id)
    if (admission.status !== 'ADMITTED') {
      throw new ConflictException(`Admission is already ${admission.status.toLowerCase()}`)
    }

    await this.prisma.$transaction(async (tx) => {
      if (admission.bedId) {
        await tx.bed.update({ where: { id: admission.bedId }, data: { status: 'AVAILABLE' } })
        await tx.bedAllocation.create({
          data: {
            admissionId: id,
            bedId: admission.bedId,
            organizationId,
            action: 'VACATED',
            performedByUserId: actorUserId,
            reason: 'Admission cancelled',
          },
        })
      }
      await tx.admission.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason: dto.reason,
          bedId: null,
        },
      })
    })

    this.eventEmitter.emit('ipd.admission_cancelled', {
      admissionId: id,
      patientId: admission.patientId,
      organizationId,
      userId: actorUserId,
      status: AdmissionStatus.CANCELLED,
    })

    return this.getById(organizationId, id)
  }

  /** `ipd.admissions.*` can be held at `.own` scope — a doctor manages only admissions where they're attending. */
  async assertOwnScopeOk(organizationId: string, id: string, user: JwtPayload, action: string): Promise<void> {
    const scope = this.permissionsService.getScope(user, 'ipd.admissions', action)
    if (scope !== 'own') return

    const admission = await this.requireAdmission(organizationId, id)
    const ownProfile = await this.doctorRef.findDoctorProfileForUser(organizationId, user.sub)
    if (!ownProfile || ownProfile.id !== admission.attendingDoctorId) {
      throw new ForbiddenException('You can only access admissions where you are the attending doctor')
    }
  }

  async requireAdmission(organizationId: string, id: string): Promise<PrismaAdmission> {
    const admission = await this.prisma.admission.findFirst({ where: { id, organizationId } })
    if (!admission) throw new NotFoundException('Admission not found')
    return admission
  }

  private async requireAdmissionWithRelations(organizationId: string, id: string): Promise<AdmissionWithRelations> {
    const admission = await this.prisma.admission.findFirst({
      where: { id, organizationId },
      include: ADMISSION_WITH_RELATIONS_INCLUDE,
    })
    if (!admission) throw new NotFoundException('Admission not found')
    return admission as AdmissionWithRelations
  }

  private async requirePatient(organizationId: string, patientId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, organizationId, deletedAt: null },
    })
    if (!patient) throw new NotFoundException('Patient not found')
    return patient
  }

  private async generateAdmissionNumber(
    tx: Prisma.TransactionClient,
    organizationId: string,
    prefix: string,
  ): Promise<string> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId} || ':admission')::bigint)`

    const year = new Date().getFullYear()
    const yearStart = new Date(Date.UTC(year, 0, 1))
    const count = await tx.admission.count({ where: { organizationId, createdAt: { gte: yearStart } } })

    return `ADM-${prefix}-${year}-${String(count + 1).padStart(6, '0')}`
  }

  private toResponse(admission: AdmissionWithRelations): AdmissionWithDetails {
    return {
      id: admission.id,
      admissionNumber: admission.admissionNumber,
      patientId: admission.patientId,
      encounterId: admission.encounterId,
      attendingDoctorId: admission.attendingDoctorId,
      departmentId: admission.departmentId,
      wardId: admission.wardId,
      roomId: admission.roomId,
      bedId: admission.bedId,
      patientInsuranceId: admission.patientInsuranceId,
      organizationId: admission.organizationId,
      type: admission.type as unknown as Admission['type'],
      status: admission.status as unknown as Admission['status'],
      admissionReason: admission.admissionReason,
      diagnosis: admission.diagnosis,
      admittedAt: admission.admittedAt,
      expectedDischargeAt: admission.expectedDischargeAt,
      dischargedAt: admission.dischargedAt,
      dischargeNotes: admission.dischargeNotes,
      dischargeCondition: admission.dischargeCondition,
      dischargeApprovedAt: admission.dischargeApprovedAt,
      dischargeApprovedByUserId: admission.dischargeApprovedByUserId,
      cancelledAt: admission.cancelledAt,
      cancelReason: admission.cancelReason,
      createdByUserId: admission.createdByUserId,
      createdAt: admission.createdAt,
      updatedAt: admission.updatedAt,
      patient: {
        id: admission.patient.id,
        fullName: `${admission.patient.firstName} ${admission.patient.lastName}`,
        uhid: admission.patient.uhid,
      },
      attendingDoctor: {
        id: admission.attendingDoctor.id,
        fullName: `${admission.attendingDoctor.user.firstName} ${admission.attendingDoctor.user.lastName}`,
        specialization: admission.attendingDoctor.specialization,
      },
      department: admission.department,
      ward: admission.ward as AdmissionWithDetails['ward'],
      room: admission.room,
      bed: admission.bed as unknown as AdmissionWithDetails['bed'],
      patientInsurance: admission.patientInsurance
        ? {
            id: admission.patientInsurance.id,
            memberId: admission.patientInsurance.memberId,
            provider: admission.patientInsurance.provider,
            plan: admission.patientInsurance.plan,
          }
        : null,
    }
  }
}
