import { ConflictException, NotFoundException } from '@nestjs/common'

import { RoomsService } from './rooms.service'

function buildRoomRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'room_1',
    organizationId: 'org_1',
    roomNumber: '301',
    wardId: 'ward_1',
    floor: '3',
    capacity: 1,
    chargesPerDay: { toString: () => '5000' },
    status: 'ACTIVE',
    createdAt: new Date('2026-08-04'),
    updatedAt: new Date('2026-08-04'),
    ward: { id: 'ward_1', name: 'ICU Ward', code: 'ICU1', type: 'ICU' },
    beds: [],
    ...overrides,
  }
}

describe('RoomsService', () => {
  let prisma: { room: Record<string, jest.Mock> }
  let wardsService: { requireWard: jest.Mock }
  let service: RoomsService

  beforeEach(() => {
    prisma = {
      room: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
    }
    wardsService = { requireWard: jest.fn().mockResolvedValue({ id: 'ward_1' }) }
    service = new RoomsService(prisma as never, wardsService as never)
  })

  describe('create', () => {
    it('creates a room after validating the ward exists', async () => {
      prisma.room.findUnique.mockResolvedValue(null)
      prisma.room.create.mockResolvedValue(buildRoomRow())

      const result = await service.create('org_1', {
        roomNumber: '301',
        wardId: 'ward_1',
        capacity: 1,
        chargesPerDay: 5000,
      } as never)

      expect(wardsService.requireWard).toHaveBeenCalledWith('org_1', 'ward_1')
      expect(result.roomNumber).toBe('301')
      expect(result.chargesPerDay).toBe('5000')
    })

    it('rejects a duplicate room number within the ward', async () => {
      prisma.room.findUnique.mockResolvedValue(buildRoomRow())

      await expect(
        service.create('org_1', { roomNumber: '301', wardId: 'ward_1', capacity: 1, chargesPerDay: 5000 } as never),
      ).rejects.toThrow(ConflictException)
    })
  })

  describe('deactivate', () => {
    it('rejects an unknown room', async () => {
      prisma.room.findFirst.mockResolvedValue(null)
      await expect(service.deactivate('org_1', 'missing')).rejects.toThrow(NotFoundException)
    })

    it('deactivates an active room', async () => {
      prisma.room.findFirst.mockResolvedValue(buildRoomRow())
      prisma.room.update.mockResolvedValue(buildRoomRow({ status: 'INACTIVE' }))

      const result = await service.deactivate('org_1', 'room_1')
      expect(result.status).toBe('INACTIVE')
    })
  })

  describe('requireRoom', () => {
    it('throws NotFoundException when not found', async () => {
      prisma.room.findFirst.mockResolvedValue(null)
      await expect(service.requireRoom('org_1', 'missing')).rejects.toThrow(NotFoundException)
    })
  })
})
