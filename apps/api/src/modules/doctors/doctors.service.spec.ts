import { ConflictException, NotFoundException } from '@nestjs/common'

import { DoctorsService } from './doctors.service'

function buildDoctor(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'doctor_1',
    userId: 'user_1',
    registrationNumber: 'MCI-001',
    specialization: 'Cardiology',
    subSpecialization: null,
    qualification: 'MBBS, MD',
    experienceYears: 10,
    languagesSpoken: ['English'],
    bio: null,
    consultationFee: 500,
    availabilityStatus: 'AVAILABLE',
    joiningDate: new Date('2020-01-01'),
    hospitalId: 'hospital_1',
    departmentId: 'dept_1',
    organizationId: 'org_1',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {
      id: 'user_1',
      firstName: 'Priya',
      lastName: 'Sharma',
      email: 'priya@example.com',
      phone: '9876543210',
    },
    department: { id: 'dept_1', name: 'Cardiology', code: 'CARDIO' },
    hospital: { id: 'hospital_1', name: 'Main Hospital', code: 'MAIN' },
    ...overrides,
  }
}

describe('DoctorsService', () => {
  let prisma: {
    doctor: Record<string, jest.Mock>
    appointment: Record<string, jest.Mock>
    prescription: Record<string, jest.Mock>
    labTest: Record<string, jest.Mock>
    radiologyOrder: Record<string, jest.Mock>
    $transaction: jest.Mock
  }
  let staffOnboardingService: { onboardUserInTransaction: jest.Mock; sendOnboardingEmail: jest.Mock }
  let hospitalsService: { getById: jest.Mock }
  let departmentsService: { getById: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let service: DoctorsService

  beforeEach(() => {
    prisma = {
      doctor: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      appointment: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      prescription: { count: jest.fn().mockResolvedValue(0) },
      labTest: { count: jest.fn().mockResolvedValue(0) },
      radiologyOrder: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb({ doctor: prisma.doctor })),
    }
    staffOnboardingService = {
      onboardUserInTransaction: jest.fn(),
      sendOnboardingEmail: jest.fn().mockResolvedValue(undefined),
    }
    hospitalsService = { getById: jest.fn().mockResolvedValue({ id: 'hospital_1' }) }
    departmentsService = { getById: jest.fn().mockResolvedValue({ id: 'dept_1', hospitalId: 'hospital_1' }) }
    eventEmitter = { emit: jest.fn() }

    service = new DoctorsService(
      prisma as never,
      staffOnboardingService as never,
      hospitalsService as never,
      departmentsService as never,
      eventEmitter as never,
    )
  })

  afterEach(() => jest.clearAllMocks())

  const createDto = {
    email: 'priya@example.com',
    firstName: 'Priya',
    lastName: 'Sharma',
    registrationNumber: 'MCI-001',
    specialization: 'Cardiology',
    qualification: 'MBBS, MD',
    experienceYears: 10,
    languagesSpoken: ['English'],
    consultationFee: 500,
    availabilityStatus: 'AVAILABLE',
    joiningDate: '2020-01-01',
    hospitalId: 'hospital_1',
    departmentId: 'dept_1',
  }

  describe('create', () => {
    it('creates a new user + doctor profile when no account exists', async () => {
      prisma.doctor.findUnique.mockResolvedValueOnce(null) // registration-number conflict check
      staffOnboardingService.onboardUserInTransaction.mockResolvedValue({
        user: { id: 'user_1', email: 'priya@example.com', firstName: 'Priya', lastName: 'Sharma' },
        created: true,
        temporaryPassword: 'Temp1234',
      })
      prisma.doctor.findUnique.mockResolvedValueOnce(null) // existing-doctor-profile check inside tx
      prisma.doctor.create = jest.fn().mockResolvedValue(buildDoctor())

      const result = await service.create('org_1', createDto as never, 'actor_1')

      expect(staffOnboardingService.onboardUserInTransaction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ organizationId: 'org_1', systemRole: 'DOCTOR' }),
      )
      expect(staffOnboardingService.sendOnboardingEmail).toHaveBeenCalledWith(
        expect.objectContaining({ created: true, temporaryPassword: 'Temp1234' }),
      )
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'doctor.created',
        expect.objectContaining({ doctorId: 'doctor_1', organizationId: 'org_1', userId: 'actor_1' }),
      )
      expect(result.fullName).toBe('Priya Sharma')
    })

    it('links an existing user instead of creating a duplicate account', async () => {
      prisma.doctor.findUnique.mockResolvedValueOnce(null)
      staffOnboardingService.onboardUserInTransaction.mockResolvedValue({
        user: { id: 'user_1', email: 'priya@example.com', firstName: 'Priya', lastName: 'Sharma' },
        created: false,
      })
      prisma.doctor.findUnique.mockResolvedValueOnce(null)
      prisma.doctor.create = jest.fn().mockResolvedValue(buildDoctor())

      await service.create('org_1', createDto as never)

      expect(staffOnboardingService.sendOnboardingEmail).toHaveBeenCalledWith(
        expect.objectContaining({ created: false, temporaryPassword: undefined }),
      )
    })

    it('rejects a duplicate registration number', async () => {
      prisma.doctor.findUnique.mockResolvedValueOnce(buildDoctor())

      await expect(service.create('org_1', createDto as never)).rejects.toThrow(ConflictException)
      expect(staffOnboardingService.onboardUserInTransaction).not.toHaveBeenCalled()
    })

    it('rejects when the department does not belong to the selected hospital', async () => {
      departmentsService.getById.mockResolvedValue({ id: 'dept_1', hospitalId: 'other_hospital' })

      await expect(service.create('org_1', createDto as never)).rejects.toThrow(ConflictException)
    })

    it('rejects when the onboarded user already has a doctor profile', async () => {
      prisma.doctor.findUnique.mockResolvedValueOnce(null)
      staffOnboardingService.onboardUserInTransaction.mockResolvedValue({
        user: { id: 'user_1', email: 'priya@example.com', firstName: 'Priya', lastName: 'Sharma' },
        created: false,
      })
      prisma.doctor.findUnique.mockResolvedValueOnce(buildDoctor())

      await expect(service.create('org_1', createDto as never)).rejects.toThrow(ConflictException)
      expect(staffOnboardingService.sendOnboardingEmail).not.toHaveBeenCalled()
    })
  })

  describe('update', () => {
    it('rejects when the new registration number belongs to a different doctor', async () => {
      prisma.doctor.findFirst.mockResolvedValue(buildDoctor())
      prisma.doctor.findUnique.mockResolvedValue(buildDoctor({ id: 'other_doctor' }))

      await expect(
        service.update('org_1', 'doctor_1', { registrationNumber: 'MCI-002' } as never),
      ).rejects.toThrow(ConflictException)
    })

    it('updates and emits doctor.updated', async () => {
      prisma.doctor.findFirst.mockResolvedValue(buildDoctor())
      prisma.doctor.update.mockResolvedValue(buildDoctor({ specialization: 'Neurology' }))

      const result = await service.update('org_1', 'doctor_1', { specialization: 'Neurology' } as never, 'user_1')

      expect(result.specialization).toBe('Neurology')
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'doctor.updated',
        expect.objectContaining({ doctorId: 'doctor_1', userId: 'user_1' }),
      )
    })
  })

  describe('deactivate / restore', () => {
    it('deactivates an active doctor', async () => {
      prisma.doctor.findFirst.mockResolvedValue(buildDoctor())
      prisma.doctor.update.mockResolvedValue(buildDoctor({ isActive: false }))

      const result = await service.deactivate('org_1', 'doctor_1', 'user_1')

      expect(result.isActive).toBe(false)
      expect(eventEmitter.emit).toHaveBeenCalledWith('doctor.deactivated', expect.any(Object))
    })

    it('restores a deactivated doctor', async () => {
      prisma.doctor.findFirst.mockResolvedValue(buildDoctor({ isActive: false }))
      prisma.doctor.update.mockResolvedValue(buildDoctor({ isActive: true }))

      const result = await service.restore('org_1', 'doctor_1', 'user_1')

      expect(result.isActive).toBe(true)
      expect(eventEmitter.emit).toHaveBeenCalledWith('doctor.restored', expect.any(Object))
    })

    it('throws NotFoundException for an unknown doctor', async () => {
      prisma.doctor.findFirst.mockResolvedValue(null)

      await expect(service.deactivate('org_1', 'missing')).rejects.toThrow(NotFoundException)
    })
  })

  describe('list', () => {
    it('paginates results and defaults to active-only', async () => {
      prisma.doctor.findMany.mockResolvedValue([buildDoctor()])
      prisma.doctor.count.mockResolvedValue(1)

      const result = await service.list('org_1', { page: 1, limit: 20 })

      expect(prisma.doctor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
      )
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      })
      expect(result.data).toHaveLength(1)
    })
  })

  describe('getById', () => {
    it('returns the doctor with summary counts', async () => {
      prisma.doctor.findFirst.mockResolvedValue(buildDoctor())

      const result = await service.getById('org_1', 'doctor_1')

      expect(result.summary).toEqual({
        appointments: 0,
        patients: 0,
        prescriptions: 0,
        labTests: 0,
        radiologyOrders: 0,
      })
    })

    it('throws NotFoundException for an unknown doctor', async () => {
      prisma.doctor.findFirst.mockResolvedValue(null)

      await expect(service.getById('org_1', 'missing')).rejects.toThrow(NotFoundException)
    })
  })

  describe('getMyProfile', () => {
    it('throws NotFoundException when the user has no doctor profile', async () => {
      prisma.doctor.findFirst.mockResolvedValue(null)

      await expect(service.getMyProfile('org_1', 'user_2')).rejects.toThrow(NotFoundException)
    })
  })

  describe('getDashboardStats', () => {
    it('returns total and active doctor counts', async () => {
      prisma.doctor.count.mockResolvedValueOnce(10).mockResolvedValueOnce(8)

      const stats = await service.getDashboardStats('org_1')

      expect(stats).toEqual({ totalDoctors: 10, activeDoctors: 8 })
    })
  })
})
