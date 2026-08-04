import { LeaveType, LeaveTypeConfig, UpsertLeaveTypeConfigDto } from '@medicore/types'
import { Injectable } from '@nestjs/common'
import { LeaveTypeConfig as PrismaLeaveTypeConfig } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class LeaveTypesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every LeaveType is listed, even if the org hasn't configured a quota for it yet (annualDays defaults to 0). */
  async list(organizationId: string): Promise<LeaveTypeConfig[]> {
    const configs = await this.prisma.leaveTypeConfig.findMany({ where: { organizationId } })
    const byType = new Map(configs.map((c) => [c.leaveType, c]))

    return Object.values(LeaveType).map((leaveType) => {
      const existing = byType.get(leaveType as unknown as PrismaLeaveTypeConfig['leaveType'])
      return existing
        ? this.toResponse(existing)
        : {
            id: '',
            organizationId,
            leaveType,
            annualDays: 0,
            isPaid: true,
            isActive: false,
            createdAt: new Date(0),
            updatedAt: new Date(0),
          }
    })
  }

  async upsert(organizationId: string, dto: UpsertLeaveTypeConfigDto): Promise<LeaveTypeConfig> {
    const config = await this.prisma.leaveTypeConfig.upsert({
      where: { organizationId_leaveType: { organizationId, leaveType: dto.leaveType } },
      create: { organizationId, ...dto },
      update: { annualDays: dto.annualDays, isPaid: dto.isPaid, isActive: dto.isActive },
    })
    return this.toResponse(config)
  }

  /** Internal — consumed by StaffLeaveService for balance computation. */
  async findAllActive(organizationId: string): Promise<PrismaLeaveTypeConfig[]> {
    return this.prisma.leaveTypeConfig.findMany({ where: { organizationId, isActive: true } })
  }

  private toResponse(config: PrismaLeaveTypeConfig): LeaveTypeConfig {
    return {
      id: config.id,
      organizationId: config.organizationId,
      leaveType: config.leaveType as unknown as LeaveType,
      annualDays: config.annualDays,
      isPaid: config.isPaid,
      isActive: config.isActive,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }
  }
}
