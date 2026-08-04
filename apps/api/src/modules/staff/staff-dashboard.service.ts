import { StaffDashboardStats } from '@medicore/types'
import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'
import { toDbDateOnly } from '../scheduling/availability.util'

@Injectable()
export class StaffDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(organizationId: string): Promise<StaffDashboardStats> {
    const date = toDbDateOnly(new Date())

    const [totalStaff, activeStaff, pendingLeaveApprovals, attendanceRows, departmentGroups, shifts] =
      await Promise.all([
        this.prisma.staff.count({ where: { organizationId } }),
        this.prisma.staff.count({ where: { organizationId, employmentStatus: 'ACTIVE' } }),
        this.prisma.staffLeave.count({ where: { organizationId, status: 'PENDING' } }),
        this.prisma.attendance.groupBy({ by: ['status'], where: { organizationId, date }, _count: true }),
        this.prisma.staff.groupBy({
          by: ['departmentId'],
          where: { organizationId, employmentStatus: 'ACTIVE', departmentId: { not: null } },
          _count: true,
        }),
        this.prisma.shift.findMany({ where: { organizationId, isActive: true } }),
      ])

    const countOf = (status: string) => attendanceRows.find((r) => r.status === status)?._count ?? 0

    const departmentIds = departmentGroups.map((g) => g.departmentId).filter((id): id is string => !!id)
    const departments = await this.prisma.department.findMany({
      where: { id: { in: departmentIds } },
      select: { id: true, name: true },
    })
    const departmentNameById = new Map(departments.map((d) => [d.id, d.name]))

    const shiftCoverageToday = await Promise.all(
      shifts.map(async (shift) => {
        const [assigned, clockedIn] = await Promise.all([
          this.prisma.shiftRoster.count({ where: { organizationId, shiftId: shift.id, date, isOff: false } }),
          this.prisma.attendance.count({
            where: { organizationId, shiftId: shift.id, date, clockInAt: { not: null } },
          }),
        ])
        return { shiftId: shift.id, shiftName: shift.name, assigned, clockedIn }
      }),
    )

    return {
      totalStaff,
      activeStaff,
      onLeaveToday: countOf('ON_LEAVE'),
      presentToday: countOf('PRESENT'),
      absentToday: countOf('ABSENT'),
      lateToday: countOf('LATE'),
      pendingLeaveApprovals,
      byDepartment: departmentGroups
        .filter((g) => g.departmentId)
        .map((g) => ({
          departmentId: g.departmentId as string,
          departmentName: departmentNameById.get(g.departmentId as string) ?? 'Unknown',
          count: g._count,
        })),
      shiftCoverageToday,
    }
  }
}
