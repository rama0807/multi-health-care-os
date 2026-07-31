import { CreateHospitalDto, UpdateHospitalDto } from '@medicore/types'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'


import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class HospitalsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string) {
    return this.prisma.hospital.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
    })
  }

  async getById(organizationId: string, id: string) {
    const hospital = await this.prisma.hospital.findFirst({ where: { id, organizationId } })
    if (!hospital) throw new NotFoundException('Hospital not found')
    return hospital
  }

  async create(organizationId: string, dto: CreateHospitalDto) {
    const existing = await this.prisma.hospital.findUnique({
      where: { code_organizationId: { code: dto.code, organizationId } },
    })
    if (existing) throw new ConflictException('A hospital with this code already exists')

    return this.prisma.hospital.create({ data: { ...dto, organizationId } })
  }

  async update(organizationId: string, id: string, dto: UpdateHospitalDto) {
    await this.getById(organizationId, id)
    return this.prisma.hospital.update({ where: { id }, data: dto })
  }

  async deactivate(organizationId: string, id: string) {
    await this.getById(organizationId, id)
    return this.prisma.hospital.update({ where: { id }, data: { isActive: false } })
  }
}
