import { CreateIntakeOutputDto, IntakeOutputQuery, IntakeOutputRecord } from '@medicore/types'
import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { IntakeOutputRecord as PrismaIntakeOutputRecord } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { AdmissionsService } from './admissions.service'

/** Intake/Output chart, admission-scoped. */
@Injectable()
export class IntakeOutputService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly admissionsService: AdmissionsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(organizationId: string, admissionId: string, query: IntakeOutputQuery) {
    await this.admissionsService.requireAdmission(organizationId, admissionId)
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20

    const [data, total] = await Promise.all([
      this.prisma.intakeOutputRecord.findMany({
        where: { admissionId, organizationId },
        orderBy: { recordedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.intakeOutputRecord.count({ where: { admissionId, organizationId } }),
    ])

    return {
      data: data.map((r) => this.toResponse(r)),
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
    dto: CreateIntakeOutputDto,
    actorUserId: string,
  ): Promise<IntakeOutputRecord> {
    const admission = await this.admissionsService.requireAdmission(organizationId, admissionId)

    const record = await this.prisma.intakeOutputRecord.create({
      data: {
        admissionId,
        organizationId,
        oralIntakeMl: dto.oralIntakeMl,
        ivFluidIntakeMl: dto.ivFluidIntakeMl,
        otherIntakeMl: dto.otherIntakeMl,
        urineOutputMl: dto.urineOutputMl,
        stoolOutputCount: dto.stoolOutputCount,
        vomitusMl: dto.vomitusMl,
        drainOutputMl: dto.drainOutputMl,
        otherOutputMl: dto.otherOutputMl,
        notes: dto.notes,
        recordedByUserId: actorUserId,
      },
    })

    this.eventEmitter.emit('ipd.intake_output_recorded', {
      intakeOutputRecordId: record.id,
      admissionId,
      patientId: admission.patientId,
      organizationId,
      userId: actorUserId,
    })

    return this.toResponse(record)
  }

  private toResponse(record: PrismaIntakeOutputRecord): IntakeOutputRecord {
    const totalIntakeMl = (record.oralIntakeMl ?? 0) + (record.ivFluidIntakeMl ?? 0) + (record.otherIntakeMl ?? 0)
    const totalOutputMl =
      (record.urineOutputMl ?? 0) + (record.vomitusMl ?? 0) + (record.drainOutputMl ?? 0) + (record.otherOutputMl ?? 0)

    return {
      id: record.id,
      admissionId: record.admissionId,
      organizationId: record.organizationId,
      recordedAt: record.recordedAt,
      oralIntakeMl: record.oralIntakeMl,
      ivFluidIntakeMl: record.ivFluidIntakeMl,
      otherIntakeMl: record.otherIntakeMl,
      urineOutputMl: record.urineOutputMl,
      stoolOutputCount: record.stoolOutputCount,
      vomitusMl: record.vomitusMl,
      drainOutputMl: record.drainOutputMl,
      otherOutputMl: record.otherOutputMl,
      notes: record.notes,
      recordedByUserId: record.recordedByUserId,
      totalIntakeMl,
      totalOutputMl,
      balanceMl: totalIntakeMl - totalOutputMl,
    }
  }
}
