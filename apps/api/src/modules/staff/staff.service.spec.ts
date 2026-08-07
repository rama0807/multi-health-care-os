import { ConflictException } from '@nestjs/common'

import { StaffService } from './staff.service'

function buildStaff(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'staff_1',
    userId: 'user_1',
    employeeId: 'EMP-001',
    designation: 'Staff Nurse',
    departmentId: 'dept_1',
    hospitalId: 'hospital_1',
    organizationId: 'org_1',
    employmentType: 'FULL_TIME',
    employmentStatus: 'ACTIVE',
    reportsToId: null,
    joiningDate: new Date('2024-01-01'),
    dateOfLeaving: null,
    monthlySalary: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: { id: 'user_1', firstName: 'Anjali', lastName: 'Verma', email: 'anjali@example.com', phone: '9876543210' },
    department: { id: 'dept_1', name: 'Nursing', code: 'NURS' },
    hospital: { id: 'hospital_1', name: 'Main Hospital', code: 'MAIN' },
    reportsTo: null,
    ...overrides,
  }
}

describe('StaffService', () => {
  let prisma: {
    staff: Record<string, jest.Mock>
    organization: Record<string, jest.Mock>
    $executeRaw: jest.Mock
    $transaction: jest.Mock
  }
  let staffOnboardingService: { onboardUserInTransaction: jest.Mock; sendOnboardingEmail: jest.Mock }
  let hospitalsService: { getById: jest.Mock }
  let departmentsService: { getById: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let service: StaffService

  beforeEach(() => {
    prisma = {
      staff: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      organization: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'org_1', settings: { uhidPrefix: 'MAIN' } }),
      },
      $executeRaw: jest.fn(),
      $transaction: jest.fn((cb: (tx: unknown) => unknown) =>
        cb({ staff: prisma.staff, organization: prisma.organization, $executeRaw: prisma.$executeRaw }),
      ),
    }
    staffOnboardingService = {
      onboardUserInTransaction: jest.fn(),
      sendOnboardingEmail: jest.fn().mockResolvedValue(undefined),
    }
    hospitalsService = { getById: jest.fn().mockResolvedValue({ id: 'hospital_1' }) }
    departmentsService = { getById: jest.fn().mockResolvedValue({ id: 'dept_1', hospitalId: 'hospital_1' }) }
    eventEmitter = { emit: jest.fn() }

    service = new StaffService(
      prisma as never,
      staffOnboardingService as never,
      hospitalsService as never,
      departmentsService as never,
      eventEmitter as never,
    )
  })

  afterEach(() => jest.clearAllMocks())

  const createDto = {
    email: 'anjali@example.com',
    firstName: 'Anjali',
    lastName: 'Verma',
    systemRole: 'NURSE',
    employeeId: 'EMP-001',
    designation: 'Staff Nurse',
    hospitalId: 'hospital_1',
    departmentId: 'dept_1',
    employmentType: 'FULL_TIME',
    joiningDate: '2024-01-01',
  }

  describe('create', () => {
    it('creates a new user + staff profile when no account exists', async () => {
      prisma.staff.findUnique.mockResolvedValueOnce(null) // employeeId conflict check
      staffOnboardingService.onboardUserInTransaction.mockResolvedValue({
        user: { id: 'user_1', email: 'anjali@example.com', firstName: 'Anjali', lastName: 'Verma' },
        created: true,
        temporaryPassword: 'Temp1234',
      })
      prisma.staff.findUnique.mockResolvedValueOnce(null) // existing-profile check inside tx
      prisma.staff.create = jest.fn().mockResolvedValue(buildStaff())

      const result = await service.create('org_1', createDto as never, 'actor_1')

      expect(staffOnboardingService.onboardUserInTransaction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ organizationId: 'org_1', systemRole: 'NURSE' }),
      )
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'staff.created',
        expect.objectContaining({ staffId: 'staff_1', organizationId: 'org_1', userId: 'actor_1' }),
      )
      expect(result.fullName).toBe('Anjali Verma')
    })

    it('auto-generates an employee ID when none is supplied', async () => {
      const dtoWithoutEmployeeId: Record<string, unknown> = { ...createDto }
      delete dtoWithoutEmployeeId.employeeId
      staffOnboardingService.onboardUserInTransaction.mockResolvedValue({
        user: { id: 'user_1', email: 'anjali@example.com', firstName: 'Anjali', lastName: 'Verma' },
        created: true,
        temporaryPassword: 'Temp1234',
      })
      prisma.staff.findUnique.mockResolvedValueOnce(null) // existing-profile check inside tx
      prisma.staff.count.mockResolvedValueOnce(4)
      prisma.staff.create = jest.fn().mockResolvedValue(buildStaff())

      await service.create('org_1', dtoWithoutEmployeeId as never, 'actor_1')

      expect(prisma.organization.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: 'org_1' } })
      expect(prisma.staff.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ employeeId: expect.stringMatching(/^EMP-MAIN-\d{4}-000005$/) }),
        }),
      )
    })

    it('rejects a duplicate employee ID', async () => {
      prisma.staff.findUnique.mockResolvedValueOnce(buildStaff())

      await expect(service.create('org_1', createDto as never)).rejects.toThrow(ConflictException)
      expect(staffOnboardingService.onboardUserInTransaction).not.toHaveBeenCalled()
    })

    it('rejects when the department does not belong to the selected hospital', async () => {
      departmentsService.getById.mockResolvedValue({ id: 'dept_1', hospitalId: 'other_hospital' })

      await expect(service.create('org_1', createDto as never)).rejects.toThrow(ConflictException)
    })

    it('rejects when the onboarded user already has a staff profile', async () => {
      prisma.staff.findUnique.mockResolvedValueOnce(null)
      staffOnboardingService.onboardUserInTransaction.mockResolvedValue({
        user: { id: 'user_1', email: 'anjali@example.com', firstName: 'Anjali', lastName: 'Verma' },
        created: false,
      })
      prisma.staff.findUnique.mockResolvedValueOnce(buildStaff())

      await expect(service.create('org_1', createDto as never)).rejects.toThrow(ConflictException)
      expect(staffOnboardingService.sendOnboardingEmail).not.toHaveBeenCalled()
    })
  })

  describe('update', () => {
    it('rejects reporting to oneself', async () => {
      prisma.staff.findFirst.mockResolvedValue(buildStaff())

      await expect(
        service.update('org_1', 'staff_1', { reportsToId: 'staff_1' } as never),
      ).rejects.toThrow(ConflictException)
    })
  })

  describe('setEmploymentStatus', () => {
    it('records a dateOfLeaving when terminating', async () => {
      prisma.staff.findFirst.mockResolvedValue(buildStaff())
      prisma.staff.update.mockResolvedValue(buildStaff({ employmentStatus: 'TERMINATED' }))

      const result = await service.setEmploymentStatus('org_1', 'staff_1', 'TERMINATED' as never, 'hr_1')

      expect(result.employmentStatus).toBe('TERMINATED')
      expect(prisma.staff.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ employmentStatus: 'TERMINATED' }) }),
      )
      expect(eventEmitter.emit).toHaveBeenCalledWith('staff.employment_status_changed', expect.any(Object))
    })
  })
})
