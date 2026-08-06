import { NursingNoteType } from '@medicore/types'

import { NursingNotesService } from './nursing-notes.service'

describe('NursingNotesService', () => {
  let prisma: { nursingNote: Record<string, jest.Mock> }
  let admissionsService: { requireAdmission: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let service: NursingNotesService

  beforeEach(() => {
    prisma = { nursingNote: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn() } }
    admissionsService = { requireAdmission: jest.fn().mockResolvedValue({ id: 'adm_1', patientId: 'patient_1' }) }
    eventEmitter = { emit: jest.fn() }
    service = new NursingNotesService(prisma as never, admissionsService as never, eventEmitter as never)
  })

  it('creates a nursing note and emits the created event', async () => {
    prisma.nursingNote.create.mockResolvedValue({
      id: 'note_1',
      admissionId: 'adm_1',
      organizationId: 'org_1',
      type: 'SHIFT_HANDOVER',
      shift: 'MORNING',
      content: 'Patient stable overnight',
      isEscalated: false,
      escalationReason: null,
      createdByUserId: 'nurse_1',
      createdAt: new Date(),
    })

    const result = await service.create(
      'org_1',
      'adm_1',
      { type: NursingNoteType.SHIFT_HANDOVER, shift: 'MORNING', content: 'Patient stable overnight', isEscalated: false } as never,
      'nurse_1',
    )

    expect(admissionsService.requireAdmission).toHaveBeenCalledWith('org_1', 'adm_1')
    expect(result.type).toBe('SHIFT_HANDOVER')
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'ipd.nursing_note_created',
      expect.objectContaining({ admissionId: 'adm_1', isEscalated: false }),
    )
  })

  it('flags an escalated note in the emitted event', async () => {
    prisma.nursingNote.create.mockResolvedValue({
      id: 'note_2',
      admissionId: 'adm_1',
      organizationId: 'org_1',
      type: 'INCIDENT',
      shift: null,
      content: 'Patient fell - required assistance',
      isEscalated: true,
      escalationReason: 'Fall',
      createdByUserId: 'nurse_1',
      createdAt: new Date(),
    })

    await service.create(
      'org_1',
      'adm_1',
      { type: NursingNoteType.INCIDENT, content: 'Patient fell', isEscalated: true, escalationReason: 'Fall' } as never,
      'nurse_1',
    )

    expect(eventEmitter.emit).toHaveBeenCalledWith('ipd.nursing_note_created', expect.objectContaining({ isEscalated: true }))
  })

  it('lists notes for an admission after validating it exists', async () => {
    prisma.nursingNote.findMany.mockResolvedValue([
      { id: 'note_1', admissionId: 'adm_1', organizationId: 'org_1', type: 'GENERAL', shift: null, content: 'x', isEscalated: false, escalationReason: null, createdByUserId: 'u1', createdAt: new Date() },
    ])
    prisma.nursingNote.count.mockResolvedValue(1)

    const result = await service.list('org_1', 'adm_1', {})

    expect(admissionsService.requireAdmission).toHaveBeenCalledWith('org_1', 'adm_1')
    expect(result.data).toHaveLength(1)
    expect(result.pagination.total).toBe(1)
  })
})
