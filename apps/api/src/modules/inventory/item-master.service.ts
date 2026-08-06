import {
  CreateInventoryBrandDto,
  CreateInventoryCategoryDto,
  CreateInventoryItemGroupDto,
  CreateInventoryManufacturerDto,
  CreateInventoryUnitDto,
  InventoryBrand,
  InventoryCategory,
  InventoryItemGroup,
  InventoryManufacturer,
  InventoryUnit,
  UpdateInventoryBrandDto,
  UpdateInventoryCategoryDto,
  UpdateInventoryItemGroupDto,
  UpdateInventoryManufacturerDto,
  UpdateInventoryUnitDto,
} from '@medicore/types'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'

/**
 * The item master's five lookup tables (Category, Item Group, Unit,
 * Manufacturer, Brand) are structurally similar CRUD surfaces - grouped
 * into one service rather than five near-duplicate files, mirroring how
 * `RESOURCE_ACTIONS` treats them as one `inventory.items` permission
 * surface (Milestone 13 / ADR-0020).
 */
@Injectable()
export class ItemMasterService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Categories (self-referential hierarchy) ──────────────────────────────

  async listCategories(organizationId: string, isActive?: boolean): Promise<InventoryCategory[]> {
    const categories = await this.prisma.inventoryCategory.findMany({
      where: { organizationId, ...(isActive === undefined ? {} : { isActive }) },
      orderBy: { name: 'asc' },
    })
    return categories.map((c) => this.toCategoryResponse(c))
  }

  async createCategory(organizationId: string, dto: CreateInventoryCategoryDto): Promise<InventoryCategory> {
    if (dto.parentId) await this.requireCategory(organizationId, dto.parentId)
    const category = await this.prisma.inventoryCategory
      .create({ data: { organizationId, ...dto } })
      .catch((e) => this.rethrowUniqueCode(e, 'category'))
    return this.toCategoryResponse(category)
  }

  async updateCategory(
    organizationId: string,
    id: string,
    dto: UpdateInventoryCategoryDto,
  ): Promise<InventoryCategory> {
    await this.requireCategory(organizationId, id)
    if (dto.parentId) {
      if (dto.parentId === id) throw new ConflictException('A category cannot be its own parent')
      await this.requireCategory(organizationId, dto.parentId)
    }
    const category = await this.prisma.inventoryCategory
      .update({ where: { id }, data: dto })
      .catch((e) => this.rethrowUniqueCode(e, 'category'))
    return this.toCategoryResponse(category)
  }

  private async requireCategory(organizationId: string, id: string) {
    const category = await this.prisma.inventoryCategory.findFirst({ where: { id, organizationId } })
    if (!category) throw new NotFoundException('Category not found')
    return category
  }

  private toCategoryResponse(c: {
    id: string
    organizationId: string
    parentId: string | null
    name: string
    code: string
    description: string | null
    isActive: boolean
    createdAt: Date
    updatedAt: Date
  }): InventoryCategory {
    return c
  }

  // ── Item Groups ───────────────────────────────────────────────────────────

  async listItemGroups(organizationId: string, isActive?: boolean): Promise<InventoryItemGroup[]> {
    return this.prisma.inventoryItemGroup.findMany({
      where: { organizationId, ...(isActive === undefined ? {} : { isActive }) },
      orderBy: { name: 'asc' },
    })
  }

  async createItemGroup(organizationId: string, dto: CreateInventoryItemGroupDto): Promise<InventoryItemGroup> {
    return this.prisma.inventoryItemGroup
      .create({ data: { organizationId, ...dto } })
      .catch((e) => this.rethrowUniqueCode(e, 'item group'))
  }

  async updateItemGroup(
    organizationId: string,
    id: string,
    dto: UpdateInventoryItemGroupDto,
  ): Promise<InventoryItemGroup> {
    const existing = await this.prisma.inventoryItemGroup.findFirst({ where: { id, organizationId } })
    if (!existing) throw new NotFoundException('Item group not found')
    return this.prisma.inventoryItemGroup
      .update({ where: { id }, data: dto })
      .catch((e) => this.rethrowUniqueCode(e, 'item group'))
  }

  // ── Units ─────────────────────────────────────────────────────────────────

  async listUnits(organizationId: string, isActive?: boolean): Promise<InventoryUnit[]> {
    return this.prisma.inventoryUnit.findMany({
      where: { organizationId, ...(isActive === undefined ? {} : { isActive }) },
      orderBy: { name: 'asc' },
    })
  }

  async createUnit(organizationId: string, dto: CreateInventoryUnitDto): Promise<InventoryUnit> {
    return this.prisma.inventoryUnit
      .create({ data: { organizationId, ...dto } })
      .catch((e) => this.rethrowUniqueCode(e, 'unit'))
  }

  async updateUnit(organizationId: string, id: string, dto: UpdateInventoryUnitDto): Promise<InventoryUnit> {
    const existing = await this.prisma.inventoryUnit.findFirst({ where: { id, organizationId } })
    if (!existing) throw new NotFoundException('Unit not found')
    return this.prisma.inventoryUnit
      .update({ where: { id }, data: dto })
      .catch((e) => this.rethrowUniqueCode(e, 'unit'))
  }

  // ── Manufacturers ─────────────────────────────────────────────────────────

  async listManufacturers(organizationId: string, isActive?: boolean): Promise<InventoryManufacturer[]> {
    return this.prisma.inventoryManufacturer.findMany({
      where: { organizationId, ...(isActive === undefined ? {} : { isActive }) },
      orderBy: { name: 'asc' },
    })
  }

  async createManufacturer(
    organizationId: string,
    dto: CreateInventoryManufacturerDto,
  ): Promise<InventoryManufacturer> {
    return this.prisma.inventoryManufacturer
      .create({ data: { organizationId, ...dto } })
      .catch((e) => this.rethrowUniqueCode(e, 'manufacturer'))
  }

  async updateManufacturer(
    organizationId: string,
    id: string,
    dto: UpdateInventoryManufacturerDto,
  ): Promise<InventoryManufacturer> {
    const existing = await this.prisma.inventoryManufacturer.findFirst({ where: { id, organizationId } })
    if (!existing) throw new NotFoundException('Manufacturer not found')
    return this.prisma.inventoryManufacturer
      .update({ where: { id }, data: dto })
      .catch((e) => this.rethrowUniqueCode(e, 'manufacturer'))
  }

  // ── Brands ────────────────────────────────────────────────────────────────

  async listBrands(organizationId: string, isActive?: boolean): Promise<InventoryBrand[]> {
    return this.prisma.inventoryBrand.findMany({
      where: { organizationId, ...(isActive === undefined ? {} : { isActive }) },
      orderBy: { name: 'asc' },
    })
  }

  async createBrand(organizationId: string, dto: CreateInventoryBrandDto): Promise<InventoryBrand> {
    if (dto.manufacturerId) {
      const manufacturer = await this.prisma.inventoryManufacturer.findFirst({
        where: { id: dto.manufacturerId, organizationId },
      })
      if (!manufacturer) throw new NotFoundException('Manufacturer not found')
    }
    return this.prisma.inventoryBrand
      .create({ data: { organizationId, ...dto } })
      .catch((e) => this.rethrowUniqueCode(e, 'brand'))
  }

  async updateBrand(organizationId: string, id: string, dto: UpdateInventoryBrandDto): Promise<InventoryBrand> {
    const existing = await this.prisma.inventoryBrand.findFirst({ where: { id, organizationId } })
    if (!existing) throw new NotFoundException('Brand not found')
    return this.prisma.inventoryBrand
      .update({ where: { id }, data: dto })
      .catch((e) => this.rethrowUniqueCode(e, 'brand'))
  }

  private rethrowUniqueCode(error: unknown, entity: string): never {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      throw new ConflictException(`A ${entity} with that code already exists`)
    }
    throw error
  }
}
