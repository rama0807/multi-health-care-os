import { ConflictException, NotFoundException } from '@nestjs/common'

import { StaffLeaveService } from './staff-leave.service'

function buildLeave(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'leave_1',
    staffId: 'staff_1',
    organizationId: 'org_1',
    leaveType: 'CASUAL',
    startDate: new Date('2026-08-10'),
    endDate: new Date('2026-08-12'),
    reason: 'Family event',
    status: 'PENDING',
    appliedByUserId: 'user_1',
    decidedByUserId: null,
    decidedAt: null,
    decisionNote: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    staff: { employeeId: 'EMP-001', designation: 'Staff Nurse', user: { firstName: 'Anjali', lastName: 'Verma' } },
    ...overrides,
  }
}

const applyDto = { leaveType: 'CASUAL', startDate: '2026-08-10', endDate: '2026-08-12', reason: 'Family event' }

describe('StaffLeaveService', () => {
  let prisma: { staffLeave: Record<string, jest.Mock> }
  let staffRef: { requireStaff: jest.Mock }
  let leaveTypesService: { findAllActive: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let service: StaffLeaveService

  beforeEach(() => {
    prisma = {
      staffLeave: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
    }
    staffRef = { requireStaff: jest.fn().mockResolvedValue({ id: 'staff_1' }) }
    leaveTypesService = { findAllActive: jest.fn() }
    eventEmitter = { emit: jest.fn() }

    service = new StaffLeaveService(prisma as never, staffRef as never, leaveTypesService as never, eventEmitter as never)
  })

  afterEach(() => jest.clearAllMocks())

  describe('apply', () => {
    it('rejects an overlapping pending/approved leave', async () => {
      prisma.staffLeave.findFirst.mockResolvedValue(buildLeave())

      await expect(service.apply('org_1', applyDto as never, 'staff_1', 'user_1')).rejects.toThrow(ConflictException)
      expect(prisma.staffLeave.create).not.toHaveBeenCalled()
    })

    it('creates a PENDING leave request with a computed day count', async () => {
      prisma.staffLeave.findFirst.mockResolvedValue(null)
      prisma.staffLeave.create.mockResolvedValue(buildLeave())

      const result = await service.apply('org_1', applyDto as never, 'staff_1', 'user_1')

      expect(result.status).toBe('PENDING')
      expect(result.days).toBe(3)
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'staff.leave.requested',
        expect.objectContaining({ staffId: 'staff_1', organizationId: 'org_1' }),
      )
    })
  })

  describe('approve / reject / cancel', () => {
    it('rejects approving a leave that is not pending', async () => {
      prisma.staffLeave.findFirst.mockResolvedValue(buildLeave({ status: 'APPROVED' }))

      await expect(service.approve('org_1', 'leave_1', {} as never, 'hr_1')).rejects.toThrow(ConflictException)
    })

    it('approves a pending leave', async () => {
      prisma.staffLeave.findFirst.mockResolvedValue(buildLeave())
      prisma.staffLeave.update.mockResolvedValue(buildLeave({ status: 'APPROVED' }))

      const result = await service.approve('org_1', 'leave_1', { decisionNote: 'ok' } as never, 'hr_1')

      expect(result.status).toBe('APPROVED')
      expect(eventEmitter.emit).toHaveBeenCalledWith('staff.leave.approved', expect.any(Object))
    })

    it('throws NotFoundException for an unknown leave', async () => {
      prisma.staffLeave.findFirst.mockResolvedValue(null)

      await expect(service.approve('org_1', 'missing', {} as never, 'hr_1')).rejects.toThrow(NotFoundException)
    })

    it('rejects cancelling an approved leave that already started', async () => {
      prisma.staffLeave.findFirst.mockResolvedValue(buildLeave({ status: 'APPROVED', startDate: new Date('2020-01-01') }))

      await expect(service.cancel('org_1', 'leave_1', 'user_1')).rejects.toThrow(ConflictException)
    })
  })

  describe('getBalance', () => {
    it('computes used/remaining days per configured leave type', async () => {
      leaveTypesService.findAllActive.mockResolvedValue([
        { leaveType: 'CASUAL', annualDays: 12, isPaid: true },
        { leaveType: 'SICK', annualDays: 6, isPaid: true },
      ])
      prisma.staffLeave.findMany.mockResolvedValue([
        buildLeave({ leaveType: 'CASUAL', startDate: new Date('2026-01-10'), endDate: new Date('2026-01-12'), status: 'APPROVED' }),
      ])

      const balance = await service.getBalance('org_1', 'staff_1', 2026)

      const casual = balance.find((b) => String(b.leaveType) === 'CASUAL')
      expect(casual?.usedDays).toBe(3)
      expect(casual?.remainingDays).toBe(9)
      const sick = balance.find((b) => String(b.leaveType) === 'SICK')
      expect(sick?.usedDays).toBe(0)
      expect(sick?.remainingDays).toBe(6)
    })
  })
})
