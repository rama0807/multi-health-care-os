import { ConflictException } from '@nestjs/common'

import { ShiftsService } from './shifts.service'

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

describe('ShiftsService', () => {
  let prisma: { shift: Record<string, jest.Mock>; shiftRoster: Record<string, jest.Mock> }
  let service: ShiftsService

  beforeEach(() => {
    prisma = {
      shift: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      shiftRoster: { findFirst: jest.fn() },
    }
    service = new ShiftsService(prisma as never)
  })

  afterEach(() => jest.clearAllMocks())

  describe('standardMinutes', () => {
    it('computes a same-day shift minus its break', () => {
      expect(ShiftsService.standardMinutes(buildShift())).toBe(8 * 60 - 30)
    })

    it('crosses midnight for a night shift', () => {
      const night = buildShift({ startTime: '22:00', endTime: '06:00', breakMinutes: 30, isNightShift: true })
      expect(ShiftsService.standardMinutes(night)).toBe(8 * 60 - 30)
    })
  })

  describe('create', () => {
    it('rejects a duplicate shift code', async () => {
      prisma.shift.findUnique.mockResolvedValue(buildShift())

      await expect(
        service.create('org_1', { name: 'Morning', code: 'MORN', startTime: '09:00', endTime: '17:00' } as never),
      ).rejects.toThrow(ConflictException)
    })

    it('creates a shift with a unique code', async () => {
      prisma.shift.findUnique.mockResolvedValue(null)
      prisma.shift.create.mockResolvedValue(buildShift())

      const result = await service.create('org_1', {
        name: 'Morning',
        code: 'MORN',
        startTime: '09:00',
        endTime: '17:00',
      } as never)

      expect(result.code).toBe('MORN')
      expect(result.standardMinutes).toBe(8 * 60 - 30)
    })
  })

  describe('deactivate', () => {
    it('rejects deactivating a shift with upcoming roster assignments', async () => {
      prisma.shift.findFirst.mockResolvedValue(buildShift())
      prisma.shiftRoster.findFirst.mockResolvedValue({ id: 'roster_1' })

      await expect(service.deactivate('org_1', 'shift_1')).rejects.toThrow(ConflictException)
    })

    it('deactivates a shift with no upcoming assignments', async () => {
      prisma.shift.findFirst.mockResolvedValue(buildShift())
      prisma.shiftRoster.findFirst.mockResolvedValue(null)
      prisma.shift.update.mockResolvedValue(buildShift({ isActive: false }))

      const result = await service.deactivate('org_1', 'shift_1')

      expect(result.isActive).toBe(false)
    })
  })
})
