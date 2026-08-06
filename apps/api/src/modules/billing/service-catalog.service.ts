import {
  CreateServiceCatalogItemDto,
  ServiceCatalogItem,
  ServiceCatalogItemQuery,
  UpdateServiceCatalogItemDto,
} from '@medicore/types'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, ServiceCatalogItem as PrismaServiceCatalogItem } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

/**
 * Configurable service/pricing catalog - see ADR-0015. Not own-scoped: a
 * catalog item has no owning doctor, mirroring `LabTestCatalogItem`/
 * `RadiologyCatalogItem`'s catalog routes.
 */
@Injectable()
export class ServiceCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, query: ServiceCatalogItemQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20

    const where: Prisma.ServiceCatalogItemWhereInput = { organizationId }
    if (query.isActive !== undefined) where.isActive = query.isActive
    if (query.category) where.category = query.category
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ]
    }

    const sortBy = query.sortBy ?? 'name'
    const sortOrder = query.sortOrder ?? 'asc'

    const [data, total] = await Promise.all([
      this.prisma.serviceCatalogItem.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.serviceCatalogItem.count({ where }),
    ])

    return {
      data: data.map((item) => this.toResponse(item)),
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

  async getById(organizationId: string, id: string): Promise<ServiceCatalogItem> {
    return this.toResponse(await this.requireItem(organizationId, id))
  }

  async create(organizationId: string, dto: CreateServiceCatalogItemDto): Promise<ServiceCatalogItem> {
    const existing = await this.prisma.serviceCatalogItem.findUnique({
      where: { organizationId_code: { organizationId, code: dto.code } },
    })
    if (existing) throw new ConflictException(`A catalog item with code "${dto.code}" already exists`)

    const item = await this.prisma.serviceCatalogItem.create({
      data: {
        organizationId,
        code: dto.code,
        name: dto.name,
        category: dto.category,
        price: dto.price,
        taxPercent: dto.taxPercent,
      },
    })
    return this.toResponse(item)
  }

  async update(organizationId: string, id: string, dto: UpdateServiceCatalogItemDto): Promise<ServiceCatalogItem> {
    await this.requireItem(organizationId, id)
    const item = await this.prisma.serviceCatalogItem.update({ where: { id }, data: dto })
    return this.toResponse(item)
  }

  async requireItem(organizationId: string, id: string): Promise<PrismaServiceCatalogItem> {
    const item = await this.prisma.serviceCatalogItem.findFirst({ where: { id, organizationId } })
    if (!item) throw new NotFoundException('Service catalog item not found')
    return item
  }

  private toResponse(item: PrismaServiceCatalogItem): ServiceCatalogItem {
    return {
      id: item.id,
      organizationId: item.organizationId,
      code: item.code,
      name: item.name,
      category: item.category,
      price: item.price.toString(),
      taxPercent: item.taxPercent.toString(),
      isActive: item.isActive,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }
  }
}
