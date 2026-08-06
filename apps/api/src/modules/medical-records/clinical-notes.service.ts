import { ClinicalNote, CreateClinicalNoteDto } from '@medicore/types'
import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { ClinicalNote as PrismaClinicalNote } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { EncountersService } from './encounters.service'

@Injectable()
export class ClinicalNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encountersService: EncountersService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(organizationId: string, encounterId: string): Promise<ClinicalNote[]> {
    await this.encountersService.requireEncounter(organizationId, encounterId)
    const notes = await this.prisma.clinicalNote.findMany({
      where: { encounterId },
      orderBy: { version: 'desc' },
    })
    return notes.map((n) => this.toResponse(n))
  }

  async getCurrent(organizationId: string, encounterId: string): Promise<ClinicalNote | null> {
    await this.encountersService.requireEncounter(organizationId, encounterId)
    const note = await this.prisma.clinicalNote.findFirst({
      where: { encounterId },
      orderBy: { version: 'desc' },
    })
    return note ? this.toResponse(note) : null
  }

  /**
   * Always inserts a new version - never updates an existing row. This is
   * the entire enforcement of "never overwrite historical notes" (ADR-0008):
   * there is deliberately no `update` method on this service.
   */
  async createVersion(
    organizationId: string,
    encounterId: string,
    dto: CreateClinicalNoteDto,
    actorUserId: string,
  ): Promise<ClinicalNote> {
    await this.encountersService.requireEncounter(organizationId, encounterId)

    const latest = await this.prisma.clinicalNote.findFirst({
      where: { encounterId },
      orderBy: { version: 'desc' },
      select: { version: true },
    })
    const version = (latest?.version ?? 0) + 1

    const note = await this.prisma.clinicalNote.create({
      data: {
        encounterId,
        version,
        chiefComplaint: dto.chiefComplaint,
        historyOfPresentIllness: dto.historyOfPresentIllness,
        pastMedicalHistory: dto.pastMedicalHistory,
        familyHistory: dto.familyHistory,
        surgicalHistory: dto.surgicalHistory,
        socialHistory: dto.socialHistory,
        allergies: dto.allergies,
        currentMedications: dto.currentMedications,
        createdByUserId: actorUserId,
      },
    })

    this.eventEmitter.emit('clinical_note.created', {
      encounterId,
      noteId: note.id,
      version,
      organizationId,
      userId: actorUserId,
    })

    return this.toResponse(note)
  }

  private toResponse(note: PrismaClinicalNote): ClinicalNote {
    return {
      id: note.id,
      encounterId: note.encounterId,
      version: note.version,
      chiefComplaint: note.chiefComplaint,
      historyOfPresentIllness: note.historyOfPresentIllness,
      pastMedicalHistory: note.pastMedicalHistory,
      familyHistory: note.familyHistory,
      surgicalHistory: note.surgicalHistory,
      socialHistory: note.socialHistory,
      allergies: note.allergies,
      currentMedications: note.currentMedications,
      createdByUserId: note.createdByUserId,
      createdAt: note.createdAt,
    }
  }
}
