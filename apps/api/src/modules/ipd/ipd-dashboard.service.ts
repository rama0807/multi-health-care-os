import { IpdDashboardStats } from '@medicore/types'
import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'

/**
 * Bed occupancy + nursing/discharge dashboard — see ADR-0018/ADR-0019.
 * "Discharges today" now reflects real `AdmissionStatus.DISCHARGED` rows
 * set by `DischargeService.complete` (Checkpoint 12.2).
 */
@Injectable()
export class IpdDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(organizationId: string): Promise<IpdDashboardStats> {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [
      totalBeds,
      availableBeds,
      occupiedBeds,
      icuBeds,
      admissionsToday,
      dischargesToday,
      transfersToday,
      inpatients,
      pendingDischarge,
      pendingNursingTasks,
    ] = await Promise.all([
      this.prisma.bed.count({ where: { organizationId } }),
      this.prisma.bed.count({ where: { organizationId, status: 'AVAILABLE' } }),
      this.prisma.bed.count({ where: { organizationId, status: 'OCCUPIED' } }),
      this.prisma.bed.findMany({ where: { organizationId, type: 'ICU' }, select: { status: true } }),
      this.prisma.admission.count({ where: { organizationId, admittedAt: { gte: todayStart } } }),
      this.prisma.admission.count({
        where: { organizationId, status: 'DISCHARGED', dischargedAt: { gte: todayStart } },
      }),
      this.prisma.bedTransfer.count({ where: { organizationId, transferredAt: { gte: todayStart } } }),
      this.prisma.admission.count({ where: { organizationId, status: 'ADMITTED' } }),
      this.prisma.admission.count({
        where: { organizationId, status: 'ADMITTED', dischargeApprovedAt: { not: null } },
      }),
      this.prisma.nursingTask.count({
        where: { organizationId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      }),
    ])

    const icuTotalBeds = icuBeds.length
    const icuOccupiedBeds = icuBeds.filter((b) => b.status === 'OCCUPIED').length

    return {
      totalBeds,
      availableBeds,
      occupiedBeds,
      icuOccupiedBeds,
      icuTotalBeds,
      icuOccupancyPercent: icuTotalBeds > 0 ? Math.round((icuOccupiedBeds / icuTotalBeds) * 100) : 0,
      inpatients,
      occupancyPercent: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
      admissionsToday,
      dischargesToday,
      transfersToday,
      pendingDischarge,
      pendingNursingTasks,
    }
  }
}
