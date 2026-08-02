import {
  CreateLabCatalogItemDto,
  LabTestCatalogItem,
  LabTestCatalogQuery,
  UpdateLabCatalogItemDto,
} from '@medicore/types'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { LabTestCatalogItem as PrismaLabTestCatalogItem, Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class LabCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, query: LabTestCatalogQuery): Promise<LabTestCatalogItem[]> {
    const where: Prisma.LabTestCatalogItemWhereInput = { organizationId }
    if (query.category) where.category = query.category
    if (query.isActive !== undefined) where.isActive = query.isActive
    if (query.search) {
      where.OR = [
        { testName: { contains: query.search, mode: 'insensitive' } },
        { testCode: { contains: query.search, mode: 'insensitive' } },
      ]
    }

    const items = await this.prisma.labTestCatalogItem.findMany({
      where,
      orderBy: [{ category: 'asc' }, { testName: 'asc' }],
    })
    return items.map((i) => this.toResponse(i))
  }

  async getById(organizationId: string, id: string): Promise<LabTestCatalogItem> {
    const item = await this.requireCatalogItem(organizationId, id)
    return this.toResponse(item)
  }

  async create(organizationId: string, dto: CreateLabCatalogItemDto): Promise<LabTestCatalogItem> {
    const existing = await this.prisma.labTestCatalogItem.findUnique({
      where: { organizationId_testCode: { organizationId, testCode: dto.testCode } },
    })
    if (existing) throw new ConflictException(`A catalog item with test code "${dto.testCode}" already exists`)

    const item = await this.prisma.labTestCatalogItem.create({
      data: {
        organizationId,
        testCode: dto.testCode,
        testName: dto.testName,
        category: dto.category,
        unit: dto.unit,
        referenceRangeLow: dto.referenceRangeLow,
        referenceRangeHigh: dto.referenceRangeHigh,
        referenceRangeText: dto.referenceRangeText,
        criticalLow: dto.criticalLow,
        criticalHigh: dto.criticalHigh,
      },
    })
    return this.toResponse(item)
  }

  async update(organizationId: string, id: string, dto: UpdateLabCatalogItemDto): Promise<LabTestCatalogItem> {
    await this.requireCatalogItem(organizationId, id)
    const item = await this.prisma.labTestCatalogItem.update({
      where: { id },
      data: dto,
    })
    return this.toResponse(item)
  }

  /** Used by `LabTestsService` to auto-populate an order item from the catalog. */
  async requireCatalogItem(organizationId: string, id: string): Promise<PrismaLabTestCatalogItem> {
    const item = await this.prisma.labTestCatalogItem.findFirst({ where: { id, organizationId } })
    if (!item) throw new NotFoundException('Catalog item not found')
    return item
  }

  private toResponse(item: PrismaLabTestCatalogItem): LabTestCatalogItem {
    return {
      id: item.id,
      organizationId: item.organizationId,
      testCode: item.testCode,
      testName: item.testName,
      category: item.category,
      unit: item.unit,
      referenceRangeLow: item.referenceRangeLow,
      referenceRangeHigh: item.referenceRangeHigh,
      referenceRangeText: item.referenceRangeText,
      criticalLow: item.criticalLow,
      criticalHigh: item.criticalHigh,
      isActive: item.isActive,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }
  }
}
