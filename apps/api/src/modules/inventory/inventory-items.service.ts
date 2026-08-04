import {
  CreateInventoryItemDto,
  InventoryItemQuery,
  InventoryItemType,
  InventoryItemWithRefs,
  UpdateInventoryItemDto,
} from '@medicore/types'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InventoryItem as PrismaInventoryItem, Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

type ItemWithRefs = PrismaInventoryItem & {
  category: { id: string; name: string } | null
  itemGroup: { id: string; name: string } | null
  unit: { id: string; name: string; symbol: string } | null
  manufacturer: { id: string; name: string } | null
  brand: { id: string; name: string } | null
}

const ITEM_INCLUDE = {
  category: { select: { id: true, name: true } },
  itemGroup: { select: { id: true, name: true } },
  unit: { select: { id: true, name: true, symbol: true } },
  manufacturer: { select: { id: true, name: true } },
  brand: { select: { id: true, name: true } },
} satisfies Prisma.InventoryItemInclude

@Injectable()
export class InventoryItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, query: InventoryItemQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20

    const where: Prisma.InventoryItemWhereInput = { organizationId }
    if (query.categoryId) where.categoryId = query.categoryId
    if (query.itemGroupId) where.itemGroupId = query.itemGroupId
    if (query.itemType) where.itemType = query.itemType
    if (query.isActive !== undefined) where.isActive = query.isActive
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
        { barcodeValue: { contains: query.search, mode: 'insensitive' } },
      ]
    }

    const sortBy = query.sortBy ?? 'name'
    const sortOrder = query.sortOrder ?? 'asc'

    const [data, total] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where,
        include: ITEM_INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.inventoryItem.count({ where }),
    ])

    return {
      data: data.map((i) => this.toResponse(i)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    }
  }

  async getById(organizationId: string, id: string): Promise<InventoryItemWithRefs> {
    await this.requireItem(organizationId, id)
    const item = await this.prisma.inventoryItem.findFirstOrThrow({ where: { id, organizationId }, include: ITEM_INCLUDE })
    return this.toResponse(item)
  }

  async create(organizationId: string, dto: CreateInventoryItemDto): Promise<InventoryItemWithRefs> {
    await this.validateRefs(organizationId, dto)
    const item = await this.prisma.inventoryItem
      .create({ data: { organizationId, ...dto }, include: ITEM_INCLUDE })
      .catch((e) => this.rethrowUniqueCode(e))
    return this.toResponse(item)
  }

  async update(organizationId: string, id: string, dto: UpdateInventoryItemDto): Promise<InventoryItemWithRefs> {
    await this.requireItem(organizationId, id)
    await this.validateRefs(organizationId, dto)
    const item = await this.prisma.inventoryItem
      .update({ where: { id }, data: dto, include: ITEM_INCLUDE })
      .catch((e) => this.rethrowUniqueCode(e))
    return this.toResponse(item)
  }

  /** Used by other inventory services (stock/procurement/assets) to resolve/validate an item reference. */
  async requireItem(organizationId: string, id: string): Promise<PrismaInventoryItem> {
    const item = await this.prisma.inventoryItem.findFirst({ where: { id, organizationId } })
    if (!item) throw new NotFoundException('Inventory item not found')
    return item
  }

  private async validateRefs(
    organizationId: string,
    dto: Pick<CreateInventoryItemDto, 'categoryId' | 'itemGroupId' | 'unitId' | 'manufacturerId' | 'brandId'>,
  ) {
    const checks: Array<[keyof typeof dto, () => Promise<unknown>]> = [
      ['categoryId', () => this.prisma.inventoryCategory.findFirst({ where: { id: dto.categoryId, organizationId } })],
      [
        'itemGroupId',
        () => this.prisma.inventoryItemGroup.findFirst({ where: { id: dto.itemGroupId, organizationId } }),
      ],
      ['unitId', () => this.prisma.inventoryUnit.findFirst({ where: { id: dto.unitId, organizationId } })],
      [
        'manufacturerId',
        () => this.prisma.inventoryManufacturer.findFirst({ where: { id: dto.manufacturerId, organizationId } }),
      ],
      ['brandId', () => this.prisma.inventoryBrand.findFirst({ where: { id: dto.brandId, organizationId } })],
    ]
    for (const [field, check] of checks) {
      if (!dto[field]) continue
      const found = await check()
      if (!found) throw new NotFoundException(`Referenced ${field.replace('Id', '')} not found`)
    }
  }

  private rethrowUniqueCode(error: unknown): never {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      throw new ConflictException('An item with that code already exists')
    }
    throw error
  }

  private toResponse(item: ItemWithRefs): InventoryItemWithRefs {
    return {
      id: item.id,
      organizationId: item.organizationId,
      categoryId: item.categoryId,
      itemGroupId: item.itemGroupId,
      unitId: item.unitId,
      manufacturerId: item.manufacturerId,
      brandId: item.brandId,
      name: item.name,
      code: item.code,
      description: item.description,
      itemType: item.itemType as unknown as InventoryItemType,
      hsnCode: item.hsnCode,
      gstPercent: item.gstPercent.toString(),
      barcodeValue: item.barcodeValue,
      qrCodeValue: item.qrCodeValue,
      trackBatch: item.trackBatch,
      trackSerial: item.trackSerial,
      trackExpiry: item.trackExpiry,
      unitCost: item.unitCost.toString(),
      isActive: item.isActive,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      category: item.category,
      itemGroup: item.itemGroup,
      unit: item.unit,
      manufacturer: item.manufacturer,
      brand: item.brand,
    }
  }
}
