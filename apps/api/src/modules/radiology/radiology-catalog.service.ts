import {
  CreateRadiologyCatalogItemDto,
  RadiologyCatalogItem,
  RadiologyCatalogQuery,
  UpdateRadiologyCatalogItemDto,
} from '@medicore/types'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { RadiologyCatalogItem as PrismaRadiologyCatalogItem, Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class RadiologyCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, query: RadiologyCatalogQuery): Promise<RadiologyCatalogItem[]> {
    const where: Prisma.RadiologyCatalogItemWhereInput = { organizationId }
    if (query.category) where.category = query.category
    if (query.modality) where.modality = query.modality
    if (query.isActive !== undefined) where.isActive = query.isActive
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ]
    }

    const items = await this.prisma.radiologyCatalogItem.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    })
    return items.map((i) => this.toResponse(i))
  }

  async getById(organizationId: string, id: string): Promise<RadiologyCatalogItem> {
    const item = await this.requireCatalogItem(organizationId, id)
    return this.toResponse(item)
  }

  async create(organizationId: string, dto: CreateRadiologyCatalogItemDto): Promise<RadiologyCatalogItem> {
    const existing = await this.prisma.radiologyCatalogItem.findUnique({
      where: { organizationId_code: { organizationId, code: dto.code } },
    })
    if (existing) throw new ConflictException(`A catalog item with code "${dto.code}" already exists`)

    const item = await this.prisma.radiologyCatalogItem.create({
      data: {
        organizationId,
        code: dto.code,
        name: dto.name,
        category: dto.category,
        modality: dto.modality,
        bodyPart: dto.bodyPart,
        contrastRequired: dto.contrastRequired,
        price: dto.price,
        estimatedDurationMinutes: dto.estimatedDurationMinutes,
      },
    })
    return this.toResponse(item)
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateRadiologyCatalogItemDto,
  ): Promise<RadiologyCatalogItem> {
    await this.requireCatalogItem(organizationId, id)
    const item = await this.prisma.radiologyCatalogItem.update({ where: { id }, data: dto })
    return this.toResponse(item)
  }

  /** Used by `RadiologyOrdersService` to auto-populate an order from the catalog. */
  async requireCatalogItem(organizationId: string, id: string): Promise<PrismaRadiologyCatalogItem> {
    const item = await this.prisma.radiologyCatalogItem.findFirst({ where: { id, organizationId } })
    if (!item) throw new NotFoundException('Catalog item not found')
    return item
  }

  private toResponse(item: PrismaRadiologyCatalogItem): RadiologyCatalogItem {
    return {
      id: item.id,
      organizationId: item.organizationId,
      code: item.code,
      name: item.name,
      category: item.category,
      modality: item.modality,
      bodyPart: item.bodyPart,
      contrastRequired: item.contrastRequired,
      price: item.price.toString(),
      estimatedDurationMinutes: item.estimatedDurationMinutes,
      isActive: item.isActive,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }
  }
}
