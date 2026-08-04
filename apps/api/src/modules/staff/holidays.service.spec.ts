import { ConflictException, NotFoundException } from '@nestjs/common'

import { HolidaysService } from './holidays.service'

function buildHoliday(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'holiday_1',
    organizationId: 'org_1',
    name: 'Independence Day',
    date: new Date('2026-08-15'),
    isOptional: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('HolidaysService', () => {
  let prisma: { holiday: Record<string, jest.Mock> }
  let service: HolidaysService

  beforeEach(() => {
    prisma = { holiday: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), delete: jest.fn() } }
    service = new HolidaysService(prisma as never)
  })

  afterEach(() => jest.clearAllMocks())

  it('rejects a duplicate holiday date', async () => {
    prisma.holiday.findUnique.mockResolvedValue(buildHoliday())

    await expect(
      service.create('org_1', { name: 'Independence Day', date: '2026-08-15', isOptional: false } as never),
    ).rejects.toThrow(ConflictException)
  })

  it('creates a holiday for a free date', async () => {
    prisma.holiday.findUnique.mockResolvedValue(null)
    prisma.holiday.create.mockResolvedValue(buildHoliday())

    const result = await service.create('org_1', { name: 'Independence Day', date: '2026-08-15', isOptional: false } as never)

    expect(result.name).toBe('Independence Day')
  })

  it('throws NotFoundException deleting an unknown holiday', async () => {
    prisma.holiday.findFirst.mockResolvedValue(null)

    await expect(service.delete('org_1', 'missing')).rejects.toThrow(NotFoundException)
  })
})
