import { CreateVendorDto, RateVendorDto, UpdateVendorDto, Vendor, VendorQuery, VendorRating, VendorWithStats } from '@medicore/types'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, Vendor as PrismaVendor, VendorInvoiceStatus } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class VendorsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, query: VendorQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20
    const where: Prisma.VendorWhereInput = { organizationId }
    if (query.isActive !== undefined) where.isActive = query.isActive
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
        { gstin: { contains: query.search, mode: 'insensitive' } },
      ]
    }
    const sortBy = query.sortBy ?? 'name'
    const sortOrder = query.sortOrder ?? 'asc'

    const [vendors, total] = await Promise.all([
      this.prisma.vendor.findMany({ where, orderBy: { [sortBy]: sortOrder }, skip: (page - 1) * limit, take: limit }),
      this.prisma.vendor.count({ where }),
    ])
    const data = await Promise.all(vendors.map((v) => this.withStats(v)))
    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrev: page > 1 },
    }
  }

  async getById(organizationId: string, id: string): Promise<VendorWithStats> {
    const vendor = await this.requireVendor(organizationId, id)
    return this.withStats(vendor)
  }

  async create(organizationId: string, dto: CreateVendorDto): Promise<Vendor> {
    return this.prisma.vendor.create({ data: { organizationId, ...dto } }).catch((e) => this.rethrowUniqueCode(e))
  }

  async update(organizationId: string, id: string, dto: UpdateVendorDto): Promise<Vendor> {
    await this.requireVendor(organizationId, id)
    return this.prisma.vendor.update({ where: { id }, data: dto }).catch((e) => this.rethrowUniqueCode(e))
  }

  async purchaseHistory(organizationId: string, id: string) {
    await this.requireVendor(organizationId, id)
    return this.prisma.purchaseOrder.findMany({
      where: { organizationId, vendorId: id },
      include: { items: true, store: { select: { id: true, name: true, code: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async rate(organizationId: string, id: string, ratedByUserId: string, dto: RateVendorDto): Promise<VendorRating> {
    await this.requireVendor(organizationId, id)
    return this.prisma.vendorRating.create({
      data: { organizationId, vendorId: id, rating: dto.rating, comments: dto.comments, ratedByUserId },
    })
  }

  async listRatings(organizationId: string, id: string): Promise<VendorRating[]> {
    await this.requireVendor(organizationId, id)
    return this.prisma.vendorRating.findMany({ where: { vendorId: id }, orderBy: { ratedAt: 'desc' } })
  }

  /** Used by procurement services to resolve/validate a vendor reference. */
  async requireVendor(organizationId: string, id: string): Promise<PrismaVendor> {
    const vendor = await this.prisma.vendor.findFirst({ where: { id, organizationId } })
    if (!vendor) throw new NotFoundException('Vendor not found')
    return vendor
  }

  private async withStats(vendor: PrismaVendor): Promise<VendorWithStats> {
    const [ratingAgg, totalPurchaseOrders, unpaidInvoices] = await Promise.all([
      this.prisma.vendorRating.aggregate({ where: { vendorId: vendor.id }, _avg: { rating: true }, _count: true }),
      this.prisma.purchaseOrder.count({ where: { vendorId: vendor.id } }),
      this.prisma.vendorInvoice.findMany({
        where: { vendorId: vendor.id, status: { not: VendorInvoiceStatus.CANCELLED } },
        select: { totalAmount: true, paidAmount: true },
      }),
    ])
    const outstandingBalance = unpaidInvoices.reduce((sum, inv) => sum + (Number(inv.totalAmount) - Number(inv.paidAmount)), 0)

    return {
      ...vendor,
      paymentTermsDays: vendor.paymentTermsDays,
      averageRating: ratingAgg._avg.rating,
      totalRatings: ratingAgg._count,
      totalPurchaseOrders,
      outstandingBalance: outstandingBalance.toFixed(2),
    }
  }

  private rethrowUniqueCode(error: unknown): never {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      throw new ConflictException('A vendor with that code already exists')
    }
    throw error
  }
}
