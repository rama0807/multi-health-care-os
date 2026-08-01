import { ConflictException, NotFoundException } from '@nestjs/common'

import { DoctorScheduleService } from './doctor-schedule.service'

function buildScheduleRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'schedule_1',
    doctorId: 'doctor_1',
    organizationId: 'org_1',
    effectiveFrom: new Date('2026-08-01'),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    days: [
      {
        id: 'day_1',
        dayOfWeek: 'MONDAY',
        isWorkingDay: true,
        shifts: [{ startTime: '09:00', endTime: '13:00', slotDurationMinutes: 15, breaks: [] }],
      },
    ],
    ...overrides,
  }
}

const validDto = {
  effectiveFrom: '2026-08-01',
  days: [
    { dayOfWeek: 'SUNDAY', isWorkingDay: false, shifts: [] },
    {
      dayOfWeek: 'MONDAY',
      isWorkingDay: true,
      shifts: [{ startTime: '09:00', endTime: '13:00', slotDurationMinutes: 15, breaks: [] }],
    },
    { dayOfWeek: 'TUESDAY', isWorkingDay: false, shifts: [] },
    { dayOfWeek: 'WEDNESDAY', isWorkingDay: false, shifts: [] },
    { dayOfWeek: 'THURSDAY', isWorkingDay: false, shifts: [] },
    { dayOfWeek: 'FRIDAY', isWorkingDay: false, shifts: [] },
    { dayOfWeek: 'SATURDAY', isWorkingDay: false, shifts: [] },
  ],
}

describe('DoctorScheduleService', () => {
  let prisma: { doctorSchedule: Record<string, jest.Mock> }
  let doctorRef: { requireDoctor: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let service: DoctorScheduleService

  beforeEach(() => {
    prisma = {
      doctorSchedule: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    }
    doctorRef = { requireDoctor: jest.fn().mockResolvedValue({ id: 'doctor_1' }) }
    eventEmitter = { emit: jest.fn() }

    service = new DoctorScheduleService(prisma as never, doctorRef as never, eventEmitter as never)
  })

  afterEach(() => jest.clearAllMocks())

  describe('getEffective', () => {
    it('returns null when no schedule applies yet', async () => {
      prisma.doctorSchedule.findFirst.mockResolvedValue(null)

      const result = await service.getEffective('org_1', 'doctor_1')

      expect(result).toBeNull()
    })

    it('maps the effective row to the response shape', async () => {
      prisma.doctorSchedule.findFirst.mockResolvedValue(buildScheduleRow())

      const result = await service.getEffective('org_1', 'doctor_1')

      expect(result?.effectiveFrom).toBe('2026-08-01')
      expect(result?.days[0].shifts[0].startTime).toBe('09:00')
    })
  })

  describe('createVersion', () => {
    it('rejects a duplicate effective date', async () => {
      prisma.doctorSchedule.findUnique.mockResolvedValue(buildScheduleRow())

      await expect(service.createVersion('org_1', 'doctor_1', validDto as never)).rejects.toThrow(
        ConflictException,
      )
      expect(prisma.doctorSchedule.create).not.toHaveBeenCalled()
    })

    it('creates a new version and emits doctor.schedule.created', async () => {
      prisma.doctorSchedule.findUnique.mockResolvedValue(null)
      prisma.doctorSchedule.create.mockResolvedValue(buildScheduleRow())

      const result = await service.createVersion('org_1', 'doctor_1', validDto as never, 'actor_1')

      expect(doctorRef.requireDoctor).toHaveBeenCalledWith('org_1', 'doctor_1')
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'doctor.schedule.created',
        expect.objectContaining({ doctorId: 'doctor_1', organizationId: 'org_1', userId: 'actor_1' }),
      )
      expect(result.id).toBe('schedule_1')
    })
  })

  describe('setVersionActive', () => {
    it('throws NotFoundException for an unknown version', async () => {
      prisma.doctorSchedule.findFirst.mockResolvedValue(null)

      await expect(
        service.setVersionActive('org_1', 'doctor_1', 'missing', { isActive: false } as never),
      ).rejects.toThrow(NotFoundException)
    })

    it('toggles isActive and emits doctor.schedule.updated', async () => {
      prisma.doctorSchedule.findFirst.mockResolvedValue(buildScheduleRow())
      prisma.doctorSchedule.update.mockResolvedValue(buildScheduleRow({ isActive: false }))

      const result = await service.setVersionActive(
        'org_1',
        'doctor_1',
        'schedule_1',
        { isActive: false } as never,
        'actor_1',
      )

      expect(result.isActive).toBe(false)
      expect(eventEmitter.emit).toHaveBeenCalledWith('doctor.schedule.updated', expect.any(Object))
    })
  })

  describe('listVersions', () => {
    it('returns all versions for a doctor', async () => {
      prisma.doctorSchedule.findMany.mockResolvedValue([buildScheduleRow()])

      const result = await service.listVersions('org_1', 'doctor_1')

      expect(result).toHaveLength(1)
    })
  })
})
