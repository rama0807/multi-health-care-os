import {
  ClaimDocumentType,
  ClaimPaymentStatus,
  CreateInsuranceClaimDto,
  DecideClaimDto,
  InsuranceClaimQuery,
  InsuranceClaimStatus,
  InsuranceClaimWithDetails,
  PaymentMode,
  SettleClaimDto,
  UploadClaimDocumentMetaDto,
} from '@medicore/types'
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { InsuranceClaim as PrismaInsuranceClaim, Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'
import { PaymentsService } from '../billing/payments.service'
import { EncountersService } from '../medical-records/encounters.service'

import { ClaimDocumentsService, UploadedFileInput } from './claim-documents.service'
import { PatientInsuranceService } from './patient-insurance.service'
import { PreAuthorizationService } from './pre-authorization.service'

const ALLOWED_TRANSITIONS: Record<InsuranceClaimStatus, InsuranceClaimStatus[]> = {
  [InsuranceClaimStatus.DRAFT]: [InsuranceClaimStatus.SUBMITTED],
  [InsuranceClaimStatus.SUBMITTED]: [InsuranceClaimStatus.UNDER_REVIEW],
  [InsuranceClaimStatus.UNDER_REVIEW]: [
    InsuranceClaimStatus.APPROVED,
    InsuranceClaimStatus.PARTIALLY_APPROVED,
    InsuranceClaimStatus.REJECTED,
  ],
  [InsuranceClaimStatus.APPROVED]: [InsuranceClaimStatus.SETTLED, InsuranceClaimStatus.PARTIALLY_SETTLED],
  [InsuranceClaimStatus.PARTIALLY_APPROVED]: [InsuranceClaimStatus.SETTLED, InsuranceClaimStatus.PARTIALLY_SETTLED],
  [InsuranceClaimStatus.REJECTED]: [InsuranceClaimStatus.CLOSED],
  [InsuranceClaimStatus.SETTLED]: [InsuranceClaimStatus.CLOSED],
  [InsuranceClaimStatus.PARTIALLY_SETTLED]: [InsuranceClaimStatus.CLOSED],
  [InsuranceClaimStatus.CLOSED]: [],
}

const CLAIM_INCLUDE = {
  patient: { select: { id: true, firstName: true, lastName: true, uhid: true } },
  invoice: { select: { id: true, invoiceNumber: true, totalAmount: true, balanceDue: true } },
  documents: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.InsuranceClaimInclude

type ClaimWithRelations = Prisma.InsuranceClaimGetPayload<{ include: typeof CLAIM_INCLUDE }>

/**
 * Claim lifecycle ("Draft → Submitted → Under Review → Approved/Partially
 * Approved/Rejected → Settled/Partially Settled → Closed") plus settlement
 * - see ADR-0016. Not own-scoped: a cashier/billing clerk files and tracks
 * claims across every doctor's patients.
 */
@Injectable()
export class InsuranceClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encountersService: EncountersService,
    private readonly patientInsuranceService: PatientInsuranceService,
    private readonly preAuthorizationService: PreAuthorizationService,
    private readonly claimDocumentsService: ClaimDocumentsService,
    private readonly paymentsService: PaymentsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(organizationId: string, query: InsuranceClaimQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20
    const sortBy = query.sortBy ?? 'createdAt'
    const sortOrder = query.sortOrder ?? 'desc'

    const where: Prisma.InsuranceClaimWhereInput = { organizationId }
    if (query.patientId) where.patientId = query.patientId
    if (query.encounterId) where.encounterId = query.encounterId
    if (query.status) where.status = query.status as unknown as Prisma.InsuranceClaimWhereInput['status']

    const [data, total] = await Promise.all([
      this.prisma.insuranceClaim.findMany({
        where,
        include: CLAIM_INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.insuranceClaim.count({ where }),
    ])

    return {
      data: data.map((c) => this.toResponse(c)),
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

  async getById(organizationId: string, id: string): Promise<InsuranceClaimWithDetails> {
    return this.toResponse(await this.requireWithRelations(organizationId, id))
  }

  async create(organizationId: string, dto: CreateInsuranceClaimDto, actorUserId?: string): Promise<InsuranceClaimWithDetails> {
    const encounter = await this.encountersService.requireEncounter(organizationId, dto.encounterId)
    const coverage = await this.patientInsuranceService.requireActiveCoverage(organizationId, dto.patientInsuranceId)
    if (coverage.patientId !== encounter.patientId) {
      throw new BadRequestException("This coverage does not belong to the encounter's patient")
    }

    const invoice = await this.prisma.invoice.findFirst({ where: { id: dto.invoiceId, organizationId } })
    if (!invoice) throw new NotFoundException('Invoice not found')
    if (invoice.patientId !== encounter.patientId) {
      throw new BadRequestException("This invoice does not belong to the encounter's patient")
    }
    const existingClaim = await this.prisma.insuranceClaim.findUnique({ where: { invoiceId: dto.invoiceId } })
    if (existingClaim) throw new ConflictException('This invoice already has an insurance claim')

    if (dto.preAuthorizationId) {
      const preAuth = await this.preAuthorizationService.requirePreAuthorization(organizationId, dto.preAuthorizationId)
      if (preAuth.patientId !== encounter.patientId) {
        throw new BadRequestException("This pre-authorization does not belong to the encounter's patient")
      }
    }

    const claimNumber = await this.generateClaimNumber(organizationId)
    const claim = await this.prisma.insuranceClaim.create({
      data: {
        claimNumber,
        patientId: encounter.patientId,
        invoiceId: dto.invoiceId,
        encounterId: dto.encounterId,
        organizationId,
        providerId: coverage.providerId,
        planId: coverage.planId,
        patientInsuranceId: dto.patientInsuranceId,
        preAuthorizationId: dto.preAuthorizationId,
        insuranceProvider: coverage.provider.name,
        policyNumber: coverage.policyNumber,
        membershipId: coverage.memberId,
        claimedAmount: dto.claimedAmount,
        createdByUserId: actorUserId,
      },
      include: CLAIM_INCLUDE,
    })

    await this.claimDocumentsService.autoAttachForClaim(organizationId, claim.id, dto.encounterId, dto.invoiceId)

    this.eventEmitter.emit('insurance.claim_created', {
      claimId: claim.id,
      patientId: claim.patientId,
      organizationId,
      userId: actorUserId,
    })
    return this.getById(organizationId, claim.id)
  }

  async submit(organizationId: string, id: string, actorUserId?: string): Promise<InsuranceClaimWithDetails> {
    await this.transition(organizationId, id, InsuranceClaimStatus.SUBMITTED)
    await this.prisma.insuranceClaim.update({ where: { id }, data: { submittedAt: new Date() } })
    this.eventEmitter.emit('insurance.claim_submitted', { claimId: id, organizationId, userId: actorUserId })
    return this.getById(organizationId, id)
  }

  async markUnderReview(organizationId: string, id: string, actorUserId?: string): Promise<InsuranceClaimWithDetails> {
    await this.transition(organizationId, id, InsuranceClaimStatus.UNDER_REVIEW)
    this.eventEmitter.emit('insurance.claim_under_review', { claimId: id, organizationId, userId: actorUserId })
    return this.getById(organizationId, id)
  }

  async decide(organizationId: string, id: string, dto: DecideClaimDto, actorUserId?: string): Promise<InsuranceClaimWithDetails> {
    const claim = await this.requireClaim(organizationId, id)
    const target = dto.status as unknown as InsuranceClaimStatus
    this.assertTransitionAllowed(claim.status as unknown as InsuranceClaimStatus, target)

    const claimedAmount = Number(claim.claimedAmount)
    if (target === InsuranceClaimStatus.REJECTED) {
      if (!dto.rejectionReason) throw new BadRequestException('rejectionReason is required when rejecting a claim')
    } else if (dto.approvedAmount === undefined) {
      throw new BadRequestException('approvedAmount is required when approving or partially approving a claim')
    } else if (dto.approvedAmount > claimedAmount) {
      throw new BadRequestException('approvedAmount cannot exceed the claimed amount')
    }

    await this.prisma.insuranceClaim.update({
      where: { id },
      data: {
        status: target,
        approvedAmount: target === InsuranceClaimStatus.REJECTED ? null : dto.approvedAmount,
        rejectedAmount:
          target === InsuranceClaimStatus.REJECTED
            ? claimedAmount
            : target === InsuranceClaimStatus.PARTIALLY_APPROVED
              ? claimedAmount - (dto.approvedAmount ?? 0)
              : 0,
        rejectionReason: target === InsuranceClaimStatus.REJECTED ? dto.rejectionReason : null,
      },
    })

    this.eventEmitter.emit('insurance.claim_decided', { claimId: id, status: target, organizationId, userId: actorUserId })
    return this.getById(organizationId, id)
  }

  async settle(organizationId: string, id: string, dto: SettleClaimDto, actorUserId?: string): Promise<InsuranceClaimWithDetails> {
    const claim = await this.requireClaim(organizationId, id)
    const status = claim.status as unknown as InsuranceClaimStatus
    if (status !== InsuranceClaimStatus.APPROVED && status !== InsuranceClaimStatus.PARTIALLY_APPROVED) {
      throw new ConflictException('Only an approved or partially approved claim can be settled')
    }

    const claimedAmount = Number(claim.claimedAmount)
    const accountedFor = dto.insuranceShare + dto.patientShare + dto.adjustmentAmount + dto.writeOffAmount
    const outstandingAmount = Math.max(claimedAmount - accountedFor, 0)
    const targetStatus = outstandingAmount <= 0 ? InsuranceClaimStatus.SETTLED : InsuranceClaimStatus.PARTIALLY_SETTLED
    const paymentStatus =
      outstandingAmount <= 0
        ? ClaimPaymentStatus.PAID
        : dto.insuranceShare + dto.patientShare > 0
          ? ClaimPaymentStatus.PARTIAL
          : ClaimPaymentStatus.PENDING

    await this.prisma.insuranceClaim.update({
      where: { id },
      data: {
        status: targetStatus,
        insuranceShare: dto.insuranceShare,
        patientShare: dto.patientShare,
        adjustmentAmount: dto.adjustmentAmount,
        writeOffAmount: dto.writeOffAmount,
        outstandingAmount,
        paymentStatus,
        settledAt: new Date(),
      },
    })

    if (dto.insuranceShare > 0) {
      await this.paymentsService.create(
        organizationId,
        claim.invoiceId,
        { amount: dto.insuranceShare, paymentMode: PaymentMode.INSURANCE, referenceNumber: claim.claimNumber },
        actorUserId,
      )
    }

    this.eventEmitter.emit('insurance.claim_settled', {
      claimId: id,
      status: targetStatus,
      insuranceShare: dto.insuranceShare,
      organizationId,
      userId: actorUserId,
    })
    return this.getById(organizationId, id)
  }

  async close(organizationId: string, id: string, actorUserId?: string): Promise<InsuranceClaimWithDetails> {
    await this.transition(organizationId, id, InsuranceClaimStatus.CLOSED)
    await this.prisma.insuranceClaim.update({ where: { id }, data: { closedAt: new Date() } })
    this.eventEmitter.emit('insurance.claim_closed', { claimId: id, organizationId, userId: actorUserId })
    return this.getById(organizationId, id)
  }

  async uploadDocument(
    organizationId: string,
    id: string,
    meta: UploadClaimDocumentMetaDto,
    file: UploadedFileInput,
    actorUserId: string,
  ) {
    await this.requireClaim(organizationId, id)
    return this.claimDocumentsService.uploadManual(
      organizationId,
      id,
      meta.type ?? ClaimDocumentType.MANUAL_UPLOAD,
      file,
      actorUserId,
    )
  }

  private async transition(organizationId: string, id: string, target: InsuranceClaimStatus): Promise<PrismaInsuranceClaim> {
    const claim = await this.requireClaim(organizationId, id)
    this.assertTransitionAllowed(claim.status as unknown as InsuranceClaimStatus, target)
    return this.prisma.insuranceClaim.update({ where: { id }, data: { status: target } })
  }

  private assertTransitionAllowed(current: InsuranceClaimStatus, target: InsuranceClaimStatus): void {
    const allowed = ALLOWED_TRANSITIONS[current] ?? []
    if (!allowed.includes(target)) {
      throw new ConflictException(`Cannot move a claim from ${current} to ${target}`)
    }
  }

  private async requireClaim(organizationId: string, id: string): Promise<PrismaInsuranceClaim> {
    const claim = await this.prisma.insuranceClaim.findFirst({ where: { id, organizationId } })
    if (!claim) throw new NotFoundException('Insurance claim not found')
    return claim
  }

  private async requireWithRelations(organizationId: string, id: string): Promise<ClaimWithRelations> {
    const claim = await this.prisma.insuranceClaim.findFirst({ where: { id, organizationId }, include: CLAIM_INCLUDE })
    if (!claim) throw new NotFoundException('Insurance claim not found')
    return claim
  }

  private async generateClaimNumber(organizationId: string): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId} || ':claim')::bigint)`
      const year = new Date().getFullYear()
      const yearStart = new Date(Date.UTC(year, 0, 1))
      const count = await tx.insuranceClaim.count({ where: { organizationId, createdAt: { gte: yearStart } } })
      return `CLM-${year}-${String(count + 1).padStart(6, '0')}`
    })
  }

  private toResponse(claim: ClaimWithRelations): InsuranceClaimWithDetails {
    return {
      id: claim.id,
      claimNumber: claim.claimNumber,
      patientId: claim.patientId,
      invoiceId: claim.invoiceId,
      encounterId: claim.encounterId,
      organizationId: claim.organizationId,
      providerId: claim.providerId,
      planId: claim.planId,
      patientInsuranceId: claim.patientInsuranceId,
      preAuthorizationId: claim.preAuthorizationId,
      insuranceProvider: claim.insuranceProvider,
      policyNumber: claim.policyNumber,
      membershipId: claim.membershipId,
      claimedAmount: claim.claimedAmount.toString(),
      approvedAmount: claim.approvedAmount?.toString() ?? null,
      rejectedAmount: claim.rejectedAmount?.toString() ?? null,
      insuranceShare: claim.insuranceShare?.toString() ?? null,
      patientShare: claim.patientShare?.toString() ?? null,
      adjustmentAmount: claim.adjustmentAmount.toString(),
      writeOffAmount: claim.writeOffAmount.toString(),
      outstandingAmount: claim.outstandingAmount?.toString() ?? null,
      paymentStatus: claim.paymentStatus as unknown as ClaimPaymentStatus,
      status: claim.status as unknown as InsuranceClaimStatus,
      rejectionReason: claim.rejectionReason,
      submittedAt: claim.submittedAt,
      settledAt: claim.settledAt,
      closedAt: claim.closedAt,
      createdByUserId: claim.createdByUserId,
      createdAt: claim.createdAt,
      updatedAt: claim.updatedAt,
      patient: {
        id: claim.patient.id,
        fullName: `${claim.patient.firstName} ${claim.patient.lastName}`,
        uhid: claim.patient.uhid,
      },
      invoice: {
        id: claim.invoice.id,
        invoiceNumber: claim.invoice.invoiceNumber,
        totalAmount: claim.invoice.totalAmount.toString(),
        balanceDue: claim.invoice.balanceDue.toString(),
      },
      documents: claim.documents.map((d) => ({
        id: d.id,
        claimId: d.claimId,
        organizationId: d.organizationId,
        type: d.type as unknown as ClaimDocumentType,
        fileName: d.fileName,
        fileUrl: d.fileUrl,
        autoAttached: d.autoAttached,
        uploadedByUserId: d.uploadedByUserId,
        createdAt: d.createdAt,
      })),
    }
  }
}
