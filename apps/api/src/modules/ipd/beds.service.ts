import { Bed, BedQuery, BedStatus, BedWithDetails, CreateBedDto, UpdateBedDto } from '@medicore/types'
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Bed as PrismaBed, Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { RoomsService } from './rooms.service'

const BED_WITH_DETAILS_INCLUDE = {
  room: { select: { id: true, roomNumber: true, chargesPerDay: true } },
  ward: { select: { id: true, name: true, code: true, type: true } },
} satisfies Prisma.BedInclude

type BedWithRelations = PrismaBed & {
  room: { id: string; roomNumber: string; chargesPerDay: Prisma.Decimal }
  ward: { id: string; name: string; code: string; type: string }
}

/** Bed inventory CRUD. Occupied/available transitions happen only through `BedAllocationService` - see ADR-0018. */
@Injectable()
export class BedsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roomsService: RoomsService,
  ) {}

  async list(organizationId: string, query: BedQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 50

    const where: Prisma.BedWhereInput = { organizationId }
    if (query.wardId) where.wardId = query.wardId
    if (query.roomId) where.roomId = query.roomId
    if (query.type) where.type = query.type as unknown as Prisma.BedWhereInput['type']
    if (query.status) where.status = query.status as unknown as Prisma.BedWhereInput['status']
    if (query.search) where.bedNumber = { contains: query.search, mode: 'insensitive' }

    const [beds, total] = await Promise.all([
      this.prisma.bed.findMany({
        where,
        include: BED_WITH_DETAILS_INCLUDE,
        orderBy: [{ wardId: 'asc' }, { bedNumber: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.bed.count({ where }),
    ])

    const currentAdmissions = await this.currentAdmissionsByBedId(
      organizationId,
      beds.map((b) => b.id),
    )

    return {
      data: beds.map((b) => this.toResponseWithDetails(b, currentAdmissions.get(b.id) ?? null)),
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

  async getById(organizationId: string, id: string): Promise<BedWithDetails> {
    const bed = await this.prisma.bed.findFirst({ where: { id, organizationId }, include: BED_WITH_DETAILS_INCLUDE })
    if (!bed) throw new NotFoundException('Bed not found')
    const currentAdmissions = await this.currentAdmissionsByBedId(organizationId, [id])
    return this.toResponseWithDetails(bed, currentAdmissions.get(id) ?? null)
  }

  async create(organizationId: string, dto: CreateBedDto): Promise<Bed> {
    const room = await this.roomsService.requireRoom(organizationId, dto.roomId)

    const existing = await this.prisma.bed.findUnique({
      where: { bedNumber_roomId: { bedNumber: dto.bedNumber, roomId: dto.roomId } },
    })
    if (existing) throw new ConflictException(`Bed "${dto.bedNumber}" already exists in this room`)

    const bed = await this.prisma.bed.create({
      data: {
        organizationId,
        bedNumber: dto.bedNumber,
        roomId: dto.roomId,
        wardId: room.wardId,
        type: dto.type as unknown as Prisma.BedCreateInput['type'],
      },
    })
    return this.toResponse(bed)
  }

  async update(organizationId: string, id: string, dto: UpdateBedDto): Promise<Bed> {
    const bed = await this.requireBed(organizationId, id)

    if (dto.status && dto.status === BedStatus.OCCUPIED) {
      throw new BadRequestException('A bed can only be occupied by allocating it to an admission')
    }
    if (bed.status === (BedStatus.OCCUPIED as unknown as PrismaBed['status']) && dto.status) {
      throw new ConflictException('Vacate the bed before changing its status directly')
    }

    let wardId = bed.wardId
    if (dto.roomId && dto.roomId !== bed.roomId) {
      const room = await this.roomsService.requireRoom(organizationId, dto.roomId)
      wardId = room.wardId
    }

    if (dto.bedNumber && (dto.bedNumber !== bed.bedNumber || dto.roomId)) {
      const existing = await this.prisma.bed.findUnique({
        where: { bedNumber_roomId: { bedNumber: dto.bedNumber, roomId: dto.roomId ?? bed.roomId } },
      })
      if (existing && existing.id !== id) {
        throw new ConflictException(`Bed "${dto.bedNumber}" already exists in this room`)
      }
    }

    const updated = await this.prisma.bed.update({
      where: { id },
      data: {
        bedNumber: dto.bedNumber,
        roomId: dto.roomId,
        wardId,
        type: dto.type as unknown as Prisma.BedUpdateInput['type'],
        status: dto.status as unknown as Prisma.BedUpdateInput['status'],
      },
    })
    return this.toResponse(updated)
  }

  /** Soft-deactivate - blocks the bed from future allocation rather than deleting the row. */
  async deactivate(organizationId: string, id: string): Promise<Bed> {
    const bed = await this.requireBed(organizationId, id)
    if (bed.status === (BedStatus.OCCUPIED as unknown as PrismaBed['status'])) {
      throw new ConflictException('Cannot deactivate an occupied bed - vacate it first')
    }
    const updated = await this.prisma.bed.update({
      where: { id },
      data: { status: BedStatus.BLOCKED as unknown as Prisma.BedUpdateInput['status'] },
    })
    return this.toResponse(updated)
  }

  async requireBed(organizationId: string, id: string): Promise<PrismaBed> {
    const bed = await this.prisma.bed.findFirst({ where: { id, organizationId } })
    if (!bed) throw new NotFoundException('Bed not found')
    return bed
  }

  private async currentAdmissionsByBedId(
    organizationId: string,
    bedIds: string[],
  ): Promise<Map<string, { id: string; admissionNumber: string; patientId: string; patientName: string }>> {
    if (!bedIds.length) return new Map()
    const admissions = await this.prisma.admission.findMany({
      where: { organizationId, bedId: { in: bedIds }, status: 'ADMITTED' },
      include: { patient: { select: { firstName: true, lastName: true } } },
    })
    return new Map(
      admissions
        .filter((a) => a.bedId)
        .map((a) => [
          a.bedId as string,
          {
            id: a.id,
            admissionNumber: a.admissionNumber,
            patientId: a.patientId,
            patientName: `${a.patient.firstName} ${a.patient.lastName}`,
          },
        ]),
    )
  }

  private toResponse(bed: PrismaBed): Bed {
    return {
      id: bed.id,
      organizationId: bed.organizationId,
      bedNumber: bed.bedNumber,
      roomId: bed.roomId,
      wardId: bed.wardId,
      type: bed.type as unknown as Bed['type'],
      status: bed.status as unknown as Bed['status'],
      createdAt: bed.createdAt,
      updatedAt: bed.updatedAt,
    }
  }

  private toResponseWithDetails(
    bed: BedWithRelations,
    currentAdmission: { id: string; admissionNumber: string; patientId: string; patientName: string } | null,
  ): BedWithDetails {
    return {
      ...this.toResponse(bed),
      room: { id: bed.room.id, roomNumber: bed.room.roomNumber, chargesPerDay: bed.room.chargesPerDay.toString() },
      ward: bed.ward as BedWithDetails['ward'],
      currentAdmission,
    }
  }
}
