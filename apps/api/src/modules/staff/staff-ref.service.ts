import { Injectable, NotFoundException } from '@nestjs/common'
import { Staff } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

/**
 * Shared staff lookup for every sub-service in this module (attendance,
 * shifts, leave, payroll) — mirrors DoctorRefService's role for the
 * scheduling module.
 */
@Injectable()
export class StaffRefService {
  constructor(private readonly prisma: PrismaService) {}

  async requireStaff(organizationId: string, staffId: string): Promise<Staff> {
    const staff = await this.prisma.staff.findFirst({ where: { id: staffId, organizationId } })
    if (!staff) throw new NotFoundException('Staff member not found')
    return staff
  }

  async findStaffProfileForUser(organizationId: string, userId: string): Promise<Staff | null> {
    return this.prisma.staff.findFirst({ where: { userId, organizationId } })
  }
}
