import { ConflictException, NotFoundException } from '@nestjs/common'

import { WardsService } from './wards.service'

function buildWardRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'ward_1',
    organizationId: 'org_1',
    name: 'ICU Ward',
    code: 'ICU1',
    floor: '3',
    block: 'A',
    type: 'ICU',
    departmentId: null,
    status: 'ACTIVE',
    createdAt: new Date('2026-08-04'),
    updatedAt: new Date('2026-08-04'),
    department: null,
    rooms: [],
    beds: [],
    ...overrides,
  }
}

describe('WardsService', () => {
  let prisma: {
    ward: Record<string, jest.Mock>
    department: Record<string, jest.Mock>
  }
  let service: WardsService

  beforeEach(() => {
    prisma = {
      ward: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
      department: { findFirst: jest.fn() },
    }
    service = new WardsService(prisma as never)
  })

  describe('create', () => {
    it('creates a ward', async () => {
      prisma.ward.findUnique.mockResolvedValue(null)
      prisma.ward.create.mockResolvedValue(buildWardRow())

      const result = await service.create('org_1', { name: 'ICU Ward', code: 'ICU1', type: 'ICU' } as never)

      expect(result.code).toBe('ICU1')
    })

    it('rejects a duplicate code within the org', async () => {
      prisma.ward.findUnique.mockResolvedValue(buildWardRow())

      await expect(
        service.create('org_1', { name: 'Dup Ward', code: 'ICU1', type: 'ICU' } as never),
      ).rejects.toThrow(ConflictException)
    })

    it('rejects an unknown department', async () => {
      prisma.ward.findUnique.mockResolvedValue(null)
      prisma.department.findFirst.mockResolvedValue(null)

      await expect(
        service.create('org_1', { name: 'ICU Ward', code: 'ICU1', type: 'ICU', departmentId: 'dept_x' } as never),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('deactivate', () => {
    it('rejects an unknown ward', async () => {
      prisma.ward.findFirst.mockResolvedValue(null)
      await expect(service.deactivate('org_1', 'missing')).rejects.toThrow(NotFoundException)
    })

    it('rejects deactivating an already-inactive ward', async () => {
      prisma.ward.findFirst.mockResolvedValue(buildWardRow({ status: 'INACTIVE' }))
      await expect(service.deactivate('org_1', 'ward_1')).rejects.toThrow(ConflictException)
    })

    it('deactivates an active ward', async () => {
      prisma.ward.findFirst.mockResolvedValue(buildWardRow())
      prisma.ward.update.mockResolvedValue(buildWardRow({ status: 'INACTIVE' }))

      const result = await service.deactivate('org_1', 'ward_1')
      expect(result.status).toBe('INACTIVE')
    })
  })

  describe('list', () => {
    it('returns paginated results with bed counts', async () => {
      prisma.ward.findMany.mockResolvedValue([
        buildWardRow({ rooms: [{ id: 'room_1' }], beds: [{ id: 'bed_1', status: 'OCCUPIED' }, { id: 'bed_2', status: 'AVAILABLE' }] }),
      ])
      prisma.ward.count.mockResolvedValue(1)

      const result = await service.list('org_1', {})
      expect(result.data).toHaveLength(1)
      expect(result.data[0].bedCount).toBe(2)
      expect(result.data[0].occupiedBedCount).toBe(1)
      expect(result.data[0].availableBedCount).toBe(1)
    })
  })

  describe('requireWard', () => {
    it('throws NotFoundException when not found', async () => {
      prisma.ward.findFirst.mockResolvedValue(null)
      await expect(service.requireWard('org_1', 'missing')).rejects.toThrow(NotFoundException)
    })
  })
})
