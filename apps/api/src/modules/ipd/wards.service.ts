import { CreateWardDto, UpdateWardDto, Ward, WardQuery, WardStatus, WardWithCounts } from '@medicore/types'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Ward as PrismaWard, Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

/** Ward inventory CRUD — see ADR-0018. Not own-scoped: ward inventory isn't tied to a doctor. */
@Injectable()
export class WardsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, query: WardQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20

    const where: Prisma.WardWhereInput = { organizationId }
    if (query.type) where.type = query.type as unknown as Prisma.WardWhereInput['type']
    if (query.status) where.status = query.status as unknown as Prisma.WardWhereInput['status']
    if (query.departmentId) where.departmentId = query.departmentId
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ]
    }

    const [wards, total] = await Promise.all([
      this.prisma.ward.findMany({
        where,
        include: { department: { select: { id: true, name: true, code: true } }, rooms: true, beds: true },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.ward.count({ where }),
    ])

    return {
      data: wards.map((w) => this.toResponseWithCounts(w)),
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

  async getById(organizationId: string, id: string): Promise<WardWithCounts> {
    const ward = await this.prisma.ward.findFirst({
      where: { id, organizationId },
      include: { department: { select: { id: true, name: true, code: true } }, rooms: true, beds: true },
    })
    if (!ward) throw new NotFoundException('Ward not found')
    return this.toResponseWithCounts(ward)
  }

  async create(organizationId: string, dto: CreateWardDto): Promise<Ward> {
    const existing = await this.prisma.ward.findUnique({
      where: { code_organizationId: { code: dto.code, organizationId } },
    })
    if (existing) throw new ConflictException(`A ward with code "${dto.code}" already exists`)

    if (dto.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, organizationId },
      })
      if (!department) throw new NotFoundException('Department not found')
    }

    const ward = await this.prisma.ward.create({
      data: {
        organizationId,
        name: dto.name,
        code: dto.code,
        floor: dto.floor,
        block: dto.block,
        type: dto.type as unknown as Prisma.WardCreateInput['type'],
        departmentId: dto.departmentId,
      },
    })
    return this.toResponse(ward)
  }

  async update(organizationId: string, id: string, dto: UpdateWardDto): Promise<Ward> {
    const ward = await this.requireWard(organizationId, id)

    if (dto.code && dto.code !== ward.code) {
      const existing = await this.prisma.ward.findUnique({
        where: { code_organizationId: { code: dto.code, organizationId } },
      })
      if (existing) throw new ConflictException(`A ward with code "${dto.code}" already exists`)
    }
    if (dto.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, organizationId },
      })
      if (!department) throw new NotFoundException('Department not found')
    }

    const updated = await this.prisma.ward.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code,
        floor: dto.floor,
        block: dto.block,
        type: dto.type as unknown as Prisma.WardUpdateInput['type'],
        departmentId: dto.departmentId,
        status: dto.status as unknown as Prisma.WardUpdateInput['status'],
      },
    })
    return this.toResponse(updated)
  }

  /** Soft-deactivate (mirrors `DoctorsService.deactivate`) — a ward with beds/admissions is never hard-deleted. */
  async deactivate(organizationId: string, id: string): Promise<Ward> {
    const ward = await this.requireWard(organizationId, id)
    if (ward.status === (WardStatus.INACTIVE as unknown as PrismaWard['status'])) {
      throw new ConflictException('Ward is already inactive')
    }
    const updated = await this.prisma.ward.update({
      where: { id },
      data: { status: WardStatus.INACTIVE as unknown as Prisma.WardUpdateInput['status'] },
    })
    return this.toResponse(updated)
  }

  async requireWard(organizationId: string, id: string): Promise<PrismaWard> {
    const ward = await this.prisma.ward.findFirst({ where: { id, organizationId } })
    if (!ward) throw new NotFoundException('Ward not found')
    return ward
  }

  private toResponse(ward: PrismaWard): Ward {
    return {
      id: ward.id,
      organizationId: ward.organizationId,
      name: ward.name,
      code: ward.code,
      floor: ward.floor,
      block: ward.block,
      type: ward.type as unknown as Ward['type'],
      departmentId: ward.departmentId,
      status: ward.status as unknown as Ward['status'],
      createdAt: ward.createdAt,
      updatedAt: ward.updatedAt,
    }
  }

  private toResponseWithCounts(
    ward: PrismaWard & {
      department: { id: string; name: string; code: string } | null
      rooms: { id: string }[]
      beds: { id: string; status: string }[]
    },
  ): WardWithCounts {
    return {
      ...this.toResponse(ward),
      department: ward.department,
      roomCount: ward.rooms.length,
      bedCount: ward.beds.length,
      occupiedBedCount: ward.beds.filter((b) => b.status === 'OCCUPIED').length,
      availableBedCount: ward.beds.filter((b) => b.status === 'AVAILABLE').length,
    }
  }
}
