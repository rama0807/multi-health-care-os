import {
  CreateInsuranceProviderDto,
  InsuranceProvider,
  InsuranceProviderQuery,
  UpdateInsuranceProviderDto,
} from '@medicore/types'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InsuranceProvider as PrismaInsuranceProvider, Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

/** Insurance Company / TPA / Corporate Plan issuer - see ADR-0016. Not own-scoped: no owning doctor. */
@Injectable()
export class InsuranceProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, query: InsuranceProviderQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20

    const where: Prisma.InsuranceProviderWhereInput = { organizationId }
    if (query.type) where.type = query.type as unknown as Prisma.InsuranceProviderWhereInput['type']
    if (query.isActive !== undefined) where.isActive = query.isActive
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ]
    }

    const [data, total] = await Promise.all([
      this.prisma.insuranceProvider.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.insuranceProvider.count({ where }),
    ])

    return {
      data: data.map((p) => this.toResponse(p)),
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

  async getById(organizationId: string, id: string): Promise<InsuranceProvider> {
    return this.toResponse(await this.requireProvider(organizationId, id))
  }

  async create(organizationId: string, dto: CreateInsuranceProviderDto): Promise<InsuranceProvider> {
    const existing = await this.prisma.insuranceProvider.findUnique({
      where: { organizationId_code: { organizationId, code: dto.code } },
    })
    if (existing) throw new ConflictException(`A provider with code "${dto.code}" already exists`)

    const provider = await this.prisma.insuranceProvider.create({
      data: {
        organizationId,
        name: dto.name,
        code: dto.code,
        type: dto.type,
        contactPerson: dto.contactPerson,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
      },
    })
    return this.toResponse(provider)
  }

  async update(organizationId: string, id: string, dto: UpdateInsuranceProviderDto): Promise<InsuranceProvider> {
    await this.requireProvider(organizationId, id)
    const provider = await this.prisma.insuranceProvider.update({ where: { id }, data: dto })
    return this.toResponse(provider)
  }

  async requireProvider(organizationId: string, id: string): Promise<PrismaInsuranceProvider> {
    const provider = await this.prisma.insuranceProvider.findFirst({ where: { id, organizationId } })
    if (!provider) throw new NotFoundException('Insurance provider not found')
    return provider
  }

  private toResponse(provider: PrismaInsuranceProvider): InsuranceProvider {
    return {
      id: provider.id,
      organizationId: provider.organizationId,
      name: provider.name,
      code: provider.code,
      type: provider.type as unknown as InsuranceProvider['type'],
      contactPerson: provider.contactPerson,
      email: provider.email,
      phone: provider.phone,
      address: provider.address,
      isActive: provider.isActive,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    }
  }
}
