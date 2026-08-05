import { NotificationStatus } from '@medicore/types'
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EventEmitter2 } from '@nestjs/event-emitter'

import { PrismaService } from '../../prisma/prisma.service'

import { NotificationDispatcherService } from './notification-dispatcher.service'
import { NotificationQueueService } from './notification-queue.service'

/**
 * The background worker (Checkpoint 18.1).
 *
 * One `setInterval` rather than a scheduling library: the only thing that
 * needs scheduling is "drain what is due", the due-time already lives on each
 * delivery row, and adding `@nestjs/schedule` or a BullMQ worker would put
 * cron state somewhere other than the queue it drives (ADR-0027).
 *
 * Two safeguards make a timer safe here:
 *
 * - **Off under `NODE_ENV=test` by default.** A tick firing between an e2e
 *   request and its assertion is the classic source of a flaky suite, so the
 *   tests drive `tick()` explicitly instead.
 * - **Non-overlapping.** A tick that runs long is never re-entered; the next
 *   one is skipped rather than queued, so a slow provider cannot pile up
 *   concurrent drains.
 *
 * Each tick also emits `notifications.tick`, which is how work that belongs to
 * another module (the scheduled-report dispatcher in `modules/reports/`) hangs
 * off this clock without `NotificationsModule` importing it.
 */
@Injectable()
export class NotificationSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationSchedulerService.name)
  private timer: NodeJS.Timeout | null = null
  private running = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly queue: NotificationQueueService,
    private readonly dispatcher: NotificationDispatcherService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  onModuleInit(): void {
    if (!this.config.get<boolean>('notifications.workerEnabled')) {
      this.logger.log('Notification worker is disabled — queued deliveries will not be dispatched')
      return
    }

    const interval = this.config.get<number>('notifications.workerIntervalMs') ?? 30_000
    this.timer = setInterval(() => {
      void this.tick()
    }, interval)
    // Never hold the process open for a tick — the API's lifecycle owns that.
    this.timer.unref?.()
    this.logger.log(`Notification worker started (every ${Math.round(interval / 1000)}s)`)
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  /**
   * One pass: release due scheduled notifications, dispatch due deliveries,
   * then let other modules do their own scheduled work.
   *
   * Public and awaitable so tests exercise the real path rather than a
   * test-only shortcut.
   */
  async tick(now = new Date()): Promise<{ released: number; dispatched: number }> {
    if (this.running) {
      this.logger.debug('Skipping tick — the previous one is still running')
      return { released: 0, dispatched: 0 }
    }
    this.running = true

    try {
      const released = await this.releaseScheduled(now)

      const batchSize = this.config.get<number>('notifications.workerBatchSize') ?? 50
      const due = await this.queue.claimDue(batchSize, now)
      if (due.length > 0) {
        await this.dispatcher.dispatchMany(due, now)
      }

      // Emitted even on an empty tick: a listener whose own schedule is
      // independent of the queue (scheduled reports) still needs the clock.
      this.eventEmitter.emit('notifications.tick', { at: now })

      if (released > 0 || due.length > 0) {
        this.logger.debug(`Tick released ${released} scheduled and dispatched ${due.length} deliveries`)
      }
      return { released, dispatched: due.length }
    } catch (error) {
      // A tick must never take the process down; the next one retries.
      this.logger.error(`Notification tick failed: ${(error as Error).message}`, (error as Error).stack)
      return { released: 0, dispatched: 0 }
    } finally {
      this.running = false
    }
  }

  /**
   * Moves notifications whose `scheduleAt` has arrived from `SCHEDULED` to
   * `PENDING`. Their delivery rows were already enqueued with
   * `nextAttemptAt = scheduleAt`, so this only corrects the notification's own
   * status — which is what keeps a future-dated message out of the recipient's
   * centre until it is actually due.
   */
  private async releaseScheduled(now: Date): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { deliveryStatus: NotificationStatus.SCHEDULED, scheduleAt: { lte: now } },
      data: { deliveryStatus: NotificationStatus.PENDING },
    })
    return result.count
  }
}
