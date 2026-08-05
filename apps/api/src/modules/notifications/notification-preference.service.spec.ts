import {
  EmailDigestFrequency,
  NotificationCategory,
  NotificationChannel,
  NotificationPreference,
  NotificationPriority,
} from '@medicore/types'

import { NotificationPreferenceService, isWithinQuietHours } from './notification-preference.service'

const service = new NotificationPreferenceService({} as never)

function preference(overrides: Partial<NotificationPreference> = {}): NotificationPreference {
  return {
    userId: 'user-1',
    inAppEnabled: true,
    emailEnabled: true,
    pushEnabled: true,
    smsEnabled: false,
    whatsappEnabled: false,
    emailFrequency: EmailDigestFrequency.IMMEDIATE,
    quietHoursStart: null,
    quietHoursEnd: null,
    timezone: 'Asia/Kolkata',
    categoryPreferences: {},
    updatedAt: null,
    ...overrides,
  }
}

/** 2026-08-06 23:30 IST — inside a 22:00–07:00 window. */
const LATE_NIGHT_IST = new Date('2026-08-06T18:00:00.000Z')
/** 2026-08-06 15:30 IST — comfortably outside it. */
const AFTERNOON_IST = new Date('2026-08-06T10:00:00.000Z')

describe('isWithinQuietHours', () => {
  it('matches inside a window that wraps midnight', () => {
    const pref = preference({ quietHoursStart: '22:00', quietHoursEnd: '07:00' })
    expect(isWithinQuietHours(pref, LATE_NIGHT_IST)).toBe(true)
    expect(isWithinQuietHours(pref, AFTERNOON_IST)).toBe(false)
  })

  it('matches inside a same-day window', () => {
    const pref = preference({ quietHoursStart: '13:00', quietHoursEnd: '17:00' })
    expect(isWithinQuietHours(pref, AFTERNOON_IST)).toBe(true)
    expect(isWithinQuietHours(pref, LATE_NIGHT_IST)).toBe(false)
  })

  it('evaluates the window in the user’s own zone, not the server’s', () => {
    // The same instant is 18:00 UTC and 23:30 IST. A 22:00–07:00 window is
    // therefore active for the IST user and not for the UTC one.
    const ist = preference({ quietHoursStart: '22:00', quietHoursEnd: '07:00', timezone: 'Asia/Kolkata' })
    const utc = preference({ quietHoursStart: '22:00', quietHoursEnd: '07:00', timezone: 'UTC' })
    expect(isWithinQuietHours(ist, LATE_NIGHT_IST)).toBe(true)
    expect(isWithinQuietHours(utc, LATE_NIGHT_IST)).toBe(false)
  })

  it('is inactive when only one bound is set, or when the bounds are equal', () => {
    expect(isWithinQuietHours(preference({ quietHoursStart: '22:00' }), LATE_NIGHT_IST)).toBe(false)
    expect(isWithinQuietHours(preference({ quietHoursEnd: '07:00' }), LATE_NIGHT_IST)).toBe(false)
    expect(
      isWithinQuietHours(preference({ quietHoursStart: '22:00', quietHoursEnd: '22:00' }), LATE_NIGHT_IST),
    ).toBe(false)
  })

  it('falls back to UTC rather than throwing on an unusable stored zone', () => {
    const pref = preference({ quietHoursStart: '17:00', quietHoursEnd: '19:00', timezone: 'Not/AZone' })
    // 18:00 UTC falls inside 17:00–19:00 read as UTC.
    expect(isWithinQuietHours(pref, LATE_NIGHT_IST)).toBe(true)
  })
})

describe('NotificationPreferenceService.decide', () => {
  const decide = (
    pref: NotificationPreference,
    channel: NotificationChannel,
    priority = NotificationPriority.NORMAL,
    category = NotificationCategory.APPOINTMENT,
    at = AFTERNOON_IST,
  ) => service.decide(pref, channel, category, priority, at)

  it('allows a normal notification on an enabled channel', () => {
    expect(decide(preference(), NotificationChannel.EMAIL).allowed).toBe(true)
  })

  it('suppresses a disabled channel and says which one', () => {
    const decision = decide(preference({ emailEnabled: false }), NotificationChannel.EMAIL)
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toContain('EMAIL')
  })

  it('suppresses a muted category', () => {
    const pref = preference({
      categoryPreferences: { [NotificationCategory.APPOINTMENT]: { enabled: false } },
    })
    expect(decide(pref, NotificationChannel.EMAIL).allowed).toBe(false)
  })

  it('honours a per-category channel allow-list', () => {
    const pref = preference({
      categoryPreferences: {
        [NotificationCategory.APPOINTMENT]: { enabled: true, channels: [NotificationChannel.IN_APP] },
      },
    })
    expect(decide(pref, NotificationChannel.IN_APP).allowed).toBe(true)
    expect(decide(pref, NotificationChannel.EMAIL).allowed).toBe(false)
  })

  it('suppresses non-critical traffic during quiet hours', () => {
    const pref = preference({ quietHoursStart: '22:00', quietHoursEnd: '07:00' })
    const decision = decide(pref, NotificationChannel.PUSH, NotificationPriority.HIGH, undefined, LATE_NIGHT_IST)
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toContain('Quiet hours')
  })

  it('lets CRITICAL through quiet hours, a muted category and a disabled channel', () => {
    const pref = preference({
      emailEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      categoryPreferences: { [NotificationCategory.LABORATORY]: { enabled: false } },
    })
    const decision = service.decide(
      pref,
      NotificationChannel.EMAIL,
      NotificationCategory.LABORATORY,
      NotificationPriority.CRITICAL,
      LATE_NIGHT_IST,
    )
    expect(decision.allowed).toBe(true)
  })

  it('keeps SILENT in-app only', () => {
    const pref = preference()
    expect(decide(pref, NotificationChannel.IN_APP, NotificationPriority.SILENT).allowed).toBe(true)
    expect(decide(pref, NotificationChannel.PUSH, NotificationPriority.SILENT).allowed).toBe(false)
    expect(decide(pref, NotificationChannel.EMAIL, NotificationPriority.SILENT).allowed).toBe(false)
  })

  it('respects an explicit opt-out of notification email', () => {
    const pref = preference({ emailFrequency: EmailDigestFrequency.NEVER })
    expect(decide(pref, NotificationChannel.EMAIL).allowed).toBe(false)
    // Other channels are unaffected by an email-frequency choice.
    expect(decide(pref, NotificationChannel.PUSH).allowed).toBe(true)
  })
})

describe('NotificationPreferenceService defaults', () => {
  it('returns working defaults for a user with no stored row', async () => {
    const prisma = {
      notificationPreference: { findUnique: jest.fn().mockResolvedValue(null) },
      user: { findUnique: jest.fn().mockResolvedValue({ timezone: 'Europe/London' }) },
    }
    const withPrisma = new NotificationPreferenceService(prisma as never)

    const result = await withPrisma.get('org-1', 'user-9')

    // Absence must mean "notifications work", never "notifications are off".
    expect(result.inAppEnabled).toBe(true)
    expect(result.emailEnabled).toBe(true)
    expect(result.pushEnabled).toBe(true)
    expect(result.quietHoursStart).toBeNull()
    // The user's own profile timezone seeds the quiet-hours zone.
    expect(result.timezone).toBe('Europe/London')
    expect(result.updatedAt).toBeNull()
  })
})
