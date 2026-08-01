import { CreateDiagnosisDto, Diagnosis, DiagnosisType } from '@medicore/types'
import { Injectable } from '@nestjs/common'
import { Diagnosis as PrismaDiagnosis, DiagnosisType as PrismaDiagnosisType } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { EncountersService } from './encounters.service'

@Injectable()
export class DiagnosesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encountersService: EncountersService,
  ) {}

  async list(organizationId: string, encounterId: string): Promise<Diagnosis[]> {
    await this.encountersService.requireEncounter(organizationId, encounterId)
    const diagnoses = await this.prisma.diagnosis.findMany({
      where: { encounterId },
      orderBy: { createdAt: 'asc' },
    })
    return diagnoses.map((d) => this.toResponse(d))
  }

  async create(organizationId: string, encounterId: string, dto: CreateDiagnosisDto): Promise<Diagnosis> {
    await this.encountersService.requireEncounter(organizationId, encounterId)
    const diagnosis = await this.prisma.diagnosis.create({
      data: {
        encounterId,
        type: dto.type as unknown as PrismaDiagnosisType,
        description: dto.description,
        icdCode: dto.icdCode,
      },
    })
    return this.toResponse(diagnosis)
  }

  private toResponse(diagnosis: PrismaDiagnosis): Diagnosis {
    return {
      id: diagnosis.id,
      encounterId: diagnosis.encounterId,
      type: diagnosis.type as unknown as DiagnosisType,
      description: diagnosis.description,
      icdCode: diagnosis.icdCode,
      createdAt: diagnosis.createdAt,
    }
  }
}
