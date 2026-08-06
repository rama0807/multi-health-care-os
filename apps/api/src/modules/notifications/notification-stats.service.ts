import {
  NotificationCategory,
  NotificationChannelStat,
  NotificationDeliveryStats,
  NotificationDeliveryStatus,
  NotificationPriority,
  NotificationStatus,
  NOTIFICATION_CHANNELS,
  PlatformNotificationAnalytics,
  ReportFilterQuery,
} from '@medicore/types'
import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'
import { resolveRange, toDateKey } from '../reports/report-range.util'

import { NotificationDispatcherService } from './notification-dispatcher.service'
import { NotificationQueueService } from './notification-queue.service'

/**
 * Delivery statistics (Checkpoint 18.6).
 *
 * Reuses Milestone 17's `report-range.util` for range resolution and
 * local-time day bucketing rather than re-deriving either - a notification
 * volume chart and a report over the same period must agree on what "today"
 * means in +05:30, and ADR-0026 already settled that.
 *
 * Two rules carried over from Milestone 17 and held here: `to` is exclusive,
 * and a rate over zero attempts is **null**, not `0` - "nothing was sent" and
 * "everything failed" are different facts.
 */
@Injectable()
export class NotificationStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: NotificationQueueService,
    private readonly dispatcher: NotificationDispatcherService,
  ) {}

  async forOrganization(
    organizationId: string,
    query: ReportFilterQuery = {},
  ): Promise<NotificationDeliveryStats> {
    return this.compute({ organizationId }, query)
  }

  /** Cross-tenant totals for the Platform Owner console. */
  async forPlatform(query: ReportFilterQuery = {}): Promise<PlatformNotificationAnalytics> {
    const range = resolveRange(query)
    const totals = await this.compute({}, query)

    const perOrg = await this.prisma.notification.groupBy({
      by: ['organizationId'],
      where: { createdAt: { gte: range.from, lt: range.to } },
      _count: { _all: true },
      orderBy: { _count: { organizationId: 'desc' } },
      take: 50,
    })

    const orgIds = perOrg.map((row) => row.organizationId)
    const [organizations, deliveries] = await Promise.all([
      this.prisma.organization.findMany({
        where: { id: { in: orgIds } },
        select: { id: true, name: true },
      }),
      this.prisma.notificationDelivery.groupBy({
        by: ['organizationId', 'status'],
        where: { organizationId: { in: orgIds }, createdAt: { gte: range.from, lt: range.to } },
        _count: { _all: true },
      }),
    ])

    const nameById = new Map(organizations.map((org) => [org.id, org.name]))

    return {
      period: { from: range.from.toISOString(), to: range.to.toISOString() },
      totals,
      providers: this.dispatcher.providerStatuses(),
      queue: await this.queue.status(),
      byOrganization: perOrg.map((row) => {
        const rows = deliveries.filter((d) => d.organizationId === row.organizationId)
        const sent = sumWhere(rows, [NotificationDeliveryStatus.SENT, NotificationDeliveryStatus.DELIVERED])
        const failed = sumWhere(rows, [NotificationDeliveryStatus.FAILED])
        return {
          organizationId: row.organizationId,
          organizationName: nameById.get(row.organizationId) ?? 'Unknown organization',
          total: row._count._all,
          sent,
          failed,
          successRate: rate(sent, sent + failed),
        }
      }),
    }
  }

  private async compute(
    scope: { organizationId?: string },
    query: ReportFilterQuery,
  ): Promise<NotificationDeliveryStats> {
    const range = resolveRange(query)
    const window = { gte: range.from, lt: range.to }
    const notificationWhere: Prisma.NotificationWhereInput = { ...scope, createdAt: window }
    const deliveryWhere: Prisma.NotificationDeliveryWhereInput = { ...scope, createdAt: window }

    const [total, read, scheduled, byCategory, byPriority, deliveryRows, dailyRows] = await Promise.all([
      this.prisma.notification.count({ where: notificationWhere }),
      this.prisma.notification.count({ where: { ...notificationWhere, isRead: true } }),
      this.prisma.notification.count({
        where: { ...notificationWhere, deliveryStatus: NotificationStatus.SCHEDULED },
      }),
      this.prisma.notification.groupBy({
        by: ['category'],
        where: notificationWhere,
        _count: { _all: true },
      }),
      this.prisma.notification.groupBy({
        by: ['priority'],
        where: notificationWhere,
        _count: { _all: true },
      }),
      this.prisma.notificationDelivery.groupBy({
        by: ['channel', 'status'],
        where: deliveryWhere,
        _count: { _all: true },
      }),
      this.prisma.notificationDelivery.findMany({
        where: deliveryWhere,
        select: { status: true, createdAt: true },
      }),
    ])

    const byChannel: NotificationChannelStat[] = NOTIFICATION_CHANNELS.map((channel) => {
      const rows = deliveryRows.filter((row) => row.channel === channel)
      const sent = sumWhere(rows, [NotificationDeliveryStatus.SENT, NotificationDeliveryStatus.DELIVERED])
      const failed = sumWhere(rows, [NotificationDeliveryStatus.FAILED])
      const skipped = sumWhere(rows, [NotificationDeliveryStatus.SKIPPED, NotificationDeliveryStatus.CANCELLED])
      const pending = sumWhere(rows, [
        NotificationDeliveryStatus.PENDING,
        NotificationDeliveryStatus.QUEUED,
        NotificationDeliveryStatus.SENDING,
      ])
      return {
        channel,
        // "Attempted" deliberately excludes skipped: nothing was tried, so
        // counting it would depress every success rate on the dashboard.
        attempted: sent + failed,
        sent,
        failed,
        skipped,
        pending,
        successRate: rate(sent, sent + failed),
      }
    })

    const totalSent = byChannel.reduce((sum, row) => sum + row.sent, 0)
    const totalFailed = byChannel.reduce((sum, row) => sum + row.failed, 0)
    const attempted = totalSent + totalFailed

    // Local-time day keys, never `toISOString()` - that shifts the day in
    // +05:30 and would file an 03:00 IST notification under the previous date.
    const buckets = new Map<string, { sent: number; failed: number }>()
    for (const row of dailyRows) {
      const key = toDateKey(row.createdAt)
      const bucket = buckets.get(key) ?? { sent: 0, failed: 0 }
      if (row.status === NotificationDeliveryStatus.SENT || row.status === NotificationDeliveryStatus.DELIVERED) {
        bucket.sent += 1
      } else if (row.status === NotificationDeliveryStatus.FAILED) {
        bucket.failed += 1
      }
      buckets.set(key, bucket)
    }

    return {
      period: { from: range.from.toISOString(), to: range.to.toISOString() },
      total,
      read,
      unread: total - read,
      scheduled,
      failed: totalFailed,
      byChannel,
      byCategory: byCategory.map((row) => ({
        category: row.category as NotificationCategory,
        count: row._count._all,
      })),
      byPriority: byPriority.map((row) => ({
        priority: row.priority as NotificationPriority,
        count: row._count._all,
      })),
      series: [...buckets.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([bucket, value]) => ({ bucket, ...value })),
      successRate: rate(totalSent, attempted),
      failureRate: rate(totalFailed, attempted),
    }
  }
}

function sumWhere(
  rows: Array<{ status: string; _count: { _all: number } }>,
  statuses: NotificationDeliveryStatus[],
): number {
  return rows
    .filter((row) => statuses.includes(row.status as NotificationDeliveryStatus))
    .reduce((sum, row) => sum + row._count._all, 0)
}

/** Null when the denominator is zero - never a misleading `0.00`. */
function rate(part: number, total: number): string | null {
  if (total === 0) return null
  return ((part / total) * 100).toFixed(2)
}
