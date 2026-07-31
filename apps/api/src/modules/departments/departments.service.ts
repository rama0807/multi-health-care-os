import { CreateDepartmentDto, UpdateDepartmentDto } from '@medicore/types'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'


import { PrismaService } from '../../prisma/prisma.service'
import { HospitalsService } from '../hospitals/hospitals.service'

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hospitalsService: HospitalsService,
  ) {}

  async list(organizationId: string, hospitalId?: string) {
    return this.prisma.department.findMany({
      where: { organizationId, ...(hospitalId ? { hospitalId } : {}) },
      orderBy: { createdAt: 'asc' },
    })
  }

  async getById(organizationId: string, id: string) {
    const department = await this.prisma.department.findFirst({ where: { id, organizationId } })
    if (!department) throw new NotFoundException('Department not found')
    return department
  }

  async create(organizationId: string, dto: CreateDepartmentDto) {
    // Validates the hospital belongs to the caller's org before attaching to it.
    await this.hospitalsService.getById(organizationId, dto.hospitalId)

    const existing = await this.prisma.department.findUnique({
      where: { code_hospitalId: { code: dto.code, hospitalId: dto.hospitalId } },
    })
    if (existing) throw new ConflictException('A department with this code already exists in this hospital')

    return this.prisma.department.create({ data: { ...dto, organizationId } })
  }

  async update(organizationId: string, id: string, dto: UpdateDepartmentDto) {
    await this.getById(organizationId, id)
    return this.prisma.department.update({ where: { id }, data: dto })
  }

  async deactivate(organizationId: string, id: string) {
    await this.getById(organizationId, id)
    return this.prisma.department.update({ where: { id }, data: { isActive: false } })
  }
}
