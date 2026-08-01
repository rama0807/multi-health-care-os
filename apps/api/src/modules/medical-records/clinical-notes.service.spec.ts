import { ClinicalNotesService } from './clinical-notes.service'

function buildNoteRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'note_1',
    encounterId: 'enc_1',
    version: 1,
    chiefComplaint: 'Chest pain',
    historyOfPresentIllness: null,
    pastMedicalHistory: null,
    familyHistory: null,
    surgicalHistory: null,
    socialHistory: null,
    allergies: null,
    currentMedications: null,
    createdByUserId: 'user_1',
    createdAt: new Date(),
    ...overrides,
  }
}

describe('ClinicalNotesService', () => {
  let prisma: { clinicalNote: Record<string, jest.Mock> }
  let encountersService: { requireEncounter: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let service: ClinicalNotesService

  beforeEach(() => {
    prisma = { clinicalNote: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() } }
    encountersService = { requireEncounter: jest.fn().mockResolvedValue({ id: 'enc_1' }) }
    eventEmitter = { emit: jest.fn() }

    service = new ClinicalNotesService(prisma as never, encountersService as never, eventEmitter as never)
  })

  afterEach(() => jest.clearAllMocks())

  describe('createVersion', () => {
    it('starts at version 1 when no prior note exists', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue(null)
      prisma.clinicalNote.create.mockResolvedValue(buildNoteRow({ version: 1 }))

      const result = await service.createVersion('org_1', 'enc_1', { chiefComplaint: 'Chest pain' } as never, 'user_1')

      expect(prisma.clinicalNote.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ version: 1 }) }),
      )
      expect(result.version).toBe(1)
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'clinical_note.created',
        expect.objectContaining({ encounterId: 'enc_1', version: 1, userId: 'user_1' }),
      )
    })

    it('increments the version rather than overwriting when a note already exists', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue({ version: 3 })
      prisma.clinicalNote.create.mockResolvedValue(buildNoteRow({ version: 4 }))

      const result = await service.createVersion('org_1', 'enc_1', { chiefComplaint: 'Follow-up' } as never, 'user_1')

      expect(prisma.clinicalNote.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ version: 4 }) }),
      )
      expect(result.version).toBe(4)
    })

    it('validates the parent encounter exists before creating a note', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue(null)
      prisma.clinicalNote.create.mockResolvedValue(buildNoteRow({ version: 1 }))

      await service.createVersion('org_1', 'enc_1', {} as never, 'user_1')

      expect(encountersService.requireEncounter).toHaveBeenCalledWith('org_1', 'enc_1')
    })
  })

  describe('getCurrent', () => {
    it('returns the highest-version note', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue(buildNoteRow({ version: 5 }))

      const result = await service.getCurrent('org_1', 'enc_1')

      expect(prisma.clinicalNote.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { version: 'desc' } }),
      )
      expect(result?.version).toBe(5)
    })

    it('returns null when no notes exist yet', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue(null)

      const result = await service.getCurrent('org_1', 'enc_1')

      expect(result).toBeNull()
    })
  })

  describe('list', () => {
    it('returns full version history ordered newest-first', async () => {
      prisma.clinicalNote.findMany.mockResolvedValue([buildNoteRow({ version: 2 }), buildNoteRow({ version: 1 })])

      const result = await service.list('org_1', 'enc_1')

      expect(result).toHaveLength(2)
      expect(result[0].version).toBe(2)
    })
  })
})
