import { NotificationCategory, NotificationChannel, NotificationPriority } from '@medicore/types'

/**
 * One channel's transport contract (Milestone 18 / ADR-0027).
 *
 * Deliberately narrow: a provider receives a fully-rendered message and a
 * resolved destination, and answers whether it left the building. It performs
 * no preference checks, no templating, no retry scheduling and no database
 * access — those belong to the dispatcher and the queue, so a second
 * implementation of any channel (a real SMS vendor, a mobile push service)
 * can be dropped in without re-deriving any of that logic.
 */
export interface ChannelSendRequest {
  organizationId: string
  notificationId: string
  /**
   * Where to send. Email address, E.164 phone number, or — for push — an
   * opaque label, since push fans out over `pushTokens` instead.
   */
  destination: string
  title: string
  body: string
  category: NotificationCategory
  priority: NotificationPriority
  /** Relative in-app route (`/dashboard/appointments/abc`), if any. */
  deepLink?: string | null
  imageUrl?: string | null
  icon?: string | null
  payload: Record<string, unknown>
  /** PUSH only — every active device token for the recipient. */
  pushTokens?: string[]
  recipientName?: string | null
}

export interface ChannelSendResult {
  ok: boolean
  providerName: string
  providerMessageId?: string
  /** Present when `ok` is false. Shown verbatim in the admin console. */
  failureReason?: string
  /**
   * Whether another attempt could plausibly succeed. A missing credential or
   * a rejected recipient is not retryable — retrying it burns the queue and
   * buries the real reason under attempt counts.
   */
  retryable: boolean
  /** PUSH only — tokens the provider reported as permanently gone. */
  invalidTokens?: string[]
}

export interface NotificationChannelProvider {
  readonly channel: NotificationChannel
  /** Adapter identity recorded on the delivery row (`resend`, `fcm`, `log`). */
  readonly providerName: string
  /** False means every delivery on this channel fails with `unconfiguredReason`. */
  isConfigured(): boolean
  /** Exactly what is missing. Null when configured. */
  unconfiguredReason(): string | null
  send(request: ChannelSendRequest): Promise<ChannelSendResult>
}

export const NOTIFICATION_CHANNEL_PROVIDERS = Symbol('NOTIFICATION_CHANNEL_PROVIDERS')

/** Convenience for adapters that cannot run at all. */
export function unconfigured(providerName: string, reason: string): ChannelSendResult {
  return { ok: false, providerName, failureReason: reason, retryable: false }
}
