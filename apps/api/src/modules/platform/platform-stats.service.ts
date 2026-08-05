import {
  OrganizationStatus,
  PlatformAnalytics,
  PlatformSearchResult,
  PlatformStats,
} from '@medicore/types'
import { Injectable } from '@nestjs/common'

import { ApiUsageService } from '../../common/tenant/api-usage.service'
import { StorageUsageService } from '../../common/tenant/storage-usage.service'
import { PrismaService } from '../../prisma/prisma.service'

const TOP_N = 10

/**
 * Platform-wide statistics, analytics and global search (Checkpoint 16.2).
 *
 * Every number is a real aggregate over live tenant data. AI usage reads the
 * `AiUsageLog` rows Checkpoint 15.1 already writes — real metered data rather
 * than the placeholder the brief allowed for. It reads zero until an AI
 * provider credential is configured (TD-0041), which is the honest answer.
 */
@Injectable()
export class PlatformStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageUsage: StorageUsageService,
    private readonly apiUsage: ApiUsageService,
  ) {}

  async getStats(): Promise<PlatformStats> {
    const thirtyDaysAgo = daysAgo(30)

    const [
      statusGroups,
      orgsTotal,
      hospitalsTotal,
      hospitalsActive,
      usersTotal,
      usersActive,
      usersActiveRecently,
      patients,
      planGroups,
      aiUsage,
      signupsLast30Days,
      customerOrgIds,
      storageByOrg,
    ] = await Promise.all([
      this.prisma.organization.groupBy({
        by: ['status'],
        where: { isPlatform: false },
        _count: true,
      }),
      this.prisma.organization.count({ where: { isPlatform: false } }),
      this.prisma.hospital.count(),
      this.prisma.hospital.count({ where: { isActive: true } }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { lastLoginAt: { gte: thirtyDaysAgo } } }),
      this.prisma.patient.count({ where: { isActive: true } }),
      this.prisma.organization.groupBy({
        by: ['subscriptionTier'],
        where: { isPlatform: false },
        _count: true,
      }),
      this.prisma.aiUsageLog.aggregate({
        _count: true,
        _sum: { totalTokens: true, estimatedCostUsd: true },
      }),
      this.prisma.organization.count({
        where: { isPlatform: false, createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.organization.findMany({ where: { isPlatform: false }, select: { id: true } }),
      this.storageUsage.getTotalBytesByOrganization(),
    ])

    const apiDaily = await this.apiUsage.getPlatformDaily(customerOrgIds.map((o) => o.id))
    const countOf = (status: OrganizationStatus) =>
      statusGroups.find((g) => g.status === status)?._count ?? 0

    return {
      organizations: {
        total: orgsTotal,
        active: countOf(OrganizationStatus.ACTIVE),
        suspended: countOf(OrganizationStatus.SUSPENDED),
        trial: countOf(OrganizationStatus.TRIAL),
        cancelled: countOf(OrganizationStatus.CANCELLED),
      },
      hospitals: { total: hospitalsTotal, active: hospitalsActive },
      users: { total: usersTotal, active: usersActive, activeLast30Days: usersActiveRecently },
      patients,
      storageBytes: [...storageByOrg.values()].reduce((sum, bytes) => sum + bytes, 0),
      subscriptionsByPlan: planGroups.map((g) => ({
        plan: g.subscriptionTier as unknown as PlatformStats['subscriptionsByPlan'][number]['plan'],
        count: g._count,
      })),
      api: {
        windowDays: ApiUsageService.WINDOW_DAYS,
        totalRequests: apiDaily.reduce((sum, d) => sum + d.requests, 0),
        daily: apiDaily,
      },
      ai: {
        totalRequests: aiUsage._count,
        totalTokens: aiUsage._sum.totalTokens ?? 0,
        estimatedCost: Number(aiUsage._sum.estimatedCostUsd ?? 0),
      },
      signupsLast30Days,
    }
  }

  async getAnalytics(): Promise<PlatformAnalytics> {
    const [organizations, statusGroups, storageByOrg] = await Promise.all([
      this.prisma.organization.findMany({
        where: { isPlatform: false },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          _count: { select: { users: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.organization.groupBy({
        by: ['status'],
        where: { isPlatform: false },
        _count: true,
      }),
      this.storageUsage.getTotalBytesByOrganization(),
    ])

    const apiByOrg = await this.apiUsage.getTotalsByOrganization(organizations.map((o) => o.id))

    // Growth is derived from `createdAt` rather than a stored counter, so it
    // stays correct if an organization is removed or backdated.
    const byMonth = new Map<string, number>()
    for (const org of organizations) {
      const month = org.createdAt.toISOString().slice(0, 7)
      byMonth.set(month, (byMonth.get(month) ?? 0) + 1)
    }

    let cumulative = 0
    const organizationGrowth = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, created]) => {
        cumulative += created
        return { month, created, cumulative }
      })

    return {
      organizationGrowth,
      topOrganizationsByUsers: organizations
        .map((o) => ({ organizationId: o.id, name: o.name, slug: o.slug, users: o._count.users }))
        .sort((a, b) => b.users - a.users)
        .slice(0, TOP_N),
      topOrganizationsByStorage: organizations
        .map((o) => ({
          organizationId: o.id,
          name: o.name,
          slug: o.slug,
          bytes: storageByOrg.get(o.id) ?? 0,
        }))
        .sort((a, b) => b.bytes - a.bytes)
        .slice(0, TOP_N),
      topOrganizationsByApiRequests: organizations
        .map((o) => ({
          organizationId: o.id,
          name: o.name,
          slug: o.slug,
          requests: apiByOrg.get(o.id) ?? 0,
        }))
        .sort((a, b) => b.requests - a.requests)
        .slice(0, TOP_N),
      statusBreakdown: statusGroups.map((g) => ({
        status: g.status as unknown as PlatformAnalytics['statusBreakdown'][number]['status'],
        count: g._count,
      })),
    }
  }

  /**
   * Global search across tenants — organizations, hospitals and users.
   *
   * Deliberately limited to *tenant administration* entities. It does not
   * search patients or any clinical record: a platform operator has no
   * clinical need for them, and exposing PHI across every tenant from one
   * search box would be a significant privacy regression. See TECH_DEBT
   * TD-0049.
   */
  async search(term: string, limit = 10): Promise<PlatformSearchResult[]> {
    const query = term.trim()
    if (query.length < 2) return []

    const take = Math.min(limit, 25)
    const contains = { contains: query, mode: 'insensitive' as const }

    const [organizations, hospitals, users] = await Promise.all([
      this.prisma.organization.findMany({
        where: { OR: [{ name: contains }, { slug: contains }, { email: contains }] },
        select: { id: true, name: true, slug: true, status: true },
        take,
      }),
      this.prisma.hospital.findMany({
        where: { OR: [{ name: contains }, { code: contains }] },
        select: {
          id: true,
          name: true,
          code: true,
          organizationId: true,
          organization: { select: { name: true } },
        },
        take,
      }),
      this.prisma.user.findMany({
        where: { OR: [{ email: contains }, { firstName: contains }, { lastName: contains }] },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          organizationId: true,
          organization: { select: { name: true } },
        },
        take,
      }),
    ])

    return [
      ...organizations.map((o) => ({
        type: 'ORGANIZATION' as const,
        id: o.id,
        title: o.name,
        subtitle: `${o.slug} · ${o.status}`,
        organizationId: o.id,
        organizationName: o.name,
      })),
      ...hospitals.map((h) => ({
        type: 'HOSPITAL' as const,
        id: h.id,
        title: h.name,
        subtitle: h.code,
        organizationId: h.organizationId,
        organizationName: h.organization.name,
      })),
      ...users.map((u) => ({
        type: 'USER' as const,
        id: u.id,
        title: `${u.firstName} ${u.lastName}`,
        subtitle: u.email,
        organizationId: u.organizationId,
        organizationName: u.organization.name,
      })),
    ]
  }
}

function daysAgo(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}
