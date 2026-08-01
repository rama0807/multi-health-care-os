import { ConflictException, NotFoundException } from '@nestjs/common'

import { DoctorLeaveService } from './doctor-leave.service'

function buildLeave(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'leave_1',
    doctorId: 'doctor_1',
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
    doctor: { user: { firstName: 'Priya', lastName: 'Sharma' } },
    ...overrides,
  }
}

const applyDto = {
  doctorId: 'doctor_1',
  leaveType: 'CASUAL',
  startDate: '2026-08-10',
  endDate: '2026-08-12',
  reason: 'Family event',
}

describe('DoctorLeaveService', () => {
  let prisma: { doctorLeave: Record<string, jest.Mock> }
  let doctorRef: { requireDoctor: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let service: DoctorLeaveService

  beforeEach(() => {
    prisma = {
      doctorLeave: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    }
    doctorRef = { requireDoctor: jest.fn().mockResolvedValue({ id: 'doctor_1' }) }
    eventEmitter = { emit: jest.fn() }

    service = new DoctorLeaveService(prisma as never, doctorRef as never, eventEmitter as never)
  })

  afterEach(() => jest.clearAllMocks())

  describe('apply', () => {
    it('rejects an overlapping pending/approved leave', async () => {
      prisma.doctorLeave.findFirst.mockResolvedValue(buildLeave())

      await expect(service.apply('org_1', applyDto as never, 'user_1')).rejects.toThrow(ConflictException)
      expect(prisma.doctorLeave.create).not.toHaveBeenCalled()
    })

    it('creates a PENDING leave request and emits doctor.leave.requested', async () => {
      prisma.doctorLeave.findFirst.mockResolvedValue(null)
      prisma.doctorLeave.create.mockResolvedValue(buildLeave())

      const result = await service.apply('org_1', applyDto as never, 'user_1')

      expect(doctorRef.requireDoctor).toHaveBeenCalledWith('org_1', 'doctor_1')
      expect(result.status).toBe('PENDING')
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'doctor.leave.requested',
        expect.objectContaining({ doctorId: 'doctor_1', organizationId: 'org_1', userId: 'user_1' }),
      )
    })
  })

  describe('approve / reject', () => {
    it('rejects approving a leave that is not pending', async () => {
      prisma.doctorLeave.findFirst.mockResolvedValue(buildLeave({ status: 'APPROVED' }))

      await expect(service.approve('org_1', 'leave_1', {} as never, 'hr_1')).rejects.toThrow(ConflictException)
    })

    it('approves a pending leave and emits doctor.leave.approved', async () => {
      prisma.doctorLeave.findFirst.mockResolvedValue(buildLeave())
      prisma.doctorLeave.update.mockResolvedValue(buildLeave({ status: 'APPROVED', decidedByUserId: 'hr_1' }))

      const result = await service.approve('org_1', 'leave_1', { decisionNote: 'ok' } as never, 'hr_1')

      expect(result.status).toBe('APPROVED')
      expect(eventEmitter.emit).toHaveBeenCalledWith('doctor.leave.approved', expect.any(Object))
    })

    it('rejects a pending leave and emits doctor.leave.rejected', async () => {
      prisma.doctorLeave.findFirst.mockResolvedValue(buildLeave())
      prisma.doctorLeave.update.mockResolvedValue(buildLeave({ status: 'REJECTED' }))

      const result = await service.reject('org_1', 'leave_1', { decisionNote: 'staffing' } as never, 'hr_1')

      expect(result.status).toBe('REJECTED')
      expect(eventEmitter.emit).toHaveBeenCalledWith('doctor.leave.rejected', expect.any(Object))
    })

    it('throws NotFoundException for an unknown leave', async () => {
      prisma.doctorLeave.findFirst.mockResolvedValue(null)

      await expect(service.approve('org_1', 'missing', {} as never, 'hr_1')).rejects.toThrow(NotFoundException)
    })
  })

  describe('cancel', () => {
    it('cancels a pending leave', async () => {
      prisma.doctorLeave.findFirst.mockResolvedValue(buildLeave())
      prisma.doctorLeave.update.mockResolvedValue(buildLeave({ status: 'CANCELLED' }))

      const result = await service.cancel('org_1', 'leave_1', 'user_1')

      expect(result.status).toBe('CANCELLED')
      expect(eventEmitter.emit).toHaveBeenCalledWith('doctor.leave.cancelled', expect.any(Object))
    })

    it('rejects cancelling an already-rejected leave', async () => {
      prisma.doctorLeave.findFirst.mockResolvedValue(buildLeave({ status: 'REJECTED' }))

      await expect(service.cancel('org_1', 'leave_1', 'user_1')).rejects.toThrow(ConflictException)
    })

    it('rejects cancelling an approved leave that has already started', async () => {
      prisma.doctorLeave.findFirst.mockResolvedValue(
        buildLeave({ status: 'APPROVED', startDate: new Date('2020-01-01') }),
      )

      await expect(service.cancel('org_1', 'leave_1', 'user_1')).rejects.toThrow(ConflictException)
    })
  })

  describe('list', () => {
    it('paginates and maps doctor name', async () => {
      prisma.doctorLeave.findMany.mockResolvedValue([buildLeave()])
      prisma.doctorLeave.count.mockResolvedValue(1)

      const result = await service.list('org_1', {})

      expect(result.data[0].doctor.fullName).toBe('Priya Sharma')
      expect(result.pagination.total).toBe(1)
    })
  })
})
