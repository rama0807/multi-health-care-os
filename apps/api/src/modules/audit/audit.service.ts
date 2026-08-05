import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

export interface AuditLogQuery {
  page?: number
  limit?: number
  /** Cross-tenant callers only (`listGlobal`); ignored by `list`. */
  organizationId?: string
  userId?: string
  action?: string
  resource?: string
  resourceId?: string
  from?: Date
  to?: Date
  /** Free-text match against action or resource. */
  search?: string
}

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
   * Filtered, paginated audit trail (Checkpoint 16.1).
   *
   * `organizationId` is a required positional argument on purpose — this is
   * the tenant-scoped reader. The Platform Owner console's cross-tenant
   * equivalent is `listGlobal`, and keeping them as two methods means an
   * organization-scoped caller cannot accidentally omit the tenant filter.
   */
  async list(organizationId: string, query: AuditLogQuery = {}) {
    const { page, limit, skip } = paginate(query)
    const where = buildAuditWhere(query, organizationId)

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { email: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ])

    return {
      data: rows.map((log) => ({
        id: log.id,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId,
        userId: log.userId,
        userEmail: log.user?.email ?? null,
        userName: log.user ? `${log.user.firstName} ${log.user.lastName}` : null,
        ipAddress: log.ipAddress,
        before: log.before,
        after: log.after,
        createdAt: log.createdAt,
      })),
      pagination: buildPagination(page, limit, total),
    }
  }

  /**
   * Cross-tenant audit trail for the Platform Owner console (Checkpoint 16.2).
   * Only reachable behind `PlatformGuard` — there is no organization-scoped
   * route that calls this.
   */
  async listGlobal(query: AuditLogQuery = {}) {
    const { page, limit, skip } = paginate(query)
    const where = buildAuditWhere(query)

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { email: true } },
          organization: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ])

    return {
      data: rows.map((log) => ({
        id: log.id,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId,
        userId: log.userId,
        userEmail: log.user?.email ?? null,
        organizationId: log.organizationId,
        organizationName: log.organization.name,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt,
      })),
      pagination: buildPagination(page, limit, total),
    }
  }

  /**
   * Distinct action and resource values present in one organization's trail —
   * powers the audit-log filter dropdowns without hardcoding a list that would
   * drift as modules add new actions.
   */
  async listFilterOptions(organizationId: string) {
    const [actions, resources] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { organizationId },
        distinct: ['action'],
        select: { action: true },
        orderBy: { action: 'asc' },
        take: 200,
      }),
      this.prisma.auditLog.findMany({
        where: { organizationId },
        distinct: ['resource'],
        select: { resource: true },
        orderBy: { resource: 'asc' },
        take: 200,
      }),
    ])

    return {
      actions: actions.map((a) => a.action),
      resources: resources.map((r) => r.resource),
    }
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

function paginate(query: AuditLogQuery): { page: number; limit: number; skip: number } {
  const page = query.page && query.page > 0 ? query.page : 1
  const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 25
  return { page, limit, skip: (page - 1) * limit }
}

function buildPagination(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  }
}

/**
 * `scopedOrganizationId`, when supplied, always wins over
 * `query.organizationId` — a tenant-scoped caller cannot widen its own scope
 * by passing a different id in the query string.
 */
function buildAuditWhere(
  query: AuditLogQuery,
  scopedOrganizationId?: string,
): Prisma.AuditLogWhereInput {
  const organizationId = scopedOrganizationId ?? query.organizationId

  const where: Prisma.AuditLogWhereInput = {
    ...(organizationId ? { organizationId } : {}),
    ...(query.userId ? { userId: query.userId } : {}),
    ...(query.action ? { action: query.action } : {}),
    ...(query.resource ? { resource: query.resource } : {}),
    ...(query.resourceId ? { resourceId: query.resourceId } : {}),
  }

  if (query.from || query.to) {
    where.createdAt = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lte: query.to } : {}),
    }
  }

  if (query.search) {
    where.OR = [
      { action: { contains: query.search, mode: 'insensitive' } },
      { resource: { contains: query.search, mode: 'insensitive' } },
    ]
  }

  return where
}
