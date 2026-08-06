import { OrganizationUsage } from '@medicore/types'
import { Injectable } from '@nestjs/common'

import { ApiUsageService } from '../../common/tenant/api-usage.service'
import { StorageUsageService } from '../../common/tenant/storage-usage.service'
import { PrismaService } from '../../prisma/prisma.service'

import { SubscriptionsService } from './subscriptions.service'

/**
 * The Usage tab of the Organization Dashboard, and the per-organization half
 * of the Platform Owner console's usage view (Checkpoint 16.1 / 16.2).
 *
 * Every figure here is a real query. AI usage reads the `AiUsageLog` rows
 * Checkpoint 15.1 already writes - the milestone brief called AI usage a
 * placeholder, but genuine metered data exists, so reporting it is both more
 * useful and more honest than showing a stub. It simply reads zero until an
 * AI provider credential is configured (TD-0041).
 */
@Injectable()
export class OrganizationUsageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageUsage: StorageUsageService,
    private readonly apiUsage: ApiUsageService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async getUsage(organizationId: string): Promise<OrganizationUsage> {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [
      storageByCategory,
      usersTotal,
      usersActive,
      usersActiveRecently,
      hospitals,
      patients,
      apiDaily,
      aiUsage,
      subscription,
    ] = await Promise.all([
      this.storageUsage.getBreakdown(organizationId),
      this.prisma.user.count({ where: { organizationId } }),
      this.prisma.user.count({ where: { organizationId, status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { organizationId, lastLoginAt: { gte: thirtyDaysAgo } } }),
      this.prisma.hospital.count({ where: { organizationId } }),
      this.prisma.patient.count({ where: { organizationId, isActive: true } }),
      this.apiUsage.getDaily(organizationId),
      this.getAiUsage(organizationId),
      this.subscriptions.findForOrganization(organizationId),
    ])

    return {
      storage: {
        totalBytes: storageByCategory.reduce((sum, row) => sum + row.bytes, 0),
        quotaMb: subscription?.storageQuotaMb ?? null,
        byCategory: storageByCategory,
      },
      users: {
        total: usersTotal,
        active: usersActive,
        activeLast30Days: usersActiveRecently,
        limit: subscription?.maxUsers ?? null,
      },
      hospitals: { total: hospitals, limit: subscription?.maxHospitals ?? null },
      patients: { total: patients, limit: subscription?.maxPatients ?? null },
      api: {
        windowDays: ApiUsageService.WINDOW_DAYS,
        totalRequests: apiDaily.reduce((sum, d) => sum + d.requests, 0),
        daily: apiDaily,
      },
      ai: aiUsage,
    }
  }

  /**
   * `estimatedCostUsd` is 0 whenever no per-token price is configured - that
   * means "no price configured", not "free" (see the schema comment on
   * `AiUsageLog`). It is surfaced verbatim rather than being inferred.
   */
  async getAiUsage(
    organizationId: string,
  ): Promise<{ totalRequests: number; totalTokens: number; estimatedCost: number }> {
    const result = await this.prisma.aiUsageLog.aggregate({
      where: { organizationId },
      _count: true,
      _sum: { totalTokens: true, estimatedCostUsd: true },
    })

    return {
      totalRequests: result._count,
      totalTokens: result._sum.totalTokens ?? 0,
      estimatedCost: Number(result._sum.estimatedCostUsd ?? 0),
    }
  }
}
