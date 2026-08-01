import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'

import { EncountersService } from './encounters.service'

function buildEncounterRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'enc_1',
    patientId: 'patient_1',
    doctorId: 'doctor_1',
    appointmentId: null,
    organizationId: 'org_1',
    type: 'OPD',
    status: 'IN_PROGRESS',
    notes: null,
    encounterDate: new Date('2026-08-01'),
    createdAt: new Date(),
    updatedAt: new Date(),
    patient: { id: 'patient_1', firstName: 'Vikram', lastName: 'Nair', uhid: 'MED-2026-000001' },
    doctor: { id: 'doctor_1', specialization: 'Cardiology', user: { firstName: 'Priya', lastName: 'Sharma' } },
    ...overrides,
  }
}

describe('EncountersService', () => {
  let prisma: {
    encounter: Record<string, jest.Mock>
    patient: Record<string, jest.Mock>
    appointment: Record<string, jest.Mock>
  }
  let doctorRef: { requireDoctor: jest.Mock; findDoctorProfileForUser: jest.Mock }
  let permissionsService: { getScope: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let service: EncountersService

  beforeEach(() => {
    prisma = {
      encounter: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
      patient: { findFirst: jest.fn() },
      appointment: { findFirst: jest.fn() },
    }
    doctorRef = {
      requireDoctor: jest.fn().mockResolvedValue({ id: 'doctor_1' }),
      findDoctorProfileForUser: jest.fn(),
    }
    permissionsService = { getScope: jest.fn().mockReturnValue('all') }
    eventEmitter = { emit: jest.fn() }

    service = new EncountersService(prisma as never, doctorRef as never, permissionsService as never, eventEmitter as never)
  })

  afterEach(() => jest.clearAllMocks())

  describe('create', () => {
    const validDto = { patientId: 'patient_1', doctorId: 'doctor_1', type: 'OPD' }

    beforeEach(() => {
      prisma.patient.findFirst.mockResolvedValue({ id: 'patient_1' })
    })

    it('creates an encounter and emits encounter.created', async () => {
      prisma.encounter.create.mockResolvedValue(buildEncounterRow())

      const result = await service.create('org_1', validDto as never, 'actor_1')

      expect(doctorRef.requireDoctor).toHaveBeenCalledWith('org_1', 'doctor_1')
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'encounter.created',
        expect.objectContaining({ doctorId: 'doctor_1', patientId: 'patient_1', userId: 'actor_1' }),
      )
      expect(result.id).toBe('enc_1')
    })

    it('rejects an unknown appointment', async () => {
      prisma.appointment.findFirst.mockResolvedValue(null)

      await expect(
        service.create('org_1', { ...validDto, appointmentId: 'appt_1' } as never),
      ).rejects.toThrow(NotFoundException)
    })

    it('rejects an appointment that already has an encounter', async () => {
      prisma.appointment.findFirst.mockResolvedValue({ id: 'appt_1' })
      prisma.encounter.findUnique.mockResolvedValue(buildEncounterRow())

      await expect(
        service.create('org_1', { ...validDto, appointmentId: 'appt_1' } as never),
      ).rejects.toThrow(ConflictException)
    })
  })

  describe('updateStatus', () => {
    it('throws NotFoundException for an unknown encounter', async () => {
      prisma.encounter.findFirst.mockResolvedValue(null)

      await expect(service.updateStatus('org_1', 'missing', { status: 'COMPLETED' } as never)).rejects.toThrow(
        NotFoundException,
      )
    })

    it('rejects setting the same status again', async () => {
      prisma.encounter.findFirst.mockResolvedValue(buildEncounterRow({ status: 'IN_PROGRESS' }))

      await expect(service.updateStatus('org_1', 'enc_1', { status: 'IN_PROGRESS' } as never)).rejects.toThrow(
        ConflictException,
      )
    })

    it('rejects an invalid transition (IN_PROGRESS straight to AMENDED)', async () => {
      prisma.encounter.findFirst.mockResolvedValue(buildEncounterRow({ status: 'IN_PROGRESS' }))

      await expect(service.updateStatus('org_1', 'enc_1', { status: 'AMENDED' } as never)).rejects.toThrow(
        BadRequestException,
      )
    })

    it('allows IN_PROGRESS -> COMPLETED and emits encounter.status_changed', async () => {
      prisma.encounter.findFirst.mockResolvedValue(buildEncounterRow({ status: 'IN_PROGRESS' }))
      prisma.encounter.update.mockResolvedValue(buildEncounterRow({ status: 'COMPLETED' }))

      const result = await service.updateStatus('org_1', 'enc_1', { status: 'COMPLETED' } as never, 'actor_1')

      expect(result.status).toBe('COMPLETED')
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'encounter.status_changed',
        expect.objectContaining({ fromStatus: 'IN_PROGRESS', toStatus: 'COMPLETED' }),
      )
    })

    it('allows re-amending: COMPLETED -> AMENDED -> COMPLETED', async () => {
      prisma.encounter.findFirst.mockResolvedValue(buildEncounterRow({ status: 'COMPLETED' }))
      prisma.encounter.update.mockResolvedValue(buildEncounterRow({ status: 'AMENDED' }))

      const result = await service.updateStatus('org_1', 'enc_1', { status: 'AMENDED' } as never)

      expect(result.status).toBe('AMENDED')
    })
  })

  describe('assertOwnScopeOk', () => {
    it('passes through when scope is all', async () => {
      permissionsService.getScope.mockReturnValue('all')

      await expect(
        service.assertOwnScopeOk('org_1', 'enc_1', { sub: 'user_1' } as never, 'read'),
      ).resolves.toBeUndefined()
      expect(prisma.encounter.findFirst).not.toHaveBeenCalled()
    })

    it('rejects when own-scoped and the caller is not the encounter doctor', async () => {
      permissionsService.getScope.mockReturnValue('own')
      prisma.encounter.findFirst.mockResolvedValue(buildEncounterRow({ doctorId: 'doctor_1' }))
      doctorRef.findDoctorProfileForUser.mockResolvedValue({ id: 'doctor_2' })

      await expect(
        service.assertOwnScopeOk('org_1', 'enc_1', { sub: 'user_2' } as never, 'read'),
      ).rejects.toThrow(ForbiddenException)
    })

    it('allows when own-scoped and the caller is the encounter doctor', async () => {
      permissionsService.getScope.mockReturnValue('own')
      prisma.encounter.findFirst.mockResolvedValue(buildEncounterRow({ doctorId: 'doctor_1' }))
      doctorRef.findDoctorProfileForUser.mockResolvedValue({ id: 'doctor_1' })

      await expect(
        service.assertOwnScopeOk('org_1', 'enc_1', { sub: 'user_1' } as never, 'read'),
      ).resolves.toBeUndefined()
    })
  })
})
