import { Injectable, NotFoundException } from '@nestjs/common'
import { Doctor } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

/**
 * Shared doctor lookup for every scheduling service, used instead of a
 * dependency on DoctorsModule — keeps the module graph one-directional
 * (DoctorsModule -> SchedulingModule, for dashboard stats) and avoids a
 * circular import.
 */
@Injectable()
export class DoctorRefService {
  constructor(private readonly prisma: PrismaService) {}

  async requireDoctor(organizationId: string, doctorId: string): Promise<Doctor> {
    const doctor = await this.prisma.doctor.findFirst({ where: { id: doctorId, organizationId } })
    if (!doctor) throw new NotFoundException('Doctor not found')
    return doctor
  }

  async findDoctorProfileForUser(organizationId: string, userId: string): Promise<Doctor | null> {
    return this.prisma.doctor.findFirst({ where: { userId, organizationId } })
  }
}
