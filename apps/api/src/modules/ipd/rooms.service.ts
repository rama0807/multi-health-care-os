import { CreateRoomDto, Room, RoomQuery, RoomStatus, RoomWithCounts, UpdateRoomDto } from '@medicore/types'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Room as PrismaRoom, Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { WardsService } from './wards.service'

/** Room inventory CRUD - a room belongs to exactly one ward (ADR-0018). */
@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wardsService: WardsService,
  ) {}

  async list(organizationId: string, query: RoomQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20

    const where: Prisma.RoomWhereInput = { organizationId }
    if (query.wardId) where.wardId = query.wardId
    if (query.status) where.status = query.status as unknown as Prisma.RoomWhereInput['status']
    if (query.search) where.roomNumber = { contains: query.search, mode: 'insensitive' }

    const [rooms, total] = await Promise.all([
      this.prisma.room.findMany({
        where,
        include: { ward: { select: { id: true, name: true, code: true, type: true } }, beds: true },
        orderBy: { roomNumber: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.room.count({ where }),
    ])

    return {
      data: rooms.map((r) => this.toResponseWithCounts(r)),
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

  async getById(organizationId: string, id: string): Promise<RoomWithCounts> {
    const room = await this.prisma.room.findFirst({
      where: { id, organizationId },
      include: { ward: { select: { id: true, name: true, code: true, type: true } }, beds: true },
    })
    if (!room) throw new NotFoundException('Room not found')
    return this.toResponseWithCounts(room)
  }

  async create(organizationId: string, dto: CreateRoomDto): Promise<Room> {
    await this.wardsService.requireWard(organizationId, dto.wardId)

    const existing = await this.prisma.room.findUnique({
      where: { roomNumber_wardId: { roomNumber: dto.roomNumber, wardId: dto.wardId } },
    })
    if (existing) throw new ConflictException(`Room "${dto.roomNumber}" already exists in this ward`)

    const room = await this.prisma.room.create({
      data: {
        organizationId,
        roomNumber: dto.roomNumber,
        wardId: dto.wardId,
        floor: dto.floor,
        capacity: dto.capacity,
        chargesPerDay: dto.chargesPerDay,
      },
    })
    return this.toResponse(room)
  }

  async update(organizationId: string, id: string, dto: UpdateRoomDto): Promise<Room> {
    const room = await this.requireRoom(organizationId, id)
    const wardId = dto.wardId ?? room.wardId
    if (dto.wardId) await this.wardsService.requireWard(organizationId, dto.wardId)

    if (dto.roomNumber && (dto.roomNumber !== room.roomNumber || dto.wardId)) {
      const existing = await this.prisma.room.findUnique({
        where: { roomNumber_wardId: { roomNumber: dto.roomNumber, wardId } },
      })
      if (existing && existing.id !== id) {
        throw new ConflictException(`Room "${dto.roomNumber}" already exists in this ward`)
      }
    }

    const updated = await this.prisma.room.update({
      where: { id },
      data: {
        roomNumber: dto.roomNumber,
        wardId: dto.wardId,
        floor: dto.floor,
        capacity: dto.capacity,
        chargesPerDay: dto.chargesPerDay,
        status: dto.status as unknown as Prisma.RoomUpdateInput['status'],
      },
    })
    return this.toResponse(updated)
  }

  async deactivate(organizationId: string, id: string): Promise<Room> {
    const room = await this.requireRoom(organizationId, id)
    if (room.status === (RoomStatus.INACTIVE as unknown as PrismaRoom['status'])) {
      throw new ConflictException('Room is already inactive')
    }
    const updated = await this.prisma.room.update({
      where: { id },
      data: { status: RoomStatus.INACTIVE as unknown as Prisma.RoomUpdateInput['status'] },
    })
    return this.toResponse(updated)
  }

  async requireRoom(organizationId: string, id: string): Promise<PrismaRoom> {
    const room = await this.prisma.room.findFirst({ where: { id, organizationId } })
    if (!room) throw new NotFoundException('Room not found')
    return room
  }

  private toResponse(room: PrismaRoom): Room {
    return {
      id: room.id,
      organizationId: room.organizationId,
      roomNumber: room.roomNumber,
      wardId: room.wardId,
      floor: room.floor,
      capacity: room.capacity,
      chargesPerDay: room.chargesPerDay.toString(),
      status: room.status as unknown as Room['status'],
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    }
  }

  private toResponseWithCounts(
    room: PrismaRoom & {
      ward: { id: string; name: string; code: string; type: string }
      beds: { id: string; status: string }[]
    },
  ): RoomWithCounts {
    return {
      ...this.toResponse(room),
      ward: room.ward as RoomWithCounts['ward'],
      bedCount: room.beds.length,
      occupiedBedCount: room.beds.filter((b) => b.status === 'OCCUPIED').length,
    }
  }
}
