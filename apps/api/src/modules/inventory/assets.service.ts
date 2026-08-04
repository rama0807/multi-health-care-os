import {
  Asset,
  AssetAssignment,
  AssetMaintenanceRecord,
  AssetMaintenanceType,
  AssetQuery,
  AssignAssetDto,
  CompleteMaintenanceRecordDto,
  CreateAssetDto,
  CreateMaintenanceRecordDto,
  UpdateAssetDto,
} from '@medicore/types'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { AssetMaintenanceStatus, AssetStatus, Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { InventoryItemsService } from './inventory-items.service'
import { StoresService } from './stores.service'

const ASSET_INCLUDE = {
  item: { select: { id: true, name: true, code: true } },
  store: { select: { id: true, name: true, code: true } },
} satisfies Prisma.AssetInclude

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryItemsService: InventoryItemsService,
    private readonly storesService: StoresService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(organizationId: string, query: AssetQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20
    const where: Prisma.AssetWhereInput = { organizationId }
    if (query.storeId) where.storeId = query.storeId
    if (query.status) where.status = query.status
    if (query.itemId) where.itemId = query.itemId
    if (query.search) {
      where.OR = [
        { assetTag: { contains: query.search, mode: 'insensitive' } },
        { serialNumber: { contains: query.search, mode: 'insensitive' } },
      ]
    }

    const [data, total] = await Promise.all([
      this.prisma.asset.findMany({ where, include: ASSET_INCLUDE, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.asset.count({ where }),
    ])
    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrev: page > 1 },
    }
  }

  async getById(organizationId: string, id: string): Promise<Asset> {
    const asset = await this.requireAsset(organizationId, id)
    return asset as unknown as Asset
  }

  async create(organizationId: string, userId: string, dto: CreateAssetDto): Promise<Asset> {
    const item = await this.inventoryItemsService.requireItem(organizationId, dto.itemId)
    if (item.itemType !== 'ASSET') throw new ConflictException('Only items marked as Asset can be registered as an asset')
    await this.storesService.requireStore(organizationId, dto.storeId)

    const created = await this.prisma.asset
      .create({ data: { organizationId, ...dto }, include: ASSET_INCLUDE })
      .catch((e) => this.rethrowUniqueCode(e))
    this.eventEmitter.emit('asset.created', { organizationId, userId, assetId: created.id })
    return created as unknown as Asset
  }

  async update(organizationId: string, id: string, dto: UpdateAssetDto): Promise<Asset> {
    await this.requireAsset(organizationId, id)
    const updated = await this.prisma.asset
      .update({ where: { id }, data: dto, include: ASSET_INCLUDE })
      .catch((e) => this.rethrowUniqueCode(e))
    return updated as unknown as Asset
  }

  async assign(organizationId: string, userId: string, id: string, dto: AssignAssetDto): Promise<Asset> {
    const asset = await this.requireAsset(organizationId, id)

    await this.prisma.$transaction(async (tx) => {
      const openAssignment = await tx.assetAssignment.findFirst({ where: { assetId: id, returnedAt: null } })
      if (openAssignment) await tx.assetAssignment.update({ where: { id: openAssignment.id }, data: { returnedAt: new Date() } })

      await tx.assetAssignment.create({
        data: {
          organizationId,
          assetId: id,
          assignedToUserId: dto.assignedToUserId,
          assignedToDepartmentId: dto.assignedToDepartmentId,
          storeId: dto.storeId ?? asset.storeId,
          assignedByUserId: userId,
          notes: dto.notes,
        },
      })

      await tx.asset.update({
        where: { id },
        data: {
          assignedToUserId: dto.assignedToUserId ?? null,
          assignedToDepartmentId: dto.assignedToDepartmentId ?? null,
          storeId: dto.storeId ?? asset.storeId,
          status: dto.assignedToUserId || dto.assignedToDepartmentId ? AssetStatus.IN_USE : AssetStatus.IN_STORE,
        },
      })
    })
    this.eventEmitter.emit('asset.assigned', {
      organizationId,
      userId,
      assetId: id,
      assignedToUserId: dto.assignedToUserId,
      assignedToDepartmentId: dto.assignedToDepartmentId,
    })
    const updatedAsset = await this.requireAsset(organizationId, id)
    return updatedAsset as unknown as Asset
  }

  async listAssignments(organizationId: string, id: string): Promise<AssetAssignment[]> {
    await this.requireAsset(organizationId, id)
    const assignments = await this.prisma.assetAssignment.findMany({ where: { assetId: id }, orderBy: { assignedAt: 'desc' } })
    return assignments as unknown as AssetAssignment[]
  }

  async createMaintenanceRecord(
    organizationId: string,
    userId: string,
    id: string,
    dto: CreateMaintenanceRecordDto,
  ): Promise<AssetMaintenanceRecord> {
    await this.requireAsset(organizationId, id)
    const record = await this.prisma.$transaction(async (tx) => {
      const created = await tx.assetMaintenanceRecord.create({
        data: {
          organizationId,
          assetId: id,
          type: dto.type,
          scheduledDate: dto.scheduledDate,
          description: dto.description,
          cost: dto.cost,
          performedBy: dto.performedBy,
          vendorId: dto.vendorId,
          status: dto.type === AssetMaintenanceType.BREAKDOWN ? AssetMaintenanceStatus.IN_PROGRESS : AssetMaintenanceStatus.SCHEDULED,
        },
      })
      if (dto.type === AssetMaintenanceType.BREAKDOWN) {
        await tx.asset.update({ where: { id }, data: { status: AssetStatus.BREAKDOWN } })
      } else {
        await tx.asset.update({ where: { id }, data: { status: AssetStatus.UNDER_MAINTENANCE } })
      }
      return created
    })
    this.eventEmitter.emit('asset_maintenance.created', {
      organizationId,
      userId,
      assetId: id,
      maintenanceRecordId: record.id,
      type: dto.type,
    })
    return record as unknown as AssetMaintenanceRecord
  }

  async completeMaintenanceRecord(
    organizationId: string,
    userId: string,
    assetId: string,
    recordId: string,
    dto: CompleteMaintenanceRecordDto,
  ): Promise<AssetMaintenanceRecord> {
    const asset = await this.requireAsset(organizationId, assetId)
    const record = await this.prisma.assetMaintenanceRecord.findFirst({ where: { id: recordId, assetId } })
    if (!record) throw new NotFoundException('Maintenance record not found')
    if (record.status === AssetMaintenanceStatus.COMPLETED || record.status === AssetMaintenanceStatus.CANCELLED) {
      throw new ConflictException(`Maintenance record is already ${record.status}`)
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const done = await tx.assetMaintenanceRecord.update({
        where: { id: recordId },
        data: { status: AssetMaintenanceStatus.COMPLETED, completedDate: new Date(), cost: dto.cost, performedBy: dto.performedBy },
      })
      const data: Prisma.AssetUpdateInput = { status: AssetStatus.IN_STORE }
      if (record.type === AssetMaintenanceType.CALIBRATION) {
        data.lastCalibrationDate = new Date()
      }
      if (asset.assignedToUserId || asset.assignedToDepartmentId) data.status = AssetStatus.IN_USE
      await tx.asset.update({ where: { id: assetId }, data })
      return done
    })
    this.eventEmitter.emit('asset_maintenance.completed', {
      organizationId,
      userId,
      assetId,
      maintenanceRecordId: recordId,
    })
    return updated as unknown as AssetMaintenanceRecord
  }

  async listMaintenanceRecords(organizationId: string, id: string): Promise<AssetMaintenanceRecord[]> {
    await this.requireAsset(organizationId, id)
    const records = await this.prisma.assetMaintenanceRecord.findMany({ where: { assetId: id }, orderBy: { createdAt: 'desc' } })
    return records as unknown as AssetMaintenanceRecord[]
  }

  async countDueForMaintenance(organizationId: string, withinDays = 30): Promise<number> {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + withinDays)
    return this.prisma.assetMaintenanceRecord.count({
      where: {
        organizationId,
        status: AssetMaintenanceStatus.SCHEDULED,
        scheduledDate: { lte: cutoff },
      },
    })
  }

  async countInBreakdown(organizationId: string): Promise<number> {
    return this.prisma.asset.count({ where: { organizationId, status: AssetStatus.BREAKDOWN } })
  }

  private async requireAsset(organizationId: string, id: string) {
    const asset = await this.prisma.asset.findFirst({ where: { id, organizationId }, include: ASSET_INCLUDE })
    if (!asset) throw new NotFoundException('Asset not found')
    return asset
  }

  private rethrowUniqueCode(error: unknown): never {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      throw new ConflictException('An asset with that tag already exists')
    }
    throw error
  }
}
