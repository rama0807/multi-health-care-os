import { NotificationChannel, NotificationDeliveryStatus, NotificationQueueStatus } from '@medicore/types'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NotificationDelivery, Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { ChannelSendResult } from './channels/channel-provider.interface'

/** Terminal states - never claimed by the worker again. */
const TERMINAL: NotificationDeliveryStatus[] = [
  NotificationDeliveryStatus.SENT,
  NotificationDeliveryStatus.DELIVERED,
  NotificationDeliveryStatus.SKIPPED,
  NotificationDeliveryStatus.CANCELLED,
]

/**
 * The retry queue (Checkpoint 18.1).
 *
 * **The queue is the `notification_deliveries` table, not a separate broker.**
 * `bullmq` is already a dependency and Redis is already wired, so an obvious
 * alternative existed; it was not taken (ADR-0027). Delivery history has to be
 * durable and queryable regardless - the admin console's "failed deliveries"
 * and "retry" screens read exactly the rows a broker would otherwise
 * duplicate - and two stores would eventually disagree about whether a
 * message was sent. A row whose `nextAttemptAt` has elapsed *is* a queued job.
 *
 * Claiming is safe under concurrency: `claimDue` updates rows to `SENDING`
 * with the previous status in the `WHERE` clause, so two workers racing for
 * the same row produce one winner and one no-op.
 */
@Injectable()
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get maxAttempts(): number {
    return this.config.get<number>('notifications.maxAttempts') ?? 4
  }

  /** Creates the per-channel delivery rows for a notification. */
  async enqueue(
    notificationId: string,
    organizationId: string,
    channels: NotificationChannel[],
    availableAt: Date,
  ): Promise<void> {
    if (channels.length === 0) return

    await this.prisma.notificationDelivery.createMany({
      data: channels.map((channel) => ({
        notificationId,
        organizationId,
        channel,
        status: NotificationDeliveryStatus.PENDING,
        nextAttemptAt: availableAt,
      })),
      // A duplicated event that reached the same notification twice must not
      // double-send; the (notificationId, channel) unique index guarantees it.
      skipDuplicates: true,
    })
  }

  /** Marks a channel suppressed before any attempt. Never retried. */
  async skip(deliveryId: string, reason: string): Promise<void> {
    await this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: NotificationDeliveryStatus.SKIPPED,
        failureReason: reason,
        nextAttemptAt: null,
        lastAttemptAt: new Date(),
      },
    })
  }

  /**
   * Atomically claims up to `limit` deliveries that are due, moving them to
   * `SENDING` so a second worker cannot pick them up.
   */
  async claimDue(limit: number, now = new Date()): Promise<NotificationDelivery[]> {
    const candidates = await this.prisma.notificationDelivery.findMany({
      where: {
        status: { in: [NotificationDeliveryStatus.PENDING, NotificationDeliveryStatus.QUEUED] },
        nextAttemptAt: { lte: now },
      },
      orderBy: { nextAttemptAt: 'asc' },
      take: limit,
      select: { id: true, status: true },
    })

    const claimed: NotificationDelivery[] = []
    for (const candidate of candidates) {
      const result = await this.prisma.notificationDelivery.updateMany({
        where: { id: candidate.id, status: candidate.status },
        data: { status: NotificationDeliveryStatus.SENDING, lastAttemptAt: now },
      })
      if (result.count === 1) {
        const row = await this.prisma.notificationDelivery.findUnique({ where: { id: candidate.id } })
        if (row) claimed.push(row)
      }
    }

    return claimed
  }

  /**
   * Records one attempt's outcome and schedules the next one if the failure
   * was retryable and attempts remain.
   */
  async recordAttempt(
    delivery: Pick<NotificationDelivery, 'id' | 'attempts' | 'channel'>,
    result: ChannelSendResult,
    now = new Date(),
  ): Promise<NotificationDeliveryStatus> {
    const attempts = delivery.attempts + 1

    if (result.ok) {
      await this.prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: NotificationDeliveryStatus.SENT,
          attempts,
          sentAt: now,
          lastAttemptAt: now,
          nextAttemptAt: null,
          failureReason: null,
          providerName: result.providerName,
          providerMessageId: result.providerMessageId ?? null,
        },
      })
      return NotificationDeliveryStatus.SENT
    }

    const exhausted = !result.retryable || attempts >= this.maxAttempts
    const nextAttemptAt = exhausted ? null : new Date(now.getTime() + this.backoffMs(attempts))

    await this.prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: exhausted ? NotificationDeliveryStatus.FAILED : NotificationDeliveryStatus.QUEUED,
        attempts,
        lastAttemptAt: now,
        nextAttemptAt,
        failedAt: exhausted ? now : null,
        // When retries remain, the reason is kept too - the admin console can
        // then show *why* something is still retrying, not just that it is.
        failureReason: result.failureReason ?? 'Delivery failed',
        providerName: result.providerName,
      },
    })

    if (exhausted) {
      this.logger.warn(
        `Delivery ${delivery.id} (${delivery.channel}) failed permanently after ${attempts} attempt(s): ${result.failureReason}`,
      )
    }

    return exhausted ? NotificationDeliveryStatus.FAILED : NotificationDeliveryStatus.QUEUED
  }

  /**
   * Exponential backoff, capped. Deliberately not jittered: the worker already
   * processes a bounded batch on a fixed tick, so there is no thundering herd
   * to spread, and a predictable delay is far easier to reason about when
   * explaining a late notification.
   */
  backoffMs(attempt: number): number {
    const base = this.config.get<number>('notifications.retryBaseDelaySeconds') ?? 60
    const max = this.config.get<number>('notifications.retryMaxDelaySeconds') ?? 3600
    const seconds = Math.min(max, base * 2 ** Math.max(0, attempt - 1))
    return seconds * 1000
  }

  /**
   * Puts failed deliveries back in the queue (Checkpoint 18.6's "retry failed
   * notifications"). Attempts are **not** reset - an operator needs to see
   * that a message has now been tried seven times, and resetting the counter
   * would let a permanently broken destination retry forever.
   */
  async retryFailed(organizationId: string, deliveryIds?: string[]): Promise<number> {
    const where: Prisma.NotificationDeliveryWhereInput = {
      organizationId,
      status: NotificationDeliveryStatus.FAILED,
      ...(deliveryIds?.length ? { id: { in: deliveryIds } } : {}),
    }

    const result = await this.prisma.notificationDelivery.updateMany({
      where,
      data: {
        status: NotificationDeliveryStatus.QUEUED,
        nextAttemptAt: new Date(),
        failedAt: null,
      },
    })
    return result.count
  }

  /** Cancels every non-terminal delivery for a notification. */
  async cancel(notificationId: string): Promise<number> {
    const result = await this.prisma.notificationDelivery.updateMany({
      where: { notificationId, status: { notIn: TERMINAL } },
      data: { status: NotificationDeliveryStatus.CANCELLED, nextAttemptAt: null },
    })
    return result.count
  }

  async status(organizationId?: string, now = new Date()): Promise<NotificationQueueStatus> {
    const scope = organizationId ? { organizationId } : {}

    const [pending, queued, due, failed, scheduled, oldest] = await Promise.all([
      this.prisma.notificationDelivery.count({
        where: { ...scope, status: NotificationDeliveryStatus.PENDING },
      }),
      this.prisma.notificationDelivery.count({
        where: { ...scope, status: NotificationDeliveryStatus.QUEUED },
      }),
      this.prisma.notificationDelivery.count({
        where: {
          ...scope,
          status: { in: [NotificationDeliveryStatus.PENDING, NotificationDeliveryStatus.QUEUED] },
          nextAttemptAt: { lte: now },
        },
      }),
      this.prisma.notificationDelivery.count({
        where: { ...scope, status: NotificationDeliveryStatus.FAILED },
      }),
      this.prisma.notification.count({
        where: { ...scope, scheduleAt: { gt: now }, deliveryStatus: 'SCHEDULED' },
      }),
      this.prisma.notificationDelivery.findFirst({
        where: {
          ...scope,
          status: { in: [NotificationDeliveryStatus.PENDING, NotificationDeliveryStatus.QUEUED] },
        },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ])

    const workerEnabled = this.config.get<boolean>('notifications.workerEnabled') ?? false

    return {
      pending,
      queued,
      due,
      // A queued row with at least one attempt behind it is a retry, as
      // opposed to one that has simply not been picked up yet.
      retrying: await this.prisma.notificationDelivery.count({
        where: { ...scope, status: NotificationDeliveryStatus.QUEUED, attempts: { gt: 0 } },
      }),
      failed,
      scheduled,
      oldestPendingAt: oldest?.createdAt.toISOString() ?? null,
      workerEnabled,
      workerDisabledReason: workerEnabled
        ? null
        : 'The notification worker is disabled (NOTIFICATIONS_WORKER_ENABLED) - queued deliveries stay queued',
    }
  }
}
