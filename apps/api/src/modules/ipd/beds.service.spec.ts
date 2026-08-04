import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'

import { BedsService } from './beds.service'

function buildBedRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'bed_1',
    organizationId: 'org_1',
    bedNumber: '301-A',
    roomId: 'room_1',
    wardId: 'ward_1',
    type: 'ICU',
    status: 'AVAILABLE',
    createdAt: new Date('2026-08-04'),
    updatedAt: new Date('2026-08-04'),
    room: { id: 'room_1', roomNumber: '301', chargesPerDay: { toString: () => '5000' } },
    ward: { id: 'ward_1', name: 'ICU Ward', code: 'ICU1', type: 'ICU' },
    ...overrides,
  }
}

describe('BedsService', () => {
  let prisma: { bed: Record<string, jest.Mock>; admission: Record<string, jest.Mock> }
  let roomsService: { requireRoom: jest.Mock }
  let service: BedsService

  beforeEach(() => {
    prisma = {
      bed: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
      admission: { findMany: jest.fn().mockResolvedValue([]) },
    }
    roomsService = { requireRoom: jest.fn().mockResolvedValue({ id: 'room_1', wardId: 'ward_1' }) }
    service = new BedsService(prisma as never, roomsService as never)
  })

  describe('create', () => {
    it('creates a bed inheriting the ward from its room', async () => {
      prisma.bed.findUnique.mockResolvedValue(null)
      prisma.bed.create.mockResolvedValue(buildBedRow())

      const result = await service.create('org_1', { bedNumber: '301-A', roomId: 'room_1', type: 'ICU' } as never)

      expect(roomsService.requireRoom).toHaveBeenCalledWith('org_1', 'room_1')
      expect(result.wardId).toBe('ward_1')
    })

    it('rejects a duplicate bed number within the room', async () => {
      prisma.bed.findUnique.mockResolvedValue(buildBedRow())

      await expect(
        service.create('org_1', { bedNumber: '301-A', roomId: 'room_1', type: 'ICU' } as never),
      ).rejects.toThrow(ConflictException)
    })
  })

  describe('update', () => {
    it('rejects setting status to OCCUPIED directly', async () => {
      prisma.bed.findFirst.mockResolvedValue(buildBedRow())

      await expect(service.update('org_1', 'bed_1', { status: 'OCCUPIED' } as never)).rejects.toThrow(
        BadRequestException,
      )
    })

    it('rejects changing the status of an occupied bed directly', async () => {
      prisma.bed.findFirst.mockResolvedValue(buildBedRow({ status: 'OCCUPIED' }))

      await expect(service.update('org_1', 'bed_1', { status: 'CLEANING' } as never)).rejects.toThrow(
        ConflictException,
      )
    })

    it('allows a non-occupied bed to change status', async () => {
      prisma.bed.findFirst.mockResolvedValue(buildBedRow({ status: 'CLEANING' }))
      prisma.bed.update.mockResolvedValue(buildBedRow({ status: 'AVAILABLE' }))

      const result = await service.update('org_1', 'bed_1', { status: 'AVAILABLE' } as never)
      expect(result.status).toBe('AVAILABLE')
    })
  })

  describe('deactivate', () => {
    it('rejects deactivating an occupied bed', async () => {
      prisma.bed.findFirst.mockResolvedValue(buildBedRow({ status: 'OCCUPIED' }))
      await expect(service.deactivate('org_1', 'bed_1')).rejects.toThrow(ConflictException)
    })

    it('deactivates (blocks) a non-occupied bed', async () => {
      prisma.bed.findFirst.mockResolvedValue(buildBedRow())
      prisma.bed.update.mockResolvedValue(buildBedRow({ status: 'BLOCKED' }))

      const result = await service.deactivate('org_1', 'bed_1')
      expect(result.status).toBe('BLOCKED')
    })
  })

  describe('getById', () => {
    it('throws NotFoundException when not found', async () => {
      prisma.bed.findFirst.mockResolvedValue(null)
      await expect(service.getById('org_1', 'missing')).rejects.toThrow(NotFoundException)
    })

    it('includes the current admission when the bed is occupied', async () => {
      prisma.bed.findFirst.mockResolvedValue(buildBedRow({ status: 'OCCUPIED' }))
      prisma.admission.findMany.mockResolvedValue([
        {
          id: 'adm_1',
          admissionNumber: 'ADM-MED-2026-000001',
          bedId: 'bed_1',
          patientId: 'patient_1',
          patient: { firstName: 'Ramesh', lastName: 'Gupta' },
        },
      ])

      const result = await service.getById('org_1', 'bed_1')
      expect(result.currentAdmission?.patientName).toBe('Ramesh Gupta')
    })
  })
})
