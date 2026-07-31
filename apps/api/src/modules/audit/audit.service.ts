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
}
