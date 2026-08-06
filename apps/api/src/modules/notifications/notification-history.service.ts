import {
  MarkNotificationsDto,
  Notification,
  NotificationCategory,
  NotificationChannel,
  NotificationDeliveryRecord,
  NotificationDeliveryStatus,
  NotificationHistoryQuery,
  NotificationPriority,
  NotificationQuery,
  NotificationStatus,
  NotificationType,
  NotificationUnreadSummary,
  PaginatedResponse,
} from '@medicore/types'
import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

type NotificationRow = Prisma.NotificationGetPayload<{
  include: {
    deliveries: true
    recipient: { select: { id: true; firstName: true; lastName: true; email: true } }
  }
}>

/**
 * Reads over notifications (Checkpoints 18.3 and 18.6).
 *
 * Two audiences, deliberately two methods:
 *
 * - `listForUser` is a user's own centre. It is scoped to `recipientId` and
 *   takes no organization filter from the caller, so one user's inbox can
 *   never be read by asking for someone else's.
 * - `listForOrganization` is the admin console's history. It is scoped by
 *   `organizationId` and gated by `notifications.read`.
 *
 * Keeping them apart means the inbox cannot accidentally grow an
 * organization-wide escape hatch, the same reasoning `AuditService.list`
 * versus `listGlobal` already follows.
 */
@Injectable()
export class NotificationHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(
    userId: string,
    query: NotificationQuery = {},
  ): Promise<PaginatedResponse<Notification>> {
    const { page, limit, skip } = paginate(query)

    const where: Prisma.NotificationWhereInput = {
      recipientId: userId,
      // A scheduled notification has not happened yet; showing it in the
      // centre would announce an event before it occurs.
      deliveryStatus: { not: NotificationStatus.SCHEDULED },
      ...inboxFilter(query.filter),
      ...commonFilters(query),
    }

    return this.paginatedQuery(where, page, limit, skip, false)
  }

  async listForOrganization(
    organizationId: string,
    query: NotificationHistoryQuery = {},
  ): Promise<PaginatedResponse<Notification>> {
    const { page, limit, skip } = paginate(query)

    const where: Prisma.NotificationWhereInput = {
      organizationId,
      ...(query.recipientId ? { recipientId: query.recipientId } : {}),
      ...(query.status ? { deliveryStatus: query.status } : {}),
      ...(query.scheduledOnly ? { deliveryStatus: NotificationStatus.SCHEDULED } : {}),
      ...(query.failedOnly || query.channel || query.deliveryStatus
        ? {
            deliveries: {
              some: {
                ...(query.channel ? { channel: query.channel } : {}),
                ...(query.deliveryStatus ? { status: query.deliveryStatus } : {}),
                ...(query.failedOnly ? { status: NotificationDeliveryStatus.FAILED } : {}),
              },
            },
          }
        : {}),
      ...inboxFilter(query.filter),
      ...commonFilters(query),
    }

    return this.paginatedQuery(where, page, limit, skip, true)
  }

  async getForUser(userId: string, id: string): Promise<Notification> {
    const row = await this.prisma.notification.findFirst({
      where: { id, recipientId: userId },
      include: { deliveries: true, recipient: RECIPIENT_SELECT },
    })
    if (!row) throw new NotFoundException('Notification not found')
    return toResponse(row, true)
  }

  async getForOrganization(organizationId: string, id: string): Promise<Notification> {
    const row = await this.prisma.notification.findFirst({
      where: { id, organizationId },
      include: { deliveries: true, recipient: RECIPIENT_SELECT },
    })
    if (!row) throw new NotFoundException('Notification not found')
    return toResponse(row, true)
  }

  /** Bell state. One query per counter, all filtered to this user. */
  async summary(userId: string): Promise<NotificationUnreadSummary> {
    const base: Prisma.NotificationWhereInput = {
      recipientId: userId,
      isArchived: false,
      deliveryStatus: { not: NotificationStatus.SCHEDULED },
    }

    const [unread, critical, pinned, byCategory] = await Promise.all([
      this.prisma.notification.count({ where: { ...base, isRead: false } }),
      this.prisma.notification.count({
        where: { ...base, isRead: false, priority: NotificationPriority.CRITICAL },
      }),
      this.prisma.notification.count({ where: { recipientId: userId, isPinned: true } }),
      this.prisma.notification.groupBy({
        by: ['category'],
        where: { ...base, isRead: false },
        _count: { _all: true },
      }),
    ])

    return {
      unread,
      critical,
      pinned,
      byCategory: byCategory.map((row) => ({
        category: row.category as NotificationCategory,
        count: row._count._all,
      })),
    }
  }

  async markRead(userId: string, dto: MarkNotificationsDto): Promise<number> {
    const now = new Date()
    const result = await this.prisma.notification.updateMany({
      where: { id: { in: dto.ids }, recipientId: userId, isRead: false },
      data: { isRead: true, readAt: now, deliveryStatus: NotificationStatus.READ },
    })
    return result.count
  }

  async markAllRead(userId: string): Promise<number> {
    const now = new Date()
    const result = await this.prisma.notification.updateMany({
      where: {
        recipientId: userId,
        isRead: false,
        deliveryStatus: { not: NotificationStatus.SCHEDULED },
      },
      data: { isRead: true, readAt: now, deliveryStatus: NotificationStatus.READ },
    })
    return result.count
  }

  async markUnread(userId: string, id: string): Promise<Notification> {
    await this.assertOwned(userId, id)
    const row = await this.prisma.notification.update({
      where: { id },
      data: { isRead: false, readAt: null },
      include: { deliveries: true, recipient: RECIPIENT_SELECT },
    })
    return toResponse(row, true)
  }

  async setArchived(userId: string, id: string, archived: boolean): Promise<Notification> {
    await this.assertOwned(userId, id)
    const row = await this.prisma.notification.update({
      where: { id },
      data: { isArchived: archived, archivedAt: archived ? new Date() : null },
      include: { deliveries: true, recipient: RECIPIENT_SELECT },
    })
    return toResponse(row, true)
  }

  async setPinned(userId: string, id: string, pinned: boolean): Promise<Notification> {
    await this.assertOwned(userId, id)
    const row = await this.prisma.notification.update({
      where: { id },
      data: { isPinned: pinned, pinnedAt: pinned ? new Date() : null },
      include: { deliveries: true, recipient: RECIPIENT_SELECT },
    })
    return toResponse(row, true)
  }

  /**
   * Removes a notification from a user's centre. Deliveries cascade with it -
   * a user deleting their own copy should not leave orphaned delivery rows
   * inflating the organization's statistics.
   */
  async remove(userId: string, id: string): Promise<void> {
    await this.assertOwned(userId, id)
    await this.prisma.notification.delete({ where: { id } })
  }

  private async assertOwned(userId: string, id: string): Promise<void> {
    const existing = await this.prisma.notification.findFirst({
      where: { id, recipientId: userId },
      select: { id: true },
    })
    if (!existing) throw new NotFoundException('Notification not found')
  }

  private async paginatedQuery(
    where: Prisma.NotificationWhereInput,
    page: number,
    limit: number,
    skip: number,
    includeDeliveries: boolean,
  ): Promise<PaginatedResponse<Notification>> {
    const [rows, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        include: { deliveries: includeDeliveries, recipient: RECIPIENT_SELECT },
        // Pinned first, then newest - the timeline a user expects to see.
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ])

    return {
      data: rows.map((row) => toResponse(row as NotificationRow, includeDeliveries)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    }
  }
}

const RECIPIENT_SELECT = { select: { id: true, firstName: true, lastName: true, email: true } } as const

function paginate(query: NotificationQuery): { page: number; limit: number; skip: number } {
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit) || DEFAULT_LIMIT))
  return { page, limit, skip: (page - 1) * limit }
}

function inboxFilter(filter?: NotificationQuery['filter']): Prisma.NotificationWhereInput {
  switch (filter) {
    case 'unread':
      return { isRead: false, isArchived: false }
    case 'read':
      return { isRead: true, isArchived: false }
    case 'archived':
      return { isArchived: true }
    case 'pinned':
      return { isPinned: true }
    case 'critical':
      return { priority: NotificationPriority.CRITICAL, isArchived: false }
    case 'all':
    default:
      // "All" means the active inbox - archived is a separate drawer, not a
      // subset of everything, mirroring how mail clients behave.
      return { isArchived: false }
  }
}

function commonFilters(query: NotificationQuery): Prisma.NotificationWhereInput {
  const from = query.from ? new Date(query.from) : null
  const to = query.to ? new Date(query.to) : null

  return {
    ...(query.category ? { category: query.category } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' as const } },
            { body: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from && !Number.isNaN(from.getTime()) ? { gte: from } : {}),
            // `to` is exclusive everywhere in this repo (ADR-0026).
            ...(to && !Number.isNaN(to.getTime()) ? { lt: to } : {}),
          },
        }
      : {}),
  }
}

export function toResponse(row: NotificationRow, includeDeliveries: boolean): Notification {
  return {
    id: row.id,
    organizationId: row.organizationId,
    hospitalId: row.hospitalId,
    recipientId: row.recipientId,
    patientId: row.patientId,
    type: row.type as NotificationType,
    category: row.category as NotificationCategory,
    priority: row.priority as NotificationPriority,
    title: row.title,
    body: row.body,
    icon: row.icon,
    imageUrl: row.imageUrl,
    deepLink: row.deepLink,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    scheduleAt: row.scheduleAt?.toISOString() ?? null,
    retryCount: row.retryCount,
    deliveryStatus: row.deliveryStatus as NotificationStatus,
    failureReason: row.failureReason,
    isRead: row.isRead,
    readAt: row.readAt?.toISOString() ?? null,
    isArchived: row.isArchived,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    isPinned: row.isPinned,
    pinnedAt: row.pinnedAt?.toISOString() ?? null,
    sentAt: row.sentAt?.toISOString() ?? null,
    eventKey: row.eventKey,
    createdAt: row.createdAt.toISOString(),
    ...(includeDeliveries && row.deliveries
      ? { deliveries: row.deliveries.map(toDeliveryResponse) }
      : {}),
    ...(row.recipient ? { recipient: row.recipient } : {}),
  }
}

function toDeliveryResponse(row: {
  id: string
  channel: string
  status: string
  destination: string | null
  attempts: number
  nextAttemptAt: Date | null
  lastAttemptAt: Date | null
  sentAt: Date | null
  deliveredAt: Date | null
  failedAt: Date | null
  failureReason: string | null
  providerName: string | null
  providerMessageId: string | null
}): NotificationDeliveryRecord {
  return {
    id: row.id,
    channel: row.channel as NotificationChannel,
    status: row.status as NotificationDeliveryStatus,
    destination: row.destination,
    attempts: row.attempts,
    nextAttemptAt: row.nextAttemptAt?.toISOString() ?? null,
    lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
    sentAt: row.sentAt?.toISOString() ?? null,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    failedAt: row.failedAt?.toISOString() ?? null,
    failureReason: row.failureReason,
    providerName: row.providerName,
    providerMessageId: row.providerMessageId,
  }
}
