import {
  CreatePatientInsuranceDto,
  PatientInsuranceStatus,
  PatientInsuranceWithDetails,
  UpdatePatientInsuranceDto,
} from '@medicore/types'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { PatientInsurance as PrismaPatientInsurance, Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { InsurancePlansService } from './insurance-plans.service'

type PatientInsuranceWithRelations = PrismaPatientInsurance & {
  provider: { id: string; name: string; code: string }
  plan: { id: string; name: string; code: string; coveragePercent: Prisma.Decimal; coPayPercent: Prisma.Decimal }
}

const PATIENT_INSURANCE_INCLUDE = {
  provider: { select: { id: true, name: true, code: true } },
  plan: { select: { id: true, name: true, code: true, coveragePercent: true, coPayPercent: true } },
} satisfies Prisma.PatientInsuranceInclude

/**
 * A patient's enrollment in a plan ("each patient may have Primary
 * Insurance, Secondary Insurance") — see ADR-0016. Not own-scoped: any
 * staff member handling billing/claims for this patient needs it, not just
 * the treating doctor.
 */
@Injectable()
export class PatientInsuranceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plansService: InsurancePlansService,
  ) {}

  async list(organizationId: string, patientId: string): Promise<PatientInsuranceWithDetails[]> {
    await this.requirePatient(organizationId, patientId)
    const records = await this.prisma.patientInsurance.findMany({
      where: { organizationId, patientId },
      include: PATIENT_INSURANCE_INCLUDE,
      orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
    })
    return records.map((r) => this.toResponse(r))
  }

  async getById(organizationId: string, patientId: string, id: string): Promise<PatientInsuranceWithDetails> {
    return this.toResponse(await this.requireOwnRecord(organizationId, patientId, id))
  }

  async create(
    organizationId: string,
    patientId: string,
    dto: CreatePatientInsuranceDto,
  ): Promise<PatientInsuranceWithDetails> {
    await this.requirePatient(organizationId, patientId)
    const plan = await this.plansService.requirePlan(organizationId, dto.planId)
    if (plan.providerId !== dto.providerId) {
      throw new ConflictException('The selected plan does not belong to the selected provider')
    }

    const existingActive = await this.prisma.patientInsurance.findFirst({
      where: { organizationId, patientId, type: dto.type, status: PatientInsuranceStatus.ACTIVE },
    })
    if (existingActive) {
      throw new ConflictException(
        `Patient already has an active ${dto.type.toLowerCase()} insurance — expire or deactivate it first`,
      )
    }

    const record = await this.prisma.patientInsurance.create({
      data: {
        organizationId,
        patientId,
        providerId: dto.providerId,
        planId: dto.planId,
        type: dto.type,
        memberId: dto.memberId,
        policyNumber: dto.policyNumber,
        effectiveDate: dto.effectiveDate,
        expiryDate: dto.expiryDate,
        coveragePercent: dto.coveragePercent,
      },
      include: PATIENT_INSURANCE_INCLUDE,
    })
    return this.toResponse(record)
  }

  async update(
    organizationId: string,
    patientId: string,
    id: string,
    dto: UpdatePatientInsuranceDto,
  ): Promise<PatientInsuranceWithDetails> {
    await this.requireOwnRecord(organizationId, patientId, id)
    const record = await this.prisma.patientInsurance.update({
      where: { id },
      data: dto,
      include: PATIENT_INSURANCE_INCLUDE,
    })
    return this.toResponse(record)
  }

  /** Used by pre-authorization/claim creation to resolve coverage terms. */
  async requireActiveCoverage(organizationId: string, id: string): Promise<PatientInsuranceWithRelations> {
    const record = await this.prisma.patientInsurance.findFirst({
      where: { id, organizationId },
      include: PATIENT_INSURANCE_INCLUDE,
    })
    if (!record) throw new NotFoundException('Patient insurance coverage not found')
    if (record.status !== PatientInsuranceStatus.ACTIVE) {
      throw new ConflictException(`This coverage is ${record.status.toLowerCase()}, not active`)
    }
    return record as PatientInsuranceWithRelations
  }

  private async requirePatient(organizationId: string, patientId: string): Promise<void> {
    const patient = await this.prisma.patient.findFirst({ where: { id: patientId, organizationId } })
    if (!patient) throw new NotFoundException('Patient not found')
  }

  private async requireOwnRecord(
    organizationId: string,
    patientId: string,
    id: string,
  ): Promise<PatientInsuranceWithRelations> {
    const record = await this.prisma.patientInsurance.findFirst({
      where: { id, patientId, organizationId },
      include: PATIENT_INSURANCE_INCLUDE,
    })
    if (!record) throw new NotFoundException('Patient insurance coverage not found')
    return record as PatientInsuranceWithRelations
  }

  private toResponse(record: PatientInsuranceWithRelations): PatientInsuranceWithDetails {
    return {
      id: record.id,
      organizationId: record.organizationId,
      patientId: record.patientId,
      providerId: record.providerId,
      planId: record.planId,
      type: record.type as unknown as PatientInsuranceWithDetails['type'],
      memberId: record.memberId,
      policyNumber: record.policyNumber,
      effectiveDate: record.effectiveDate,
      expiryDate: record.expiryDate,
      coveragePercent: record.coveragePercent?.toString() ?? null,
      status: record.status as unknown as PatientInsuranceWithDetails['status'],
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      provider: record.provider,
      plan: {
        id: record.plan.id,
        name: record.plan.name,
        code: record.plan.code,
        coveragePercent: record.plan.coveragePercent.toString(),
        coPayPercent: record.plan.coPayPercent.toString(),
      },
    }
  }
}
