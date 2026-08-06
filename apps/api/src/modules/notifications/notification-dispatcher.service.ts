import {
  NotificationCategory,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationPriority,
  NotificationStatus,
} from '@medicore/types'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NotificationDelivery } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import {
  ChannelSendRequest,
  NOTIFICATION_CHANNEL_PROVIDERS,
  NotificationChannelProvider,
} from './channels/channel-provider.interface'
import { NotificationPreferenceService } from './notification-preference.service'
import { NotificationQueueService } from './notification-queue.service'
import { UserDeviceService } from './user-device.service'

/**
 * Turns a queued delivery into an actual send (Checkpoint 18.1).
 *
 * The order of operations matters and is deliberate:
 *
 * 1. **Preferences are evaluated at dispatch time, not at creation time.** A
 *    delivery retried three hours later is re-checked against quiet hours as
 *    they are *then*, and a user who mutes a category between the event and
 *    the retry is respected.
 * 2. **A suppressed channel is `SKIPPED`, never `FAILED`.** Nothing was
 *    attempted, so counting it as a failure would corrupt the delivery
 *    success rate the admin console reports.
 * 3. **The notification's aggregate status is derived, never set directly**,
 *    so it cannot drift from the delivery rows it summarises.
 */
@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly queue: NotificationQueueService,
    private readonly preferences: NotificationPreferenceService,
    private readonly devices: UserDeviceService,
    @Inject(NOTIFICATION_CHANNEL_PROVIDERS)
    private readonly providers: NotificationChannelProvider[],
  ) {}

  provider(channel: NotificationChannel): NotificationChannelProvider | undefined {
    return this.providers.find((p) => p.channel === channel)
  }

  /** Every adapter's configuration state, for the admin/platform console. */
  providerStatuses() {
    return this.providers.map((p) => ({
      channel: p.channel,
      providerName: p.providerName,
      configured: p.isConfigured(),
      reason: p.unconfiguredReason(),
    }))
  }

  /** Dispatches a batch of claimed deliveries. Never throws. */
  async dispatchMany(deliveries: NotificationDelivery[], now = new Date()): Promise<void> {
    for (const delivery of deliveries) {
      try {
        await this.dispatchOne(delivery, now)
      } catch (error) {
        // A dispatcher bug must not wedge the queue: record it as an attempt
        // so backoff applies and the reason is visible, then keep going.
        this.logger.error(
          `Dispatch of delivery ${delivery.id} threw: ${(error as Error).message}`,
          (error as Error).stack,
        )
        await this.queue.recordAttempt(
          delivery,
          {
            ok: false,
            providerName: delivery.channel.toLowerCase(),
            failureReason: `Dispatcher error: ${(error as Error).message}`,
            retryable: true,
          },
          now,
        )
        await this.refreshNotificationStatus(delivery.notificationId)
      }
    }
  }

  async dispatchOne(delivery: NotificationDelivery, now = new Date()): Promise<void> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: delivery.notificationId },
      include: {
        recipient: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } },
        patient: { select: { email: true, phone: true, firstName: true, lastName: true } },
      },
    })

    if (!notification) {
      await this.queue.skip(delivery.id, 'The notification no longer exists')
      return
    }

    if (!this.config.get<boolean>('notifications.enabled')) {
      await this.queue.skip(delivery.id, 'Notifications are disabled (NOTIFICATIONS_ENABLED=false)')
      await this.refreshNotificationStatus(notification.id)
      return
    }

    const channel = delivery.channel as NotificationChannel
    const provider = this.provider(channel)
    if (!provider) {
      await this.queue.skip(delivery.id, `No provider is registered for ${channel}`)
      await this.refreshNotificationStatus(notification.id)
      return
    }

    // Preference gate - staff recipients only. A patient-addressed message has
    // no user account and therefore no preferences; it is governed by the
    // channels the calling module chose, not by a preferences row.
    if (notification.recipientId) {
      const preference = await this.preferences.get(notification.organizationId, notification.recipientId)
      const decision = this.preferences.decide(
        preference,
        channel,
        notification.category as NotificationCategory,
        notification.priority as NotificationPriority,
        now,
      )
      if (!decision.allowed) {
        await this.queue.skip(delivery.id, decision.reason ?? 'Suppressed by the user’s preferences')
        await this.refreshNotificationStatus(notification.id)
        return
      }
    }

    const destination = this.resolveDestination(channel, notification)
    let pushTokens: string[] | undefined
    if (channel === NotificationChannel.PUSH && notification.recipientId) {
      pushTokens = await this.devices.activeTokens(notification.recipientId)
    }

    const request: ChannelSendRequest = {
      organizationId: notification.organizationId,
      notificationId: notification.id,
      destination: destination ?? '',
      title: notification.title,
      body: notification.body,
      category: notification.category as NotificationCategory,
      priority: notification.priority as NotificationPriority,
      deepLink: notification.deepLink,
      imageUrl: notification.imageUrl,
      icon: notification.icon,
      payload: (notification.payload ?? {}) as Record<string, unknown>,
      pushTokens,
      recipientName: notification.recipient
        ? `${notification.recipient.firstName} ${notification.recipient.lastName}`
        : notification.patient
          ? `${notification.patient.firstName} ${notification.patient.lastName}`
          : null,
    }

    const result = await provider.send(request)

    if (result.invalidTokens?.length) {
      await this.devices.markTokensInvalid(result.invalidTokens)
    }

    await this.prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: { destination: destination ?? null },
    })
    await this.queue.recordAttempt(delivery, result, now)
    await this.refreshNotificationStatus(notification.id)
  }

  /**
   * Recomputes the notification's aggregate status from its delivery rows.
   *
   * `READ` is sticky: once a user has read a notification, a later retry
   * succeeding must not walk the status back to `SENT` and make it look
   * unread in the history view.
   */
  async refreshNotificationStatus(notificationId: string): Promise<void> {
    const [notification, deliveries] = await Promise.all([
      this.prisma.notification.findUnique({
        where: { id: notificationId },
        select: { isRead: true, deliveryStatus: true },
      }),
      this.prisma.notificationDelivery.findMany({
        where: { notificationId },
        select: { status: true, sentAt: true, failureReason: true, attempts: true },
      }),
    ])
    if (!notification) return

    const counts = countByStatus(deliveries.map((d) => d.status as NotificationDeliveryStatus))
    const attempted = deliveries.length - counts.SKIPPED - counts.CANCELLED
    const succeeded = counts.SENT + counts.DELIVERED
    const failed = counts.FAILED
    const inFlight = counts.PENDING + counts.QUEUED + counts.SENDING

    let status: NotificationStatus
    if (deliveries.length === 0) {
      status = NotificationStatus.PENDING
    } else if (attempted === 0) {
      // Every channel was suppressed. The in-app record still exists, so this
      // is not a failure - it is a notification that reached nobody by design.
      status = NotificationStatus.CANCELLED
    } else if (inFlight > 0) {
      status = NotificationStatus.QUEUED
    } else if (succeeded > 0 && failed > 0) {
      status = NotificationStatus.PARTIALLY_SENT
    } else if (succeeded > 0) {
      status = NotificationStatus.SENT
    } else {
      status = NotificationStatus.FAILED
    }

    if (notification.isRead) status = NotificationStatus.READ

    const firstFailure = deliveries.find((d) => d.failureReason)?.failureReason ?? null
    const sentAt = deliveries.map((d) => d.sentAt).filter(Boolean).sort()[0] ?? null

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        deliveryStatus: status,
        retryCount: deliveries.reduce((sum, d) => sum + d.attempts, 0),
        failureReason: failed > 0 ? firstFailure : null,
        ...(sentAt ? { sentAt } : {}),
      },
    })
  }

  private resolveDestination(
    channel: NotificationChannel,
    notification: {
      recipient: { email: string; phone: string | null } | null
      patient: { email: string | null; phone: string | null } | null
    },
  ): string | null {
    switch (channel) {
      case NotificationChannel.EMAIL:
        return notification.recipient?.email ?? notification.patient?.email ?? null
      case NotificationChannel.SMS:
      case NotificationChannel.WHATSAPP:
        return notification.recipient?.phone ?? notification.patient?.phone ?? null
      case NotificationChannel.PUSH:
        return 'push-devices'
      case NotificationChannel.IN_APP:
      default:
        return 'in-app'
    }
  }
}

function countByStatus(statuses: NotificationDeliveryStatus[]): Record<NotificationDeliveryStatus, number> {
  const counts = {
    PENDING: 0,
    QUEUED: 0,
    SENDING: 0,
    SENT: 0,
    DELIVERED: 0,
    FAILED: 0,
    SKIPPED: 0,
    CANCELLED: 0,
  } as Record<NotificationDeliveryStatus, number>
  for (const status of statuses) counts[status] += 1
  return counts
}
