import { AdjustDrugStockDto, CreateDrugDto, Drug, DrugQuery, UpdateDrugDto } from '@medicore/types'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Drug as PrismaDrug, Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

/**
 * Drug Catalog - see ADR-0014. One row is one batch of a drug; restocking
 * the same generic/brand drug with a new batch creates a new row rather
 * than a join to a separate batch table.
 */
@Injectable()
export class DrugCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, query: DrugQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20

    const where: Prisma.DrugWhereInput = { organizationId }
    if (query.isActive !== undefined) where.isActive = query.isActive
    if (query.search) {
      where.OR = [
        { genericName: { contains: query.search, mode: 'insensitive' } },
        { brandName: { contains: query.search, mode: 'insensitive' } },
        { batchNumber: { contains: query.search, mode: 'insensitive' } },
      ]
    }
    if (query.expiringWithinDays !== undefined) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() + query.expiringWithinDays)
      where.expiryDate = { lte: cutoff }
    }

    const sortBy = query.sortBy ?? 'genericName'
    const sortOrder = query.sortOrder ?? 'asc'

    // `lowStockOnly` compares two columns on the same row (`currentStock` vs.
    // `reorderLevel`), which Prisma's query builder can't express in `where`
    // - filtered in application code instead of a raw query, a pragmatic
    // simplification given a single org's drug catalog is not large enough
    // for this to be a real pagination cost (see TECH_DEBT).
    if (query.lowStockOnly) {
      const all = await this.prisma.drug.findMany({ where, orderBy: { [sortBy]: sortOrder } })
      const filtered = all.filter((d) => d.currentStock <= d.reorderLevel)
      const total = filtered.length
      const data = filtered.slice((page - 1) * limit, (page - 1) * limit + limit)
      return {
        data: data.map((d) => this.toResponse(d)),
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

    const [data, total] = await Promise.all([
      this.prisma.drug.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.drug.count({ where }),
    ])

    return {
      data: data.map((d) => this.toResponse(d)),
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

  async getById(organizationId: string, id: string): Promise<Drug> {
    const drug = await this.requireDrug(organizationId, id)
    return this.toResponse(drug)
  }

  async create(organizationId: string, dto: CreateDrugDto): Promise<Drug> {
    const drug = await this.prisma.drug.create({
      data: {
        organizationId,
        genericName: dto.genericName,
        brandName: dto.brandName,
        strength: dto.strength,
        dosageForm: dto.dosageForm,
        manufacturer: dto.manufacturer,
        batchNumber: dto.batchNumber,
        expiryDate: dto.expiryDate,
        price: dto.price,
        taxPercent: dto.taxPercent,
        currentStock: dto.currentStock,
        minStockLevel: dto.minStockLevel,
        reorderLevel: dto.reorderLevel,
      },
    })
    return this.toResponse(drug)
  }

  async update(organizationId: string, id: string, dto: UpdateDrugDto): Promise<Drug> {
    await this.requireDrug(organizationId, id)
    const drug = await this.prisma.drug.update({ where: { id }, data: dto })
    return this.toResponse(drug)
  }

  /** Manual stock correction (new delivery, wastage, damage, count adjustment) - see roadmap's "Adjust stock." */
  async adjustStock(organizationId: string, id: string, dto: AdjustDrugStockDto): Promise<Drug> {
    const drug = await this.requireDrug(organizationId, id)
    const nextStock = drug.currentStock + dto.quantity
    if (nextStock < drug.reservedStock) {
      throw new BadRequestException(
        `Adjustment would leave stock (${nextStock}) below the ${drug.reservedStock} unit(s) already reserved`,
      )
    }

    const updated = await this.prisma.drug.update({ where: { id }, data: { currentStock: nextStock } })
    return this.toResponse(updated)
  }

  /** Used by `DispenseService` to resolve/validate a batch selection. */
  async requireDrug(organizationId: string, id: string): Promise<PrismaDrug> {
    const drug = await this.prisma.drug.findFirst({ where: { id, organizationId } })
    if (!drug) throw new NotFoundException('Drug not found')
    return drug
  }

  async countLowStock(organizationId: string): Promise<number> {
    const drugs = await this.prisma.drug.findMany({
      where: { organizationId, isActive: true },
      select: { currentStock: true, reorderLevel: true },
    })
    return drugs.filter((d) => d.currentStock <= d.reorderLevel).length
  }

  async countExpiringSoon(organizationId: string, withinDays = 30): Promise<number> {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + withinDays)
    return this.prisma.drug.count({ where: { organizationId, isActive: true, expiryDate: { lte: cutoff } } })
  }

  private toResponse(drug: PrismaDrug): Drug {
    return {
      id: drug.id,
      organizationId: drug.organizationId,
      genericName: drug.genericName,
      brandName: drug.brandName,
      strength: drug.strength,
      dosageForm: drug.dosageForm,
      manufacturer: drug.manufacturer,
      batchNumber: drug.batchNumber,
      expiryDate: drug.expiryDate,
      price: drug.price.toString(),
      taxPercent: drug.taxPercent.toString(),
      isActive: drug.isActive,
      currentStock: drug.currentStock,
      reservedStock: drug.reservedStock,
      availableStock: drug.currentStock - drug.reservedStock,
      minStockLevel: drug.minStockLevel,
      reorderLevel: drug.reorderLevel,
      createdAt: drug.createdAt,
      updatedAt: drug.updatedAt,
    }
  }
}
