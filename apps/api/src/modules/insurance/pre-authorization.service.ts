import {
  CancelPreAuthorizationDto,
  CreatePreAuthorizationDto,
  DecidePreAuthorizationDto,
  PreAuthorizationQuery,
  PreAuthorizationStatus,
  PreAuthorizationWithDetails,
} from '@medicore/types'
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { PreAuthorization as PrismaPreAuthorization, Prisma } from '@prisma/client'
import { nanoid } from 'nanoid'

import { StorageService } from '../../common/storage/storage.service'
import { PrismaService } from '../../prisma/prisma.service'
import { EncountersService } from '../medical-records/encounters.service'

import { PatientInsuranceService } from './patient-insurance.service'

export interface UploadedFileInput {
  buffer: Buffer
  fileName: string
  mimeType: string
  size: number
}

const ALLOWED_TRANSITIONS: Record<PreAuthorizationStatus, PreAuthorizationStatus[]> = {
  [PreAuthorizationStatus.DRAFT]: [PreAuthorizationStatus.SUBMITTED, PreAuthorizationStatus.CANCELLED],
  [PreAuthorizationStatus.SUBMITTED]: [PreAuthorizationStatus.UNDER_REVIEW, PreAuthorizationStatus.CANCELLED],
  [PreAuthorizationStatus.UNDER_REVIEW]: [
    PreAuthorizationStatus.APPROVED,
    PreAuthorizationStatus.PARTIALLY_APPROVED,
    PreAuthorizationStatus.REJECTED,
    PreAuthorizationStatus.CANCELLED,
  ],
  [PreAuthorizationStatus.APPROVED]: [],
  [PreAuthorizationStatus.PARTIALLY_APPROVED]: [],
  [PreAuthorizationStatus.REJECTED]: [],
  [PreAuthorizationStatus.CANCELLED]: [],
}

const PRE_AUTH_INCLUDE = {
  patient: { select: { id: true, firstName: true, lastName: true, uhid: true } },
  patientInsurance: {
    select: {
      id: true,
      memberId: true,
      policyNumber: true,
      provider: { select: { id: true, name: true } },
    },
  },
  attachments: true,
} satisfies Prisma.PreAuthorizationInclude

type PreAuthorizationWithRelations = Prisma.PreAuthorizationGetPayload<{ include: typeof PRE_AUTH_INCLUDE }>

const ALLOWED_ATTACHMENT_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024

/**
 * Cashless/TPA pre-authorization workflow ("Draft → Submitted → Under
 * Review → Approved/Partially Approved/Rejected/Cancelled") — see
 * ADR-0016. Not own-scoped: a cashier/billing clerk files pre-auths across
 * every doctor's patients, the same reasoning as `billing.*`/`insurance.claims.*`.
 */
@Injectable()
export class PreAuthorizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encountersService: EncountersService,
    private readonly patientInsuranceService: PatientInsuranceService,
    private readonly storageService: StorageService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(organizationId: string, query: PreAuthorizationQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20

    const where: Prisma.PreAuthorizationWhereInput = { organizationId }
    if (query.patientId) where.patientId = query.patientId
    if (query.encounterId) where.encounterId = query.encounterId
    if (query.status) where.status = query.status as unknown as Prisma.PreAuthorizationWhereInput['status']

    const [data, total] = await Promise.all([
      this.prisma.preAuthorization.findMany({
        where,
        include: PRE_AUTH_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.preAuthorization.count({ where }),
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

  async getById(organizationId: string, id: string): Promise<PreAuthorizationWithDetails> {
    return this.toResponse(await this.requireWithRelations(organizationId, id))
  }

  async create(
    organizationId: string,
    dto: CreatePreAuthorizationDto,
    actorUserId?: string,
  ): Promise<PreAuthorizationWithDetails> {
    const encounter = await this.encountersService.requireEncounter(organizationId, dto.encounterId)
    const coverage = await this.patientInsuranceService.requireActiveCoverage(organizationId, dto.patientInsuranceId)
    if (coverage.patientId !== encounter.patientId) {
      throw new BadRequestException('This coverage does not belong to the encounter\'s patient')
    }

    const authNumber = await this.generateAuthNumber(organizationId)
    const preAuth = await this.prisma.preAuthorization.create({
      data: {
        authNumber,
        organizationId,
        patientId: encounter.patientId,
        encounterId: dto.encounterId,
        patientInsuranceId: dto.patientInsuranceId,
        requestedAmount: dto.requestedAmount,
        clinicalNotes: dto.clinicalNotes,
        doctorNotes: dto.doctorNotes,
        createdByUserId: actorUserId,
      },
      include: PRE_AUTH_INCLUDE,
    })

    this.eventEmitter.emit('insurance.preauth_created', {
      preAuthId: preAuth.id,
      patientId: preAuth.patientId,
      organizationId,
      userId: actorUserId,
    })
    return this.toResponse(preAuth)
  }

  async submit(organizationId: string, id: string, actorUserId?: string): Promise<PreAuthorizationWithDetails> {
    const preAuth = await this.transition(organizationId, id, PreAuthorizationStatus.SUBMITTED)
    await this.prisma.preAuthorization.update({ where: { id }, data: { submittedAt: new Date() } })

    this.eventEmitter.emit('insurance.preauth_submitted', {
      preAuthId: id,
      patientId: preAuth.patientId,
      organizationId,
      userId: actorUserId,
    })
    return this.getById(organizationId, id)
  }

  async markUnderReview(organizationId: string, id: string, actorUserId?: string): Promise<PreAuthorizationWithDetails> {
    await this.transition(organizationId, id, PreAuthorizationStatus.UNDER_REVIEW)
    this.eventEmitter.emit('insurance.preauth_under_review', { preAuthId: id, organizationId, userId: actorUserId })
    return this.getById(organizationId, id)
  }

  async decide(
    organizationId: string,
    id: string,
    dto: DecidePreAuthorizationDto,
    actorUserId?: string,
  ): Promise<PreAuthorizationWithDetails> {
    const current = await this.requireWithRelations(organizationId, id)
    const target = dto.status as unknown as PreAuthorizationStatus
    const allowed = ALLOWED_TRANSITIONS[current.status as unknown as PreAuthorizationStatus] ?? []
    if (!allowed.includes(target)) {
      throw new ConflictException(`Cannot move a pre-authorization from ${current.status} to ${target}`)
    }
    if (target !== PreAuthorizationStatus.REJECTED && dto.approvedAmount === undefined) {
      throw new BadRequestException('approvedAmount is required when approving or partially approving')
    }

    await this.prisma.preAuthorization.update({
      where: { id },
      data: {
        status: target,
        approvedAmount: target === PreAuthorizationStatus.REJECTED ? null : dto.approvedAmount,
        rejectionReason: target === PreAuthorizationStatus.REJECTED ? dto.rejectionReason : null,
        decidedAt: new Date(),
        decidedByUserId: actorUserId,
      },
    })

    this.eventEmitter.emit('insurance.preauth_decided', {
      preAuthId: id,
      status: target,
      organizationId,
      userId: actorUserId,
    })
    return this.getById(organizationId, id)
  }

  async cancel(
    organizationId: string,
    id: string,
    dto: CancelPreAuthorizationDto,
    actorUserId?: string,
  ): Promise<PreAuthorizationWithDetails> {
    await this.transition(organizationId, id, PreAuthorizationStatus.CANCELLED)
    await this.prisma.preAuthorization.update({
      where: { id },
      data: { rejectionReason: dto.reason, decidedAt: new Date(), decidedByUserId: actorUserId },
    })

    this.eventEmitter.emit('insurance.preauth_cancelled', { preAuthId: id, organizationId, userId: actorUserId })
    return this.getById(organizationId, id)
  }

  async uploadAttachment(
    organizationId: string,
    id: string,
    file: UploadedFileInput,
    actorUserId: string,
  ): Promise<PreAuthorizationWithDetails> {
    await this.requireWithRelations(organizationId, id)

    if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(file.mimeType)) {
      throw new BadRequestException('Unsupported file type — allowed: PNG, JPEG, WEBP, PDF')
    }
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new BadRequestException('File exceeds the 10MB upload limit')
    }

    const key = `insurance/preauth/${organizationId}/${id}/${nanoid()}-${sanitizeFileName(file.fileName)}`
    const fileUrl = await this.storageService.upload({ key, buffer: file.buffer, mimeType: file.mimeType })

    await this.prisma.preAuthAttachment.create({
      data: {
        preAuthorizationId: id,
        fileName: file.fileName,
        fileUrl,
        mimeType: file.mimeType,
        size: file.size,
        uploadedByUserId: actorUserId,
      },
    })

    this.eventEmitter.emit('insurance.preauth_attachment_uploaded', { preAuthId: id, organizationId, userId: actorUserId })
    return this.getById(organizationId, id)
  }

  /** Used by InsuranceClaimsService when linking a claim back to the pre-auth that cleared it. */
  async requirePreAuthorization(organizationId: string, id: string): Promise<PrismaPreAuthorization> {
    const preAuth = await this.prisma.preAuthorization.findFirst({ where: { id, organizationId } })
    if (!preAuth) throw new NotFoundException('Pre-authorization not found')
    return preAuth
  }

  private async transition(
    organizationId: string,
    id: string,
    target: PreAuthorizationStatus,
  ): Promise<PrismaPreAuthorization> {
    const preAuth = await this.requirePreAuthorization(organizationId, id)
    const allowed = ALLOWED_TRANSITIONS[preAuth.status as unknown as PreAuthorizationStatus] ?? []
    if (!allowed.includes(target)) {
      throw new ConflictException(`Cannot move a pre-authorization from ${preAuth.status} to ${target}`)
    }
    return this.prisma.preAuthorization.update({ where: { id }, data: { status: target } })
  }

  private async requireWithRelations(organizationId: string, id: string): Promise<PreAuthorizationWithRelations> {
    const preAuth = await this.prisma.preAuthorization.findFirst({ where: { id, organizationId }, include: PRE_AUTH_INCLUDE })
    if (!preAuth) throw new NotFoundException('Pre-authorization not found')
    return preAuth
  }

  private async generateAuthNumber(organizationId: string): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId} || ':preauth')::bigint)`
      const year = new Date().getFullYear()
      const yearStart = new Date(Date.UTC(year, 0, 1))
      const count = await tx.preAuthorization.count({ where: { organizationId, createdAt: { gte: yearStart } } })
      return `PA-${year}-${String(count + 1).padStart(6, '0')}`
    })
  }

  private toResponse(preAuth: PreAuthorizationWithRelations): PreAuthorizationWithDetails {
    return {
      id: preAuth.id,
      authNumber: preAuth.authNumber,
      organizationId: preAuth.organizationId,
      patientId: preAuth.patientId,
      encounterId: preAuth.encounterId,
      patientInsuranceId: preAuth.patientInsuranceId,
      status: preAuth.status as unknown as PreAuthorizationWithDetails['status'],
      clinicalNotes: preAuth.clinicalNotes,
      doctorNotes: preAuth.doctorNotes,
      requestedAmount: preAuth.requestedAmount.toString(),
      approvedAmount: preAuth.approvedAmount?.toString() ?? null,
      rejectionReason: preAuth.rejectionReason,
      submittedAt: preAuth.submittedAt,
      decidedAt: preAuth.decidedAt,
      decidedByUserId: preAuth.decidedByUserId,
      createdByUserId: preAuth.createdByUserId,
      createdAt: preAuth.createdAt,
      updatedAt: preAuth.updatedAt,
      patient: { id: preAuth.patient.id, fullName: `${preAuth.patient.firstName} ${preAuth.patient.lastName}`, uhid: preAuth.patient.uhid },
      patientInsurance: {
        id: preAuth.patientInsurance.id,
        memberId: preAuth.patientInsurance.memberId,
        policyNumber: preAuth.patientInsurance.policyNumber,
        provider: preAuth.patientInsurance.provider,
      },
      attachments: preAuth.attachments.map((a) => ({
        id: a.id,
        preAuthorizationId: a.preAuthorizationId,
        fileName: a.fileName,
        fileUrl: a.fileUrl,
        mimeType: a.mimeType,
        size: a.size,
        uploadedByUserId: a.uploadedByUserId,
        createdAt: a.createdAt,
      })),
    }
  }
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9_.-]/g, '_')
}
