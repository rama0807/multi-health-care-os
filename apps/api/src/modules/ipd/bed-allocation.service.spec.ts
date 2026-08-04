import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'

import { BedAllocationService } from './bed-allocation.service'

function buildAdmissionRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'adm_1',
    organizationId: 'org_1',
    patientId: 'patient_1',
    status: 'ADMITTED',
    bedId: null,
    wardId: 'ward_1',
    ...overrides,
  }
}

function buildBedRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'bed_1',
    organizationId: 'org_1',
    roomId: 'room_1',
    wardId: 'ward_1',
    status: 'AVAILABLE',
    ...overrides,
  }
}

describe('BedAllocationService', () => {
  let prisma: {
    admission: Record<string, jest.Mock>
    bed: Record<string, jest.Mock>
    bedAllocation: Record<string, jest.Mock>
    bedTransfer: Record<string, jest.Mock>
    $transaction: jest.Mock
  }
  let bedsService: { requireBed: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let service: BedAllocationService

  beforeEach(() => {
    prisma = {
      admission: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn().mockResolvedValue({}) },
      bed: { update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'bed_1', ...data })) },
      bedAllocation: {
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: 'alloc_1', occurredAt: new Date(), ...data })),
        findMany: jest.fn().mockResolvedValue([]),
      },
      bedTransfer: {
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: 'transfer_1', transferredAt: new Date(), ...data })),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    }
    bedsService = { requireBed: jest.fn() }
    eventEmitter = { emit: jest.fn() }
    service = new BedAllocationService(prisma as never, bedsService as never, eventEmitter as never)
  })

  describe('allocate', () => {
    it('allocates an available bed to an active admission', async () => {
      prisma.admission.findFirst.mockResolvedValue(buildAdmissionRow())
      bedsService.requireBed.mockResolvedValue(buildBedRow())

      const result = await service.allocate('org_1', 'adm_1', { bedId: 'bed_1' } as never, 'actor_1')

      expect(result.action).toBe('ALLOCATED')
      expect(eventEmitter.emit).toHaveBeenCalledWith('ipd.bed_allocated', expect.objectContaining({ admissionId: 'adm_1' }))
    })

    it('rejects allocating a bed that is not available or reserved', async () => {
      prisma.admission.findFirst.mockResolvedValue(buildAdmissionRow())
      bedsService.requireBed.mockResolvedValue(buildBedRow({ status: 'OCCUPIED' }))

      await expect(service.allocate('org_1', 'adm_1', { bedId: 'bed_1' } as never)).rejects.toThrow(
        ConflictException,
      )
    })

    it('rejects when the admission already holds a different bed', async () => {
      prisma.admission.findFirst.mockResolvedValue(buildAdmissionRow({ bedId: 'bed_other' }))
      bedsService.requireBed.mockResolvedValue(buildBedRow())

      await expect(service.allocate('org_1', 'adm_1', { bedId: 'bed_1' } as never)).rejects.toThrow(
        ConflictException,
      )
    })

    it('rejects when the admission is no longer active', async () => {
      prisma.admission.findFirst.mockResolvedValue(buildAdmissionRow({ status: 'CANCELLED' }))

      await expect(service.allocate('org_1', 'adm_1', { bedId: 'bed_1' } as never)).rejects.toThrow(
        ConflictException,
      )
    })

    it('throws NotFoundException for an unknown admission', async () => {
      prisma.admission.findFirst.mockResolvedValue(null)

      await expect(service.allocate('org_1', 'missing', { bedId: 'bed_1' } as never)).rejects.toThrow(
        NotFoundException,
      )
    })
  })

  describe('reserve', () => {
    it('reserves an available bed', async () => {
      prisma.admission.findFirst.mockResolvedValue(buildAdmissionRow())
      bedsService.requireBed.mockResolvedValue(buildBedRow())

      const result = await service.reserve('org_1', 'adm_1', { bedId: 'bed_1' } as never)
      expect(result.action).toBe('RESERVED')
    })

    it('rejects reserving when the admission already holds a bed', async () => {
      prisma.admission.findFirst.mockResolvedValue(buildAdmissionRow({ bedId: 'bed_1' }))
      bedsService.requireBed.mockResolvedValue(buildBedRow())

      await expect(service.reserve('org_1', 'adm_1', { bedId: 'bed_1' } as never)).rejects.toThrow(
        ConflictException,
      )
    })
  })

  describe('vacate', () => {
    it('rejects vacating when no bed is allocated', async () => {
      prisma.admission.findFirst.mockResolvedValue(buildAdmissionRow())

      await expect(service.vacate('org_1', 'adm_1', {} as never)).rejects.toThrow(BadRequestException)
    })

    it('moves an occupied bed to CLEANING and clears the admission bedId', async () => {
      prisma.admission.findFirst.mockResolvedValue(buildAdmissionRow({ bedId: 'bed_1' }))
      bedsService.requireBed.mockResolvedValue(buildBedRow({ status: 'OCCUPIED' }))

      const result = await service.vacate('org_1', 'adm_1', { reason: 'Moved to OT' } as never, 'actor_1')

      expect(result.action).toBe('VACATED')
      expect(prisma.bed.update).toHaveBeenCalledWith({ where: { id: 'bed_1' }, data: { status: 'CLEANING' } })
    })
  })

  describe('transfer', () => {
    it('rejects transferring into a bed that is not available', async () => {
      prisma.admission.findFirst.mockResolvedValue(buildAdmissionRow({ bedId: 'bed_1' }))
      bedsService.requireBed.mockResolvedValue(buildBedRow({ id: 'bed_2', status: 'OCCUPIED' }))

      await expect(service.transfer('org_1', 'adm_1', { toBedId: 'bed_2' } as never)).rejects.toThrow(
        ConflictException,
      )
    })

    it('transfers from the current bed to a new bed and records history', async () => {
      prisma.admission.findFirst.mockResolvedValue(buildAdmissionRow({ bedId: 'bed_1' }))
      bedsService.requireBed.mockImplementation((_org: string, id: string) =>
        Promise.resolve(id === 'bed_1' ? buildBedRow({ id: 'bed_1', status: 'OCCUPIED' }) : buildBedRow({ id: 'bed_2' })),
      )

      const result = await service.transfer('org_1', 'adm_1', { toBedId: 'bed_2', reason: 'Maintenance' } as never)

      expect(result.fromBedId).toBe('bed_1')
      expect(result.toBedId).toBe('bed_2')
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'ipd.bed_transferred',
        expect.objectContaining({ fromBedId: 'bed_1', toBedId: 'bed_2' }),
      )
    })

    it('allows transferring an admission with no current bed (first allocation via transfer)', async () => {
      prisma.admission.findFirst.mockResolvedValue(buildAdmissionRow())
      bedsService.requireBed.mockResolvedValue(buildBedRow({ id: 'bed_2' }))

      const result = await service.transfer('org_1', 'adm_1', { toBedId: 'bed_2' } as never)
      expect(result.fromBedId).toBeUndefined()
      expect(result.toBedId).toBe('bed_2')
    })
  })
})
