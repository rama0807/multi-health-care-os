import { Holiday, UpsertHolidayDto } from '@medicore/types'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Holiday as PrismaHoliday } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class HolidaysService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, year?: number): Promise<Holiday[]> {
    const where = year
      ? {
          organizationId,
          date: { gte: new Date(Date.UTC(year, 0, 1)), lte: new Date(Date.UTC(year, 11, 31)) },
        }
      : { organizationId }

    const holidays = await this.prisma.holiday.findMany({ where, orderBy: { date: 'asc' } })
    return holidays.map((h) => this.toResponse(h))
  }

  async create(organizationId: string, dto: UpsertHolidayDto): Promise<Holiday> {
    const date = new Date(dto.date)
    const conflict = await this.prisma.holiday.findUnique({ where: { organizationId_date: { organizationId, date } } })
    if (conflict) throw new ConflictException('A holiday is already defined for this date')

    const holiday = await this.prisma.holiday.create({
      data: { organizationId, name: dto.name, date, isOptional: dto.isOptional },
    })
    return this.toResponse(holiday)
  }

  async delete(organizationId: string, id: string): Promise<void> {
    const holiday = await this.prisma.holiday.findFirst({ where: { id, organizationId } })
    if (!holiday) throw new NotFoundException('Holiday not found')
    await this.prisma.holiday.delete({ where: { id } })
  }

  /** Internal — consumed by PayrollService to count holiday days in a month. */
  async findInRange(organizationId: string, from: Date, to: Date): Promise<PrismaHoliday[]> {
    return this.prisma.holiday.findMany({ where: { organizationId, date: { gte: from, lte: to } } })
  }

  private toResponse(holiday: PrismaHoliday): Holiday {
    return {
      id: holiday.id,
      organizationId: holiday.organizationId,
      name: holiday.name,
      date: holiday.date.toISOString().slice(0, 10),
      isOptional: holiday.isOptional,
      createdAt: holiday.createdAt,
      updatedAt: holiday.updatedAt,
    }
  }
}
