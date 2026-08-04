import { ConflictException, NotFoundException } from '@nestjs/common'

import { AttendanceService } from './attendance.service'

function buildShift(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'shift_1',
    organizationId: 'org_1',
    name: 'Morning',
    code: 'MORN',
    startTime: '09:00',
    endTime: '17:00',
    breakMinutes: 30,
    gracePeriodMinutes: 15,
    isNightShift: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function buildAttendance(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'att_1',
    staffId: 'staff_1',
    shiftId: 'shift_1',
    organizationId: 'org_1',
    date: new Date('2026-08-05'),
    clockInAt: null,
    clockOutAt: null,
    status: 'PRESENT',
    workedMinutes: null,
    lateByMinutes: null,
    notes: null,
    isCorrected: false,
    correctedByUserId: null,
    correctionReason: null,
    correctedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('AttendanceService', () => {
  let prisma: {
    attendance: Record<string, jest.Mock>
    shift: Record<string, jest.Mock>
    staff: Record<string, jest.Mock>
  }
  let staffRef: { requireStaff: jest.Mock }
  let shiftRoster: { findForStaffAndDate: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let service: AttendanceService

  beforeEach(() => {
    prisma = {
      attendance: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      shift: { findUnique: jest.fn() },
      staff: { count: jest.fn() },
    }
    staffRef = { requireStaff: jest.fn().mockResolvedValue({ id: 'staff_1' }) }
    shiftRoster = { findForStaffAndDate: jest.fn().mockResolvedValue(null) }
    eventEmitter = { emit: jest.fn() }

    service = new AttendanceService(prisma as never, staffRef as never, shiftRoster as never, eventEmitter as never)
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.useRealTimers()
  })

  describe('clockIn', () => {
    it('rejects when already clocked in today', async () => {
      prisma.attendance.findUnique.mockResolvedValue(buildAttendance({ clockInAt: new Date() }))

      await expect(service.clockIn('org_1', 'staff_1')).rejects.toThrow(ConflictException)
    })

    it('marks PRESENT when clocking in within the shift grace period', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-05T09:10:00'))
      prisma.attendance.findUnique.mockResolvedValue(null)
      shiftRoster.findForStaffAndDate.mockResolvedValue({ isOff: false, shift: buildShift() })
      prisma.attendance.upsert.mockImplementation(({ create }: never) => Promise.resolve(buildAttendance(create)))

      const result = await service.clockIn('org_1', 'staff_1')

      expect(result.status).toBe('PRESENT')
      expect(result.lateByMinutes).toBeNull()
      expect(eventEmitter.emit).toHaveBeenCalledWith('staff.attendance.clocked_in', expect.any(Object))
    })

    it('marks LATE with the minutes-late when clocking in beyond the grace period', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-05T09:20:00'))
      prisma.attendance.findUnique.mockResolvedValue(null)
      shiftRoster.findForStaffAndDate.mockResolvedValue({ isOff: false, shift: buildShift() })
      prisma.attendance.upsert.mockImplementation(({ create }: never) => Promise.resolve(buildAttendance(create)))

      const result = await service.clockIn('org_1', 'staff_1')

      expect(result.status).toBe('LATE')
      expect(result.lateByMinutes).toBe(20)
    })

    it('marks WEEK_OFF when the roster has the day marked off', async () => {
      prisma.attendance.findUnique.mockResolvedValue(null)
      shiftRoster.findForStaffAndDate.mockResolvedValue({ isOff: true, shift: null })
      prisma.attendance.upsert.mockImplementation(({ create }: never) => Promise.resolve(buildAttendance(create)))

      const result = await service.clockIn('org_1', 'staff_1')

      expect(result.status).toBe('WEEK_OFF')
    })

    it('marks PRESENT with no lateness rule when no shift is assigned', async () => {
      prisma.attendance.findUnique.mockResolvedValue(null)
      shiftRoster.findForStaffAndDate.mockResolvedValue(null)
      prisma.attendance.upsert.mockImplementation(({ create }: never) => Promise.resolve(buildAttendance(create)))

      const result = await service.clockIn('org_1', 'staff_1')

      expect(result.status).toBe('PRESENT')
      expect(result.shiftId).toBeNull()
    })
  })

  describe('clockOut', () => {
    it('rejects when there is no clock-in record for today', async () => {
      prisma.attendance.findUnique.mockResolvedValue(null)

      await expect(service.clockOut('org_1', 'staff_1')).rejects.toThrow(NotFoundException)
    })

    it('rejects when already clocked out today', async () => {
      prisma.attendance.findUnique.mockResolvedValue(
        buildAttendance({ clockInAt: new Date('2026-08-05T09:00:00'), clockOutAt: new Date('2026-08-05T17:00:00') }),
      )

      await expect(service.clockOut('org_1', 'staff_1')).rejects.toThrow(ConflictException)
    })

    it('marks HALF_DAY when worked minutes are under half the shift standard', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-05T12:00:00'))
      prisma.attendance.findUnique.mockResolvedValue(
        buildAttendance({ clockInAt: new Date('2026-08-05T09:00:00'), status: 'PRESENT' }),
      )
      prisma.shift.findUnique.mockResolvedValue(buildShift())
      prisma.attendance.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(buildAttendance({ ...data, clockInAt: new Date('2026-08-05T09:00:00') })),
      )

      const result = await service.clockOut('org_1', 'staff_1')

      // 3h worked (180min) minus 30min break = 150min, standard is 8h-30min=450min, half=225min
      expect(result.workedMinutes).toBe(150)
      expect(result.status).toBe('HALF_DAY')
    })

    it('marks PRESENT for a full, on-time shift', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-05T17:00:00'))
      prisma.attendance.findUnique.mockResolvedValue(
        buildAttendance({ clockInAt: new Date('2026-08-05T09:00:00'), status: 'PRESENT', lateByMinutes: null }),
      )
      prisma.shift.findUnique.mockResolvedValue(buildShift())
      prisma.attendance.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(buildAttendance({ ...data, clockInAt: new Date('2026-08-05T09:00:00') })),
      )

      const result = await service.clockOut('org_1', 'staff_1')

      expect(result.status).toBe('PRESENT')
      expect(result.workedMinutes).toBe(8 * 60 - 30)
    })

    it('keeps LATE status for a full shift that started late', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-05T17:00:00'))
      prisma.attendance.findUnique.mockResolvedValue(
        buildAttendance({ clockInAt: new Date('2026-08-05T09:20:00'), status: 'LATE', lateByMinutes: 20 }),
      )
      prisma.shift.findUnique.mockResolvedValue(buildShift())
      prisma.attendance.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(buildAttendance({ ...data, clockInAt: new Date('2026-08-05T09:20:00'), lateByMinutes: 20 })),
      )

      const result = await service.clockOut('org_1', 'staff_1')

      expect(result.status).toBe('LATE')
    })
  })

  describe('correct', () => {
    it('recomputes workedMinutes and flags the record as corrected', async () => {
      prisma.attendance.findFirst.mockResolvedValue(
        buildAttendance({ clockInAt: new Date('2026-08-05T09:00:00'), clockOutAt: new Date('2026-08-05T13:00:00') }),
      )
      prisma.attendance.update.mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(buildAttendance(data)))

      const result = await service.correct(
        'org_1',
        'att_1',
        { clockOutAt: '2026-08-05T17:00:00', correctionReason: 'Forgot to clock out' } as never,
        'hr_1',
      )

      expect(result.isCorrected).toBe(true)
      expect(result.correctedByUserId).toBe('hr_1')
      expect(eventEmitter.emit).toHaveBeenCalledWith('staff.attendance.corrected', expect.any(Object))
    })

    it('throws NotFoundException for an unknown record', async () => {
      prisma.attendance.findFirst.mockResolvedValue(null)

      await expect(
        service.correct('org_1', 'missing', { correctionReason: 'x' } as never, 'hr_1'),
      ).rejects.toThrow(NotFoundException)
    })
  })
})
