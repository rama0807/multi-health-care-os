import { CreateShiftDto, Shift, ShiftSearchQuery, UpdateShiftDto } from '@medicore/types'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Shift as PrismaShift } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, query: ShiftSearchQuery): Promise<Shift[]> {
    const shifts = await this.prisma.shift.findMany({
      where: { organizationId, isActive: query.isActive === undefined ? undefined : query.isActive },
      orderBy: { startTime: 'asc' },
    })
    return shifts.map((shift) => this.toResponse(shift))
  }

  async getById(organizationId: string, id: string): Promise<Shift> {
    return this.toResponse(await this.requireShift(organizationId, id))
  }

  async create(organizationId: string, dto: CreateShiftDto): Promise<Shift> {
    const conflict = await this.prisma.shift.findUnique({
      where: { code_organizationId: { code: dto.code, organizationId } },
    })
    if (conflict) throw new ConflictException('A shift with this code already exists')

    const shift = await this.prisma.shift.create({ data: { ...dto, organizationId } })
    return this.toResponse(shift)
  }

  async update(organizationId: string, id: string, dto: UpdateShiftDto): Promise<Shift> {
    await this.requireShift(organizationId, id)

    if (dto.code) {
      const conflict = await this.prisma.shift.findUnique({
        where: { code_organizationId: { code: dto.code, organizationId } },
      })
      if (conflict && conflict.id !== id) throw new ConflictException('A shift with this code already exists')
    }

    const shift = await this.prisma.shift.update({ where: { id }, data: dto })
    return this.toResponse(shift)
  }

  async deactivate(organizationId: string, id: string): Promise<Shift> {
    await this.requireShift(organizationId, id)

    const inUse = await this.prisma.shiftRoster.findFirst({
      where: { shiftId: id, organizationId, date: { gte: startOfToday() } },
    })
    if (inUse) {
      throw new ConflictException('This shift has upcoming roster assignments - reassign them before deactivating')
    }

    const shift = await this.prisma.shift.update({ where: { id }, data: { isActive: false } })
    return this.toResponse(shift)
  }

  async requireShift(organizationId: string, id: string): Promise<PrismaShift> {
    const shift = await this.prisma.shift.findFirst({ where: { id, organizationId } })
    if (!shift) throw new NotFoundException('Shift not found')
    return shift
  }

  /** Minutes of scheduled work per shift, crossing midnight for a night shift, minus its break. */
  static standardMinutes(shift: Pick<PrismaShift, 'startTime' | 'endTime' | 'breakMinutes'>): number {
    const [startH, startM] = shift.startTime.split(':').map(Number)
    const [endH, endM] = shift.endTime.split(':').map(Number)
    const startMinutes = startH * 60 + startM
    let endMinutes = endH * 60 + endM
    if (endMinutes <= startMinutes) endMinutes += 24 * 60
    return endMinutes - startMinutes - shift.breakMinutes
  }

  private toResponse(shift: PrismaShift): Shift {
    return {
      id: shift.id,
      organizationId: shift.organizationId,
      name: shift.name,
      code: shift.code,
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakMinutes: shift.breakMinutes,
      gracePeriodMinutes: shift.gracePeriodMinutes,
      isNightShift: shift.isNightShift,
      isActive: shift.isActive,
      standardMinutes: ShiftsService.standardMinutes(shift),
      createdAt: shift.createdAt,
      updatedAt: shift.updatedAt,
    }
  }
}

function startOfToday(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}
