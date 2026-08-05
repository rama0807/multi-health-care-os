import { ShiftRosterService } from './shift-roster.service'

function buildRoster(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'roster_1',
    staffId: 'staff_1',
    shiftId: 'shift_1',
    organizationId: 'org_1',
    date: new Date('2026-08-10'),
    isOff: false,
    notes: null,
    createdByUserId: 'hr_1',
    createdAt: new Date(),
    updatedAt: new Date(),
    staff: { id: 'staff_1', employeeId: 'EMP-001', designation: 'Staff Nurse', user: { firstName: 'Anjali', lastName: 'Verma' } },
    shift: {
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
    },
    ...overrides,
  }
}

describe('ShiftRosterService', () => {
  let prisma: { shiftRoster: Record<string, jest.Mock> }
  let staffRef: { requireStaff: jest.Mock }
  let shiftsService: { requireShift: jest.Mock }
  let service: ShiftRosterService

  beforeEach(() => {
    prisma = { shiftRoster: { upsert: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), delete: jest.fn() } }
    staffRef = { requireStaff: jest.fn().mockResolvedValue({ id: 'staff_1' }) }
    shiftsService = { requireShift: jest.fn().mockResolvedValue({ id: 'shift_1' }) }
    // Milestone 18: a roster assignment announces `staff.roster.assigned`.
    service = new ShiftRosterService(
      prisma as never,
      staffRef as never,
      shiftsService as never,
      { emit: jest.fn() } as never,
    )
  })

  afterEach(() => jest.clearAllMocks())

  it('assigns a shift to a staff member for a date', async () => {
    prisma.shiftRoster.upsert.mockResolvedValue(buildRoster())

    const result = await service.assign(
      'org_1',
      { staffId: 'staff_1', date: '2026-08-10', shiftId: 'shift_1', isOff: false } as never,
      'hr_1',
    )

    expect(result.shift?.id).toBe('shift_1')
    expect(result.staff.fullName).toBe('Anjali Verma')
  })

  it('bulk-assigns the same shift to several staff for one date', async () => {
    prisma.shiftRoster.upsert.mockResolvedValue(buildRoster())

    const results = await service.bulkAssign(
      'org_1',
      { staffIds: ['staff_1', 'staff_2'], date: '2026-08-10', shiftId: 'shift_1', isOff: false } as never,
      'hr_1',
    )

    expect(results).toHaveLength(2)
    expect(prisma.shiftRoster.upsert).toHaveBeenCalledTimes(2)
  })

  it('clears the shift when marking a day off', async () => {
    prisma.shiftRoster.upsert.mockResolvedValue(buildRoster({ isOff: true, shiftId: null, shift: null }))

    const result = await service.assign('org_1', { staffId: 'staff_1', date: '2026-08-10', isOff: true } as never, 'hr_1')

    expect(result.isOff).toBe(true)
    expect(prisma.shiftRoster.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ shiftId: null, isOff: true }) }),
    )
  })
})
