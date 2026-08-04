import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'

import { AdmissionsService } from './admissions.service'

function buildAdmissionRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'adm_1',
    admissionNumber: 'ADM-MED-2026-000001',
    patientId: 'patient_1',
    encounterId: 'enc_1',
    attendingDoctorId: 'doctor_1',
    departmentId: null,
    wardId: 'ward_1',
    roomId: 'room_1',
    bedId: 'bed_1',
    patientInsuranceId: null,
    organizationId: 'org_1',
    type: 'EMERGENCY',
    status: 'ADMITTED',
    admissionReason: 'Chest pain',
    diagnosis: null,
    admittedAt: new Date('2026-08-04'),
    expectedDischargeAt: null,
    dischargedAt: null,
    dischargeNotes: null,
    dischargeCondition: null,
    cancelledAt: null,
    cancelReason: null,
    createdByUserId: 'actor_1',
    createdAt: new Date('2026-08-04'),
    updatedAt: new Date('2026-08-04'),
    patient: { id: 'patient_1', firstName: 'Ramesh', lastName: 'Gupta', uhid: 'MED-2026-000004' },
    attendingDoctor: { id: 'doctor_1', specialization: 'Cardiology', user: { firstName: 'Ravi', lastName: 'Kumar' } },
    department: null,
    ward: { id: 'ward_1', name: 'ICU Ward', code: 'ICU1', type: 'ICU' },
    room: { id: 'room_1', roomNumber: '301' },
    bed: { id: 'bed_1', bedNumber: '301-A' },
    ...overrides,
  }
}

describe('AdmissionsService', () => {
  let prisma: {
    admission: Record<string, jest.Mock>
    patient: Record<string, jest.Mock>
    department: Record<string, jest.Mock>
    patientInsurance: Record<string, jest.Mock>
    organization: Record<string, jest.Mock>
    bed: Record<string, jest.Mock>
    bedAllocation: Record<string, jest.Mock>
    $transaction: jest.Mock
  }
  let encountersService: { requireEncounter: jest.Mock; create: jest.Mock }
  let doctorRef: { requireDoctor: jest.Mock; findDoctorProfileForUser: jest.Mock }
  let wardsService: { requireWard: jest.Mock }
  let roomsService: { requireRoom: jest.Mock }
  let bedsService: { requireBed: jest.Mock }
  let permissionsService: { getScope: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let service: AdmissionsService

  beforeEach(() => {
    prisma = {
      admission: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
      },
      patient: { findFirst: jest.fn().mockResolvedValue({ id: 'patient_1' }) },
      department: { findFirst: jest.fn() },
      patientInsurance: { findFirst: jest.fn() },
      organization: { findUniqueOrThrow: jest.fn().mockResolvedValue({ settings: { uhidPrefix: 'MED' } }) },
      bed: { update: jest.fn().mockResolvedValue({}) },
      bedAllocation: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => {
        if (typeof fn === 'function') {
          return fn({
            $executeRaw: jest.fn(),
            admission: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue(buildAdmissionRow()), update: jest.fn() },
            bed: { update: jest.fn().mockResolvedValue({}) },
            bedAllocation: { create: jest.fn().mockResolvedValue({}) },
          })
        }
        return Promise.all(fn as unknown as Promise<unknown>[])
      }),
    }
    encountersService = {
      requireEncounter: jest.fn().mockResolvedValue({ id: 'enc_1', patientId: 'patient_1' }),
      create: jest.fn().mockResolvedValue({ id: 'enc_new' }),
    }
    doctorRef = {
      requireDoctor: jest.fn().mockResolvedValue({ id: 'doctor_1' }),
      findDoctorProfileForUser: jest.fn(),
    }
    wardsService = { requireWard: jest.fn().mockResolvedValue({ id: 'ward_1' }) }
    roomsService = { requireRoom: jest.fn().mockResolvedValue({ id: 'room_1', wardId: 'ward_1' }) }
    bedsService = { requireBed: jest.fn().mockResolvedValue({ id: 'bed_1', roomId: 'room_1', wardId: 'ward_1', status: 'AVAILABLE' }) }
    permissionsService = { getScope: jest.fn().mockReturnValue('all') }
    eventEmitter = { emit: jest.fn() }

    service = new AdmissionsService(
      prisma as never,
      encountersService as never,
      doctorRef as never,
      wardsService as never,
      roomsService as never,
      bedsService as never,
      permissionsService as never,
      eventEmitter as never,
    )
  })

  describe('create', () => {
    const dto = {
      patientId: 'patient_1',
      attendingDoctorId: 'doctor_1',
      wardId: 'ward_1',
      roomId: 'room_1',
      bedId: 'bed_1',
      type: 'EMERGENCY',
      admissionReason: 'Chest pain',
    }

    it('admits a patient, allocates the bed, and creates a fresh IPD encounter when none is given', async () => {
      const result = await service.create('org_1', dto as never, 'actor_1')

      expect(encountersService.create).toHaveBeenCalledWith(
        'org_1',
        expect.objectContaining({ patientId: 'patient_1', doctorId: 'doctor_1', type: 'IPD' }),
        'actor_1',
      )
      expect(eventEmitter.emit).toHaveBeenCalledWith('ipd.admission_created', expect.objectContaining({ admissionId: 'adm_1' }))
      expect(result.admissionNumber).toBe('ADM-MED-2026-000001')
    })

    it('reuses an existing encounter for the same patient instead of creating a new one', async () => {
      await service.create('org_1', { ...dto, encounterId: 'enc_1' } as never, 'actor_1')

      expect(encountersService.requireEncounter).toHaveBeenCalledWith('org_1', 'enc_1')
      expect(encountersService.create).not.toHaveBeenCalled()
    })

    it('rejects an encounter that belongs to a different patient', async () => {
      encountersService.requireEncounter.mockResolvedValue({ id: 'enc_1', patientId: 'someone_else' })

      await expect(service.create('org_1', { ...dto, encounterId: 'enc_1' } as never)).rejects.toThrow(
        ConflictException,
      )
    })

    it('rejects an unavailable bed', async () => {
      bedsService.requireBed.mockResolvedValue({ id: 'bed_1', roomId: 'room_1', wardId: 'ward_1', status: 'OCCUPIED' })

      await expect(service.create('org_1', dto as never)).rejects.toThrow(ConflictException)
    })

    it('rejects an unknown patient', async () => {
      prisma.patient.findFirst.mockResolvedValue(null)

      await expect(service.create('org_1', dto as never)).rejects.toThrow(NotFoundException)
    })

    it('admits without a bed when none is provided (ward-only admission)', async () => {
      const wardOnlyDto = {
        patientId: 'patient_1',
        attendingDoctorId: 'doctor_1',
        wardId: 'ward_1',
        type: 'EMERGENCY',
        admissionReason: 'Chest pain',
      }

      const result = await service.create('org_1', wardOnlyDto as never)
      expect(result).toBeDefined()
      expect(bedsService.requireBed).not.toHaveBeenCalled()
    })
  })

  describe('cancel', () => {
    it('rejects cancelling an admission that is not active', async () => {
      prisma.admission.findFirst.mockResolvedValue(buildAdmissionRow({ status: 'CANCELLED' }))

      await expect(service.cancel('org_1', 'adm_1', {} as never)).rejects.toThrow(ConflictException)
    })

    it('cancels an admitted admission and releases its bed', async () => {
      prisma.admission.findFirst
        .mockResolvedValueOnce(buildAdmissionRow())
        .mockResolvedValueOnce(buildAdmissionRow({ status: 'CANCELLED', bedId: null }))
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
        fn({
          bed: { update: jest.fn().mockResolvedValue({}) },
          bedAllocation: { create: jest.fn().mockResolvedValue({}) },
          admission: { update: jest.fn().mockResolvedValue({}) },
        }),
      )

      const result = await service.cancel('org_1', 'adm_1', { reason: 'Opened in error' } as never, 'actor_1')
      expect(result.status).toBe('CANCELLED')
      expect(eventEmitter.emit).toHaveBeenCalledWith('ipd.admission_cancelled', expect.objectContaining({ admissionId: 'adm_1' }))
    })
  })

  describe('assertOwnScopeOk', () => {
    it('passes through when scope is all', async () => {
      permissionsService.getScope.mockReturnValue('all')
      await expect(
        service.assertOwnScopeOk('org_1', 'adm_1', { sub: 'user_1' } as never, 'read'),
      ).resolves.toBeUndefined()
    })

    it('rejects when own-scoped and the caller is not the attending doctor', async () => {
      permissionsService.getScope.mockReturnValue('own')
      prisma.admission.findFirst.mockResolvedValue(buildAdmissionRow())
      doctorRef.findDoctorProfileForUser.mockResolvedValue({ id: 'someone_else' })

      await expect(
        service.assertOwnScopeOk('org_1', 'adm_1', { sub: 'user_1' } as never, 'read'),
      ).rejects.toThrow(ForbiddenException)
    })

    it('allows when own-scoped and the caller is the attending doctor', async () => {
      permissionsService.getScope.mockReturnValue('own')
      prisma.admission.findFirst.mockResolvedValue(buildAdmissionRow())
      doctorRef.findDoctorProfileForUser.mockResolvedValue({ id: 'doctor_1' })

      await expect(
        service.assertOwnScopeOk('org_1', 'adm_1', { sub: 'user_1' } as never, 'read'),
      ).resolves.toBeUndefined()
    })
  })
})
