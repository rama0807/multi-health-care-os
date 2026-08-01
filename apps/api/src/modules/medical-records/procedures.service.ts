import { CreateProcedureDto, Procedure } from '@medicore/types'
import { Injectable } from '@nestjs/common'
import { Procedure as PrismaProcedure } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { EncountersService } from './encounters.service'

@Injectable()
export class ProceduresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encountersService: EncountersService,
  ) {}

  async list(organizationId: string, encounterId: string): Promise<Procedure[]> {
    await this.encountersService.requireEncounter(organizationId, encounterId)
    const procedures = await this.prisma.procedure.findMany({
      where: { encounterId },
      orderBy: { performedAt: 'asc' },
    })
    return procedures.map((p) => this.toResponse(p))
  }

  async create(organizationId: string, encounterId: string, dto: CreateProcedureDto): Promise<Procedure> {
    await this.encountersService.requireEncounter(organizationId, encounterId)
    const procedure = await this.prisma.procedure.create({
      data: {
        encounterId,
        name: dto.name,
        notes: dto.notes,
        performedAt: dto.performedAt ? new Date(dto.performedAt) : undefined,
      },
    })
    return this.toResponse(procedure)
  }

  private toResponse(procedure: PrismaProcedure): Procedure {
    return {
      id: procedure.id,
      encounterId: procedure.encounterId,
      name: procedure.name,
      notes: procedure.notes,
      performedAt: procedure.performedAt,
      createdAt: procedure.createdAt,
    }
  }
}
