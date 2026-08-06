import {
  CreateNursingAssessmentDto,
  FallRiskLevel,
  NursingAssessment,
  NursingAssessmentQuery,
  PressureUlcerRiskLevel,
} from '@medicore/types'
import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { NursingAssessment as PrismaNursingAssessment } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { AdmissionsService } from './admissions.service'

/**
 * Fall-risk level derived from a Morse Fall Scale-style score (0-125):
 * <25 Low, 25-44 Medium, >=45 High. Braden risk level from the standard
 * Braden Scale (6-23, lower = higher risk): >=19 Low, 15-18 Moderate,
 * 13-14 High, <=12 Severe. Both are disclosed, documented thresholds, not
 * a validated clinical scoring service.
 */
function deriveFallRiskLevel(score?: number): FallRiskLevel | undefined {
  if (score === undefined) return undefined
  if (score >= 45) return FallRiskLevel.HIGH
  if (score >= 25) return FallRiskLevel.MEDIUM
  return FallRiskLevel.LOW
}

function deriveBradenRiskLevel(score?: number): PressureUlcerRiskLevel | undefined {
  if (score === undefined) return undefined
  if (score <= 9) return PressureUlcerRiskLevel.SEVERE
  if (score <= 12) return PressureUlcerRiskLevel.HIGH
  if (score <= 18) return PressureUlcerRiskLevel.MODERATE
  return PressureUlcerRiskLevel.LOW
}

/** Pain / fall risk / Braden / GCS / daily assessment - one consolidated row per charting event. */
@Injectable()
export class NursingAssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly admissionsService: AdmissionsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(organizationId: string, admissionId: string, query: NursingAssessmentQuery) {
    await this.admissionsService.requireAdmission(organizationId, admissionId)
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20

    const [data, total] = await Promise.all([
      this.prisma.nursingAssessment.findMany({
        where: { admissionId, organizationId },
        orderBy: { assessedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.nursingAssessment.count({ where: { admissionId, organizationId } }),
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

  async create(
    organizationId: string,
    admissionId: string,
    dto: CreateNursingAssessmentDto,
    actorUserId: string,
  ): Promise<NursingAssessment> {
    const admission = await this.admissionsService.requireAdmission(organizationId, admissionId)

    const gcsTotal =
      dto.gcsEye !== undefined && dto.gcsVerbal !== undefined && dto.gcsMotor !== undefined
        ? dto.gcsEye + dto.gcsVerbal + dto.gcsMotor
        : undefined

    const assessment = await this.prisma.nursingAssessment.create({
      data: {
        admissionId,
        organizationId,
        painScore: dto.painScore,
        fallRiskScore: dto.fallRiskScore,
        fallRiskLevel: deriveFallRiskLevel(dto.fallRiskScore) as never,
        bradenScore: dto.bradenScore,
        bradenRiskLevel: deriveBradenRiskLevel(dto.bradenScore) as never,
        gcsEye: dto.gcsEye,
        gcsVerbal: dto.gcsVerbal,
        gcsMotor: dto.gcsMotor,
        gcsTotal,
        generalNotes: dto.generalNotes,
        assessedByUserId: actorUserId,
      },
    })

    this.eventEmitter.emit('ipd.nursing_assessment_created', {
      nursingAssessmentId: assessment.id,
      admissionId,
      patientId: admission.patientId,
      organizationId,
      userId: actorUserId,
      fallRiskLevel: assessment.fallRiskLevel,
      bradenRiskLevel: assessment.bradenRiskLevel,
    })

    return this.toResponse(assessment)
  }

  private toResponse(assessment: PrismaNursingAssessment): NursingAssessment {
    return {
      id: assessment.id,
      admissionId: assessment.admissionId,
      organizationId: assessment.organizationId,
      painScore: assessment.painScore,
      fallRiskScore: assessment.fallRiskScore,
      fallRiskLevel: assessment.fallRiskLevel as unknown as FallRiskLevel | null,
      bradenScore: assessment.bradenScore,
      bradenRiskLevel: assessment.bradenRiskLevel as unknown as PressureUlcerRiskLevel | null,
      gcsEye: assessment.gcsEye,
      gcsVerbal: assessment.gcsVerbal,
      gcsMotor: assessment.gcsMotor,
      gcsTotal: assessment.gcsTotal,
      generalNotes: assessment.generalNotes,
      assessedByUserId: assessment.assessedByUserId,
      assessedAt: assessment.assessedAt,
    }
  }
}
