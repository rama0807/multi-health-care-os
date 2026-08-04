import { PayrollService } from './payroll.service'

function buildStaff(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'staff_1',
    employeeId: 'EMP-001',
    designation: 'Staff Nurse',
    monthlySalary: 30000,
    user: { firstName: 'Anjali', lastName: 'Verma' },
    department: { name: 'Nursing' },
    ...overrides,
  }
}

function buildShift(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'shift_1',
    startTime: '09:00',
    endTime: '17:00',
    breakMinutes: 30,
    ...overrides,
  }
}

describe('PayrollService', () => {
  let prisma: {
    staff: Record<string, jest.Mock>
    attendance: Record<string, jest.Mock>
    shiftRoster: Record<string, jest.Mock>
    staffLeave: Record<string, jest.Mock>
  }
  let holidaysService: { findInRange: jest.Mock }
  let leaveTypesService: { findAllActive: jest.Mock }
  let service: PayrollService

  beforeEach(() => {
    prisma = {
      staff: { findMany: jest.fn() },
      attendance: { findMany: jest.fn() },
      shiftRoster: { count: jest.fn().mockResolvedValue(0) },
      staffLeave: { findMany: jest.fn().mockResolvedValue([]) },
    }
    holidaysService = { findInRange: jest.fn().mockResolvedValue([]) }
    leaveTypesService = { findAllActive: jest.fn().mockResolvedValue([]) }

    service = new PayrollService(prisma as never, holidaysService as never, leaveTypesService as never)
  })

  afterEach(() => jest.clearAllMocks())

  it('rejects a malformed month', async () => {
    await expect(service.getSummary('org_1', { month: '2026-8' })).rejects.toThrow()
  })

  it('summarizes present days with no overtime when worked minutes match the shift standard', async () => {
    prisma.staff.findMany.mockResolvedValue([buildStaff()])
    prisma.attendance.findMany.mockResolvedValue(
      Array.from({ length: 20 }, () => ({ status: 'PRESENT', workedMinutes: 450, shift: buildShift() })),
    )

    const result = await service.getSummary('org_1', { month: '2026-08' })

    const entry = result.entries[0]
    expect(entry.daysPresent).toBe(20)
    expect(entry.overtimeMinutes).toBe(0)
    expect(entry.overtimeAmount).toBe(0)
    expect(entry.netPayableDays).toBe(20)
  })

  it('computes overtime pay from the per-day rate derived from monthlySalary / 30', async () => {
    prisma.staff.findMany.mockResolvedValue([buildStaff({ monthlySalary: 30000 })])
    // standard = 450 min; worked 480 min => 30 min overtime; perDayRate = 1000; perMinuteRate = 1000/450
    prisma.attendance.findMany.mockResolvedValue([{ status: 'PRESENT', workedMinutes: 480, shift: buildShift() }])

    const result = await service.getSummary('org_1', { month: '2026-08' })

    const entry = result.entries[0]
    expect(entry.overtimeMinutes).toBe(30)
    expect(entry.overtimeAmount).toBeCloseTo((1000 / 450) * 30, 2)
  })

  it('deducts unpaid leave days at the per-day rate', async () => {
    prisma.staff.findMany.mockResolvedValue([buildStaff({ monthlySalary: 30000 })])
    prisma.attendance.findMany.mockResolvedValue([])
    leaveTypesService.findAllActive.mockResolvedValue([{ leaveType: 'CASUAL', isPaid: false }])
    prisma.staffLeave.findMany.mockResolvedValue([
      { leaveType: 'CASUAL', startDate: new Date('2026-08-05'), endDate: new Date('2026-08-06') },
    ])

    const result = await service.getSummary('org_1', { month: '2026-08' })

    const entry = result.entries[0]
    expect(entry.unpaidLeaveDays).toBe(2)
    expect(entry.leaveDeductionAmount).toBeCloseTo(2000, 2)
  })

  it('produces a CSV export with a header row and one row per entry', async () => {
    prisma.staff.findMany.mockResolvedValue([buildStaff()])
    prisma.attendance.findMany.mockResolvedValue([])

    const result = await service.getSummary('org_1', { month: '2026-08' })
    const csv = service.toCsv(result)

    const lines = csv.split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('Employee ID')
    expect(lines[1]).toContain('EMP-001')
  })
})
