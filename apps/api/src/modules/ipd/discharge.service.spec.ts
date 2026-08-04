import { BadRequestException, ConflictException } from '@nestjs/common'

import { DischargeService } from './discharge.service'

function buildAdmissionRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'adm_1',
    organizationId: 'org_1',
    patientId: 'patient_1',
    status: 'ADMITTED',
    bedId: 'bed_1',
    roomId: 'room_1',
    encounterId: 'enc_1',
    dischargeApprovedAt: null,
    dischargeCondition: null,
    expectedDischargeAt: null,
    admittedAt: new Date('2026-08-01T00:00:00Z'),
    ...overrides,
  }
}

const ALL_CHECKLIST_KEYS = [
  'VITALS_STABLE',
  'MEDICATION_RECONCILIATION_DONE',
  'PATIENT_EDUCATION_GIVEN',
  'BELONGINGS_RETURNED',
  'WOUND_CARE_INSTRUCTIONS_GIVEN',
  'EQUIPMENT_RETURNED',
  'FOLLOWUP_EXPLAINED',
  'TRANSPORT_ARRANGED',
]

describe('DischargeService', () => {
  let prisma: {
    admission: Record<string, jest.Mock>
    dischargeChecklistItem: Record<string, jest.Mock>
    dischargeSummary: Record<string, jest.Mock>
    room: Record<string, jest.Mock>
    encounter: Record<string, jest.Mock>
    organization: Record<string, jest.Mock>
    prescription: Record<string, jest.Mock>
    $transaction: jest.Mock
  }
  let admissionsService: { requireAdmission: jest.Mock; getById: jest.Mock }
  let bedAllocationService: { vacate: jest.Mock }
  let chargesService: { create: jest.Mock }
  let encountersService: { updateStatus: jest.Mock }
  let doctorRef: { requireDoctor: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let service: DischargeService

  beforeEach(() => {
    prisma = {
      admission: { update: jest.fn().mockResolvedValue({}) },
      dischargeChecklistItem: {
        createMany: jest.fn().mockResolvedValue({ count: 8 }),
        findMany: jest.fn().mockResolvedValue(ALL_CHECKLIST_KEYS.map((itemKey) => ({ itemKey, completed: true }))),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      dischargeSummary: { findFirst: jest.fn(), upsert: jest.fn() },
      room: { findUnique: jest.fn() },
      encounter: { findUnique: jest.fn() },
      organization: { findUniqueOrThrow: jest.fn() },
      prescription: { findFirst: jest.fn() },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    }
    admissionsService = {
      requireAdmission: jest.fn().mockResolvedValue(buildAdmissionRow()),
      getById: jest.fn().mockResolvedValue({ id: 'adm_1' }),
    }
    bedAllocationService = { vacate: jest.fn().mockResolvedValue({}) }
    chargesService = { create: jest.fn().mockResolvedValue({}) }
    encountersService = { updateStatus: jest.fn().mockResolvedValue({}) }
    doctorRef = { requireDoctor: jest.fn() }
    eventEmitter = { emit: jest.fn() }
    service = new DischargeService(
      prisma as never,
      admissionsService as never,
      bedAllocationService as never,
      chargesService as never,
      encountersService as never,
      doctorRef as never,
      eventEmitter as never,
    )
  })

  describe('approve', () => {
    it('stamps approval and seeds the discharge checklist', async () => {
      await service.approve('org_1', 'adm_1', { dischargeCondition: 'Stable' } as never, 'doc_1')

      expect(prisma.dischargeChecklistItem.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ skipDuplicates: true }),
      )
      expect(eventEmitter.emit).toHaveBeenCalledWith('ipd.discharge_approved', expect.objectContaining({ admissionId: 'adm_1' }))
    })

    it('rejects re-approving an admission that is already approved', async () => {
      admissionsService.requireAdmission.mockResolvedValue(buildAdmissionRow({ dischargeApprovedAt: new Date() }))

      await expect(service.approve('org_1', 'adm_1', {} as never, 'doc_1')).rejects.toThrow(ConflictException)
    })

    it('rejects approving a non-active admission', async () => {
      admissionsService.requireAdmission.mockResolvedValue(buildAdmissionRow({ status: 'DISCHARGED' }))

      await expect(service.approve('org_1', 'adm_1', {} as never, 'doc_1')).rejects.toThrow(ConflictException)
    })
  })

  describe('updateChecklistItem', () => {
    it('requires discharge to be approved first', async () => {
      admissionsService.requireAdmission.mockResolvedValue(buildAdmissionRow({ dischargeApprovedAt: null }))

      await expect(
        service.updateChecklistItem('org_1', 'adm_1', 'VITALS_STABLE' as never, { completed: true } as never, 'nurse_1'),
      ).rejects.toThrow(BadRequestException)
    })

    it('marks an item completed and stamps the actor', async () => {
      admissionsService.requireAdmission.mockResolvedValue(buildAdmissionRow({ dischargeApprovedAt: new Date() }))
      prisma.dischargeChecklistItem.findFirst.mockResolvedValue({ id: 'chk_1' })
      prisma.dischargeChecklistItem.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'chk_1', admissionId: 'adm_1', organizationId: 'org_1', itemKey: 'VITALS_STABLE', createdAt: new Date(), ...data }),
      )

      const result = await service.updateChecklistItem(
        'org_1',
        'adm_1',
        'VITALS_STABLE' as never,
        { completed: true } as never,
        'nurse_1',
      )

      expect(result.completed).toBe(true)
      expect(result.completedByUserId).toBe('nurse_1')
    })
  })

  describe('complete', () => {
    it('rejects finalizing before discharge is approved', async () => {
      admissionsService.requireAdmission.mockResolvedValue(buildAdmissionRow({ dischargeApprovedAt: null }))

      await expect(service.complete('org_1', 'adm_1', {} as never, 'doc_1')).rejects.toThrow(BadRequestException)
    })

    it('rejects finalizing with incomplete checklist items', async () => {
      admissionsService.requireAdmission.mockResolvedValue(buildAdmissionRow({ dischargeApprovedAt: new Date() }))
      prisma.dischargeChecklistItem.findMany.mockResolvedValue([
        { itemKey: 'VITALS_STABLE', completed: true },
        { itemKey: 'MEDICATION_RECONCILIATION_DONE', completed: false },
      ])

      await expect(service.complete('org_1', 'adm_1', {} as never, 'doc_1')).rejects.toThrow(ConflictException)
    })

    it('rejects finalizing without a discharge summary', async () => {
      admissionsService.requireAdmission.mockResolvedValue(buildAdmissionRow({ dischargeApprovedAt: new Date() }))
      prisma.dischargeSummary.findFirst.mockResolvedValue(null)

      await expect(service.complete('org_1', 'adm_1', {} as never, 'doc_1')).rejects.toThrow(BadRequestException)
    })

    it('vacates the bed, raises a room charge, closes the encounter, and discharges the admission', async () => {
      admissionsService.requireAdmission.mockResolvedValue(
        buildAdmissionRow({ dischargeApprovedAt: new Date(), admittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }),
      )
      prisma.dischargeSummary.findFirst.mockResolvedValue({ id: 'sum_1', finalDiagnosis: 'Viral fever' })
      prisma.room.findUnique.mockResolvedValue({ id: 'room_1', chargesPerDay: '1500', ward: { name: 'General Ward' } })
      prisma.encounter.findUnique.mockResolvedValue({ id: 'enc_1', status: 'IN_PROGRESS' })

      const result = await service.complete('org_1', 'adm_1', { dischargeNotes: 'Recovered well' } as never, 'doc_1')

      expect(bedAllocationService.vacate).toHaveBeenCalledWith('org_1', 'adm_1', { reason: 'Discharged' }, 'doc_1')
      expect(chargesService.create).toHaveBeenCalledWith(
        'org_1',
        expect.objectContaining({ sourceModule: 'IPD', quantity: expect.any(Number) }),
        'doc_1',
      )
      expect(chargesService.create.mock.calls[0][1].quantity).toBeGreaterThanOrEqual(2)
      expect(encountersService.updateStatus).toHaveBeenCalledWith('org_1', 'enc_1', { status: 'COMPLETED' }, 'doc_1')
      expect(prisma.admission.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'DISCHARGED' }) }),
      )
      expect(eventEmitter.emit).toHaveBeenCalledWith('ipd.discharge_completed', expect.objectContaining({ admissionId: 'adm_1' }))
      expect(result).toEqual({ id: 'adm_1' })
    })

    it('skips vacating when no bed is currently allocated', async () => {
      admissionsService.requireAdmission.mockResolvedValue(
        buildAdmissionRow({ dischargeApprovedAt: new Date(), bedId: null, roomId: null, encounterId: null }),
      )
      prisma.dischargeSummary.findFirst.mockResolvedValue({ id: 'sum_1', finalDiagnosis: 'Viral fever' })

      await service.complete('org_1', 'adm_1', {} as never, 'doc_1')

      expect(bedAllocationService.vacate).not.toHaveBeenCalled()
      expect(chargesService.create).not.toHaveBeenCalled()
    })
  })
})
