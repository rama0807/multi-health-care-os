import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'

export interface RecordAuditEntryInput {
  organizationId: string
  userId?: string
  action: string
  resource: string
  resourceId?: string
  before?: unknown
  after?: unknown
  ipAddress?: string
  userAgent?: string
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditEntryInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        before: input.before as never,
        after: input.after as never,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    })
  }

  async listRecent(organizationId: string, limit = 20) {
    return this.prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    })
  }

  /**
   * Direct `Doctor` events use `resourceId = doctorId`, but schedule/leave/
   * document events use `resourceId = <their own id>` (scheduleId, leaveId,
   * documentId) with the owning doctorId carried in `after` instead — see
   * `AuditListener`'s persist* helpers. This matches both shapes rather than
   * adding a second capture path.
   */
  async listForDoctor(organizationId: string, doctorId: string, limit = 50) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        organizationId,
        OR: [
          { resource: 'Doctor', resourceId: doctorId },
          {
            resource: {
              in: [
                'DoctorSchedule',
                'DoctorLeave',
                'DoctorDocument',
                'Appointment',
                'Encounter',
                'Prescription',
                'LabTest',
                'RadiologyOrder',
              ],
            },
            after: { path: ['doctorId'], equals: doctorId },
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    })

    return logs.map((log) => ({
      id: log.id,
      title: log.action.replace(/[._]/g, ' '),
      action: log.action,
      resource: log.resource,
      occurredAt: log.createdAt,
    }))
  }
}
