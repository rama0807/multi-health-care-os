import { ConflictException, NotFoundException } from '@nestjs/common'

import { AssetsService } from './assets.service'

function buildAsset(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'asset_1',
    organizationId: 'org_1',
    itemId: 'item_1',
    storeId: 'store_1',
    assetTag: 'ASSET-001',
    serialNumber: null,
    status: 'IN_STORE',
    purchaseDate: null,
    purchasePrice: null,
    warrantyExpiryDate: null,
    amcVendorId: null,
    amcStartDate: null,
    amcEndDate: null,
    lastCalibrationDate: null,
    nextCalibrationDate: null,
    assignedToUserId: null,
    assignedToDepartmentId: null,
    notes: null,
    createdAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-01'),
    item: { id: 'item_1', name: 'Infusion Pump', code: 'ITM-1' },
    store: { id: 'store_1', name: 'Central', code: 'CTR' },
    ...overrides,
  }
}

describe('AssetsService', () => {
  let prisma: {
    asset: Record<string, jest.Mock>
    assetAssignment: Record<string, jest.Mock>
    assetMaintenanceRecord: Record<string, jest.Mock>
    $transaction: jest.Mock
  }
  let inventoryItemsService: { requireItem: jest.Mock }
  let storesService: { requireStore: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let service: AssetsService

  beforeEach(() => {
    prisma = {
      asset: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
      assetAssignment: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), findMany: jest.fn() },
      assetMaintenanceRecord: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn() },
      $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(prisma)),
    }
    inventoryItemsService = { requireItem: jest.fn() }
    storesService = { requireStore: jest.fn() }
    eventEmitter = { emit: jest.fn() }
    service = new AssetsService(prisma as never, inventoryItemsService as never, storesService as never, eventEmitter as never)
  })

  afterEach(() => jest.clearAllMocks())

  describe('create', () => {
    it('rejects registering an asset from an item not marked itemType ASSET', async () => {
      inventoryItemsService.requireItem.mockResolvedValue({ itemType: 'CONSUMABLE' })

      await expect(
        service.create('org_1', 'user_1', { itemId: 'item_1', storeId: 'store_1', assetTag: 'A-1' } as never),
      ).rejects.toThrow(ConflictException)
    })

    it('creates the asset when the item is a real ASSET', async () => {
      inventoryItemsService.requireItem.mockResolvedValue({ itemType: 'ASSET' })
      prisma.asset.create.mockResolvedValue(buildAsset())

      const result = await service.create('org_1', 'user_1', { itemId: 'item_1', storeId: 'store_1', assetTag: 'A-1' } as never)

      expect(result.assetTag).toBe('ASSET-001')
      expect(eventEmitter.emit).toHaveBeenCalledWith('asset.created', expect.objectContaining({ assetId: 'asset_1' }))
    })
  })

  describe('assign', () => {
    it('sets status IN_USE when assigned to a user or department', async () => {
      prisma.asset.findFirst.mockResolvedValue(buildAsset({ status: 'IN_STORE' })).mockResolvedValueOnce(buildAsset({ status: 'IN_STORE' }))

      await service.assign('org_1', 'assigner_1', 'asset_1', { assignedToDepartmentId: 'dept_1' } as never)

      expect(prisma.asset.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'IN_USE', assignedToDepartmentId: 'dept_1' }) }),
      )
    })

    it('sets status IN_STORE when un-assigned (both target fields omitted)', async () => {
      prisma.asset.findFirst.mockResolvedValue(buildAsset({ status: 'IN_USE', assignedToDepartmentId: 'dept_1' }))

      await service.assign('org_1', 'assigner_1', 'asset_1', {} as never)

      expect(prisma.asset.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'IN_STORE', assignedToDepartmentId: null }) }),
      )
    })

    it('throws NotFoundException for an asset outside the organization', async () => {
      prisma.asset.findFirst.mockResolvedValue(null)
      await expect(service.assign('org_1', 'assigner_1', 'missing', {} as never)).rejects.toThrow(NotFoundException)
    })
  })

  describe('createMaintenanceRecord', () => {
    it('flips the asset to BREAKDOWN and the record to IN_PROGRESS for a breakdown report', async () => {
      prisma.asset.findFirst.mockResolvedValue(buildAsset())
      prisma.assetMaintenanceRecord.create.mockResolvedValue({ id: 'rec_1', status: 'IN_PROGRESS', type: 'BREAKDOWN' })

      const result = await service.createMaintenanceRecord('org_1', 'user_1', 'asset_1', {
        type: 'BREAKDOWN',
        description: 'Stopped working',
      } as never)

      expect(result.status).toBe('IN_PROGRESS')
      expect(prisma.asset.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'BREAKDOWN' } }))
    })

    it('flips the asset to UNDER_MAINTENANCE for a scheduled preventive record', async () => {
      prisma.asset.findFirst.mockResolvedValue(buildAsset())
      prisma.assetMaintenanceRecord.create.mockResolvedValue({ id: 'rec_2', status: 'SCHEDULED', type: 'PREVENTIVE' })

      await service.createMaintenanceRecord('org_1', 'user_1', 'asset_1', {
        type: 'PREVENTIVE',
        description: 'Quarterly service',
      } as never)

      expect(prisma.asset.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'UNDER_MAINTENANCE' } }))
    })
  })

  describe('completeMaintenanceRecord', () => {
    it('rejects completing a record that is already completed', async () => {
      prisma.asset.findFirst.mockResolvedValue(buildAsset())
      prisma.assetMaintenanceRecord.findFirst.mockResolvedValue({ id: 'rec_1', status: 'COMPLETED', type: 'BREAKDOWN' })

      await expect(
        service.completeMaintenanceRecord('org_1', 'user_1', 'asset_1', 'rec_1', {} as never),
      ).rejects.toThrow(ConflictException)
    })

    it('restores the asset to IN_USE if it is currently assigned', async () => {
      prisma.asset.findFirst.mockResolvedValue(buildAsset({ assignedToUserId: 'user_9' }))
      prisma.assetMaintenanceRecord.findFirst.mockResolvedValue({ id: 'rec_1', status: 'IN_PROGRESS', type: 'BREAKDOWN' })
      prisma.assetMaintenanceRecord.update.mockResolvedValue({ id: 'rec_1', status: 'COMPLETED' })

      await service.completeMaintenanceRecord('org_1', 'user_1', 'asset_1', 'rec_1', {} as never)

      expect(prisma.asset.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'IN_USE' }) }),
      )
    })
  })
})
