import { UpdateOrganizationDto } from '@medicore/types'
import { Injectable, NotFoundException } from '@nestjs/common'


import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(organizationId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } })
    if (!org) throw new NotFoundException('Organization not found')
    return org
  }

  async updateCurrent(organizationId: string, dto: UpdateOrganizationDto) {
    await this.getCurrent(organizationId)
    return this.prisma.organization.update({ where: { id: organizationId }, data: dto })
  }
}
