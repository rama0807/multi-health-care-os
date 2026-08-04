import { CreateNursingNoteDto, NursingNote, NursingNoteQuery, NursingNoteType } from '@medicore/types'
import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { NursingNote as PrismaNursingNote, Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { AdmissionsService } from './admissions.service'

/** Nursing notes — general/shift-handover/assessment/incident, admission-scoped. See ADR-0019. */
@Injectable()
export class NursingNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly admissionsService: AdmissionsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(organizationId: string, admissionId: string, query: NursingNoteQuery) {
    await this.admissionsService.requireAdmission(organizationId, admissionId)
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20

    const where: Prisma.NursingNoteWhereInput = { admissionId, organizationId }
    if (query.type) where.type = query.type as unknown as Prisma.NursingNoteWhereInput['type']
    if (query.isEscalated !== undefined) where.isEscalated = query.isEscalated

    const [data, total] = await Promise.all([
      this.prisma.nursingNote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.nursingNote.count({ where }),
    ])

    return {
      data: data.map((n) => this.toResponse(n)),
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
    dto: CreateNursingNoteDto,
    actorUserId: string,
  ): Promise<NursingNote> {
    const admission = await this.admissionsService.requireAdmission(organizationId, admissionId)

    const note = await this.prisma.nursingNote.create({
      data: {
        admissionId,
        organizationId,
        type: dto.type as unknown as Prisma.NursingNoteCreateInput['type'],
        shift: dto.shift as unknown as Prisma.NursingNoteCreateInput['shift'],
        content: dto.content,
        isEscalated: dto.isEscalated,
        escalationReason: dto.escalationReason,
        createdByUserId: actorUserId,
      },
    })

    this.eventEmitter.emit('ipd.nursing_note_created', {
      nursingNoteId: note.id,
      admissionId,
      patientId: admission.patientId,
      organizationId,
      userId: actorUserId,
      isEscalated: note.isEscalated,
    })

    return this.toResponse(note)
  }

  private toResponse(note: PrismaNursingNote): NursingNote {
    return {
      id: note.id,
      admissionId: note.admissionId,
      organizationId: note.organizationId,
      type: note.type as unknown as NursingNoteType,
      shift: note.shift as unknown as NursingNote['shift'],
      content: note.content,
      isEscalated: note.isEscalated,
      escalationReason: note.escalationReason,
      createdByUserId: note.createdByUserId,
      createdAt: note.createdAt,
    }
  }
}
