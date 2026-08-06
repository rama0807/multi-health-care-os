import { CreateInsurancePlanDto, InsurancePlanQuery, InsurancePlanWithProvider, UpdateInsurancePlanDto } from '@medicore/types'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InsurancePlan as PrismaInsurancePlan, Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { InsuranceProvidersService } from './insurance-providers.service'

type InsurancePlanWithRelations = PrismaInsurancePlan & { provider: { id: string; name: string; code: string } }

const PLAN_WITH_PROVIDER_INCLUDE = {
  provider: { select: { id: true, name: true, code: true } },
} satisfies Prisma.InsurancePlanInclude

/** A provider's coverage plan - see ADR-0016. Not own-scoped: no owning doctor. */
@Injectable()
export class InsurancePlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providersService: InsuranceProvidersService,
  ) {}

  async list(organizationId: string, query: InsurancePlanQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20

    const where: Prisma.InsurancePlanWhereInput = { organizationId }
    if (query.providerId) where.providerId = query.providerId
    if (query.networkType) where.networkType = query.networkType as unknown as Prisma.InsurancePlanWhereInput['networkType']
    if (query.isActive !== undefined) where.isActive = query.isActive

    const [data, total] = await Promise.all([
      this.prisma.insurancePlan.findMany({
        where,
        include: PLAN_WITH_PROVIDER_INCLUDE,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.insurancePlan.count({ where }),
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

  async getById(organizationId: string, id: string): Promise<InsurancePlanWithProvider> {
    return this.toResponse(await this.requirePlanWithProvider(organizationId, id))
  }

  async create(organizationId: string, dto: CreateInsurancePlanDto): Promise<InsurancePlanWithProvider> {
    await this.providersService.requireProvider(organizationId, dto.providerId)

    const existing = await this.prisma.insurancePlan.findUnique({
      where: { organizationId_providerId_code: { organizationId, providerId: dto.providerId, code: dto.code } },
    })
    if (existing) throw new ConflictException(`A plan with code "${dto.code}" already exists for this provider`)

    const plan = await this.prisma.insurancePlan.create({
      data: {
        organizationId,
        providerId: dto.providerId,
        name: dto.name,
        code: dto.code,
        coveragePercent: dto.coveragePercent,
        coPayPercent: dto.coPayPercent,
        deductible: dto.deductible,
        annualLimit: dto.annualLimit,
        perVisitLimit: dto.perVisitLimit,
        networkType: dto.networkType,
      },
      include: PLAN_WITH_PROVIDER_INCLUDE,
    })
    return this.toResponse(plan)
  }

  async update(organizationId: string, id: string, dto: UpdateInsurancePlanDto): Promise<InsurancePlanWithProvider> {
    await this.requirePlanWithProvider(organizationId, id)
    const plan = await this.prisma.insurancePlan.update({
      where: { id },
      data: dto,
      include: PLAN_WITH_PROVIDER_INCLUDE,
    })
    return this.toResponse(plan)
  }

  async requirePlan(organizationId: string, id: string): Promise<PrismaInsurancePlan> {
    const plan = await this.prisma.insurancePlan.findFirst({ where: { id, organizationId } })
    if (!plan) throw new NotFoundException('Insurance plan not found')
    return plan
  }

  private async requirePlanWithProvider(organizationId: string, id: string): Promise<InsurancePlanWithRelations> {
    const plan = await this.prisma.insurancePlan.findFirst({
      where: { id, organizationId },
      include: PLAN_WITH_PROVIDER_INCLUDE,
    })
    if (!plan) throw new NotFoundException('Insurance plan not found')
    return plan as InsurancePlanWithRelations
  }

  private toResponse(plan: InsurancePlanWithRelations): InsurancePlanWithProvider {
    return {
      id: plan.id,
      organizationId: plan.organizationId,
      providerId: plan.providerId,
      name: plan.name,
      code: plan.code,
      coveragePercent: plan.coveragePercent.toString(),
      coPayPercent: plan.coPayPercent.toString(),
      deductible: plan.deductible.toString(),
      annualLimit: plan.annualLimit?.toString() ?? null,
      perVisitLimit: plan.perVisitLimit?.toString() ?? null,
      networkType: plan.networkType as unknown as InsurancePlanWithProvider['networkType'],
      isActive: plan.isActive,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
      provider: plan.provider,
    }
  }
}
