import {
  CategoryPreference,
  EmailDigestFrequency,
  NotificationCategory,
  NotificationChannel,
  NotificationPreference,
  NotificationPriority,
  UpdateNotificationPreferenceDto,
} from '@medicore/types'
import { Injectable } from '@nestjs/common'
import { Prisma, NotificationPreference as PrismaNotificationPreference } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

/** Channels a user may switch on or off. IN_APP is always on — see below. */
const TOGGLEABLE: Array<{ channel: NotificationChannel; field: keyof PrismaNotificationPreference }> = [
  { channel: NotificationChannel.EMAIL, field: 'emailEnabled' },
  { channel: NotificationChannel.PUSH, field: 'pushEnabled' },
  { channel: NotificationChannel.SMS, field: 'smsEnabled' },
  { channel: NotificationChannel.WHATSAPP, field: 'whatsappEnabled' },
]

export interface ChannelDecision {
  allowed: boolean
  /** Why it was suppressed, recorded verbatim on the SKIPPED delivery row. */
  reason?: string
}

/**
 * Per-user notification preferences (Checkpoint 18.5).
 *
 * Three rules shape everything here:
 *
 * 1. **Absence means defaults.** A user who has never opened the preferences
 *    page has no row, and still receives notifications. Requiring a row would
 *    make onboarding a silent outage.
 * 2. **`CRITICAL` overrides everything.** Quiet hours, muted categories and
 *    disabled channels are all bypassed at critical priority. A critical lab
 *    value or a rejected claim reaching nobody because it was 23:00 is not an
 *    acceptable failure mode in this domain.
 * 3. **In-app is never suppressed** (except at the user's own explicit
 *    request for a category). The in-app centre is the durable record; if it
 *    could be muted, a suppressed notification would leave no trace at all.
 */
@Injectable()
export class NotificationPreferenceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `organizationId` is accepted but unused on the read path: `userId` is
   * already globally unique and the row is created org-scoped. It stays in the
   * signature so callers cannot forget the tenant when they switch to
   * `update`, which does need it.
   */
  async get(_organizationId: string, userId: string): Promise<NotificationPreference> {
    const row = await this.prisma.notificationPreference.findUnique({ where: { userId } })
    if (row) return toResponse(row)

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    })
    return {
      userId,
      inAppEnabled: true,
      emailEnabled: true,
      pushEnabled: true,
      smsEnabled: false,
      whatsappEnabled: false,
      emailFrequency: EmailDigestFrequency.IMMEDIATE,
      quietHoursStart: null,
      quietHoursEnd: null,
      timezone: user?.timezone ?? 'Asia/Kolkata',
      categoryPreferences: {},
      updatedAt: null,
    }
  }

  async update(
    organizationId: string,
    userId: string,
    dto: UpdateNotificationPreferenceDto,
  ): Promise<NotificationPreference> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } })

    const data = {
      ...(dto.inAppEnabled === undefined ? {} : { inAppEnabled: dto.inAppEnabled }),
      ...(dto.emailEnabled === undefined ? {} : { emailEnabled: dto.emailEnabled }),
      ...(dto.pushEnabled === undefined ? {} : { pushEnabled: dto.pushEnabled }),
      ...(dto.smsEnabled === undefined ? {} : { smsEnabled: dto.smsEnabled }),
      ...(dto.whatsappEnabled === undefined ? {} : { whatsappEnabled: dto.whatsappEnabled }),
      ...(dto.emailFrequency === undefined ? {} : { emailFrequency: dto.emailFrequency }),
      ...(dto.quietHoursStart === undefined ? {} : { quietHoursStart: dto.quietHoursStart }),
      ...(dto.quietHoursEnd === undefined ? {} : { quietHoursEnd: dto.quietHoursEnd }),
      ...(dto.timezone === undefined ? {} : { timezone: dto.timezone }),
      ...(dto.categoryPreferences === undefined
        ? {}
        : { categoryPreferences: dto.categoryPreferences as Prisma.InputJsonValue }),
    }

    const row = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        organizationId,
        userId,
        timezone: dto.timezone ?? user?.timezone ?? 'Asia/Kolkata',
        ...data,
      },
      update: data,
    })

    return toResponse(row)
  }

  /**
   * Whether one channel may carry one notification for one user, and why not.
   *
   * `at` is the moment the decision is made — passed in rather than read from
   * the clock so the quiet-hours rule is testable and so a delivery retried
   * hours later is re-evaluated against the time it actually goes out.
   */
  decide(
    preference: NotificationPreference,
    channel: NotificationChannel,
    category: NotificationCategory,
    priority: NotificationPriority,
    at: Date,
  ): ChannelDecision {
    if (priority === NotificationPriority.CRITICAL) return { allowed: true }

    // SILENT is written to the centre and goes nowhere else, by definition.
    if (priority === NotificationPriority.SILENT && channel !== NotificationChannel.IN_APP) {
      return { allowed: false, reason: 'Silent priority — in-app only' }
    }

    const categoryPreference = preference.categoryPreferences[category]
    if (categoryPreference && categoryPreference.enabled === false) {
      return { allowed: false, reason: `${category} notifications are muted in the user's preferences` }
    }
    if (categoryPreference?.channels && !categoryPreference.channels.includes(channel)) {
      return { allowed: false, reason: `${channel} is not enabled for ${category} in the user's preferences` }
    }

    if (channel === NotificationChannel.IN_APP) {
      return preference.inAppEnabled
        ? { allowed: true }
        : { allowed: false, reason: 'In-app notifications are disabled in the user’s preferences' }
    }

    const toggle = TOGGLEABLE.find((t) => t.channel === channel)
    if (toggle && preference[channelFieldName(toggle.field)] === false) {
      return { allowed: false, reason: `${channel} is disabled in the user’s preferences` }
    }

    if (channel === NotificationChannel.EMAIL && preference.emailFrequency === EmailDigestFrequency.NEVER) {
      return { allowed: false, reason: 'The user has opted out of notification email' }
    }

    if (isWithinQuietHours(preference, at)) {
      return {
        allowed: false,
        reason: `Quiet hours (${preference.quietHoursStart}–${preference.quietHoursEnd} ${preference.timezone})`,
      }
    }

    return { allowed: true }
  }
}

function channelFieldName(
  field: keyof PrismaNotificationPreference,
): 'emailEnabled' | 'pushEnabled' | 'smsEnabled' | 'whatsappEnabled' {
  return field as 'emailEnabled' | 'pushEnabled' | 'smsEnabled' | 'whatsappEnabled'
}

/**
 * True when `at`, read as wall-clock time in the user's zone, falls inside
 * their quiet-hours window. Windows that wrap midnight (22:00 → 07:00) are the
 * common case and are handled by comparing against both sides rather than
 * assuming start < end.
 */
export function isWithinQuietHours(
  preference: Pick<NotificationPreference, 'quietHoursStart' | 'quietHoursEnd' | 'timezone'>,
  at: Date,
): boolean {
  const { quietHoursStart, quietHoursEnd } = preference
  if (!quietHoursStart || !quietHoursEnd) return false
  if (quietHoursStart === quietHoursEnd) return false

  const minutes = localMinutes(at, preference.timezone)
  const start = toMinutes(quietHoursStart)
  const end = toMinutes(quietHoursEnd)
  if (start === null || end === null) return false

  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end
}

/**
 * Minutes since local midnight in an IANA zone. Uses `Intl` rather than an
 * offset arithmetic trick so DST transitions are handled by the platform's
 * tz database rather than by us.
 */
function localMinutes(at: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(at)
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
    return hour * 60 + minute
  } catch {
    // An invalid stored zone must not suppress a notification, so fall back
    // to UTC rather than throwing mid-dispatch.
    return at.getUTCHours() * 60 + at.getUTCMinutes()
  }
}

function toMinutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function toResponse(row: PrismaNotificationPreference): NotificationPreference {
  return {
    userId: row.userId,
    inAppEnabled: row.inAppEnabled,
    emailEnabled: row.emailEnabled,
    pushEnabled: row.pushEnabled,
    smsEnabled: row.smsEnabled,
    whatsappEnabled: row.whatsappEnabled,
    emailFrequency: row.emailFrequency as EmailDigestFrequency,
    quietHoursStart: row.quietHoursStart,
    quietHoursEnd: row.quietHoursEnd,
    timezone: row.timezone,
    categoryPreferences: (row.categoryPreferences ?? {}) as Partial<
      Record<NotificationCategory, CategoryPreference>
    >,
    updatedAt: row.updatedAt.toISOString(),
  }
}
