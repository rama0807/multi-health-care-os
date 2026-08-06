import { AvailabilityService } from './availability.service'

function scheduleRowWithMonday(day: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'schedule_1',
    doctorId: 'doctor_1',
    days: [
      {
        id: 'day_mon',
        dayOfWeek: 'MONDAY',
        isWorkingDay: true,
        shifts: [{ startTime: '09:00', endTime: '10:00', slotDurationMinutes: 15, breaks: [] }],
        ...day,
      },
    ],
  }
}

describe('AvailabilityService', () => {
  let prisma: {
    doctor: Record<string, jest.Mock>
    doctorLeave: Record<string, jest.Mock>
    doctorSchedule: Record<string, jest.Mock>
  }
  let doctorRef: { requireDoctor: jest.Mock }
  let scheduleService: { findEffectiveRow: jest.Mock }
  let service: AvailabilityService

  beforeEach(() => {
    prisma = {
      doctor: { findMany: jest.fn() },
      doctorLeave: { findFirst: jest.fn(), findMany: jest.fn() },
      doctorSchedule: { findMany: jest.fn() },
    }
    doctorRef = { requireDoctor: jest.fn().mockResolvedValue({ id: 'doctor_1' }) }
    scheduleService = { findEffectiveRow: jest.fn() }

    service = new AvailabilityService(prisma as never, doctorRef as never, scheduleService as never)
  })

  afterEach(() => jest.clearAllMocks())

  describe('getAvailableSlots', () => {
    it('returns onLeave with no slots when an approved leave covers the date', async () => {
      prisma.doctorLeave.findFirst.mockResolvedValue({ leaveType: 'SICK' })

      const result = await service.getAvailableSlots('org_1', 'doctor_1', '2026-08-03')

      expect(result).toEqual({
        doctorId: 'doctor_1',
        date: '2026-08-03',
        isWorkingDay: false,
        onLeave: true,
        leaveType: 'SICK',
        slots: [],
      })
    })

    it('returns isWorkingDay false when the schedule marks the day off', async () => {
      prisma.doctorLeave.findFirst.mockResolvedValue(null)
      scheduleService.findEffectiveRow.mockResolvedValue(
        scheduleRowWithMonday({ dayOfWeek: 'MONDAY', isWorkingDay: false, shifts: [] }),
      )

      // 2026-08-04 is a Tuesday - no matching day in a schedule that only defines Monday.
      const result = await service.getAvailableSlots('org_1', 'doctor_1', '2026-08-04')

      expect(result.isWorkingDay).toBe(false)
      expect(result.slots).toEqual([])
    })

    it('generates 15-minute slots across a shift, honoring breaks', async () => {
      prisma.doctorLeave.findFirst.mockResolvedValue(null)
      scheduleService.findEffectiveRow.mockResolvedValue(
        scheduleRowWithMonday({
          shifts: [
            {
              startTime: '09:00',
              endTime: '10:00',
              slotDurationMinutes: 15,
              breaks: [{ startTime: '09:30', endTime: '09:45' }],
            },
          ],
        }),
      )

      // 2026-08-03 is a Monday.
      const result = await service.getAvailableSlots('org_1', 'doctor_1', '2026-08-03')

      expect(result.isWorkingDay).toBe(true)
      expect(result.slots.map((s) => s.start.slice(11, 16))).toEqual(['09:00', '09:15', '09:45'])
    })

    it('respects a duration override wider than the shift default', async () => {
      prisma.doctorLeave.findFirst.mockResolvedValue(null)
      scheduleService.findEffectiveRow.mockResolvedValue(scheduleRowWithMonday())

      const result = await service.getAvailableSlots('org_1', 'doctor_1', '2026-08-03', 30)

      expect(result.slots).toHaveLength(2) // 09:00-09:30, 09:30-10:00
    })
  })

  describe('getDashboardStats', () => {
    it('returns all zeros when the org has no active doctors', async () => {
      prisma.doctor.findMany.mockResolvedValue([])

      const result = await service.getDashboardStats('org_1')

      expect(result).toEqual({ availableToday: 0, onLeaveToday: 0, offDutyToday: 0, upcomingLeave: [] })
    })

    it('counts doctors on leave separately from working-day availability', async () => {
      prisma.doctor.findMany.mockResolvedValue([{ id: 'doctor_1' }, { id: 'doctor_2' }])
      prisma.doctorLeave.findMany
        .mockResolvedValueOnce([{ doctorId: 'doctor_1' }]) // today's approved leave
        .mockResolvedValueOnce([]) // upcoming leave
      prisma.doctorSchedule.findMany.mockResolvedValue([])

      const result = await service.getDashboardStats('org_1')

      expect(result.onLeaveToday).toBe(1)
      // doctor_2 has no schedule row at all -> counted as off duty, not available
      expect(result.availableToday).toBe(0)
      expect(result.offDutyToday).toBe(1)
    })
  })
})
