import { registerAs } from '@nestjs/config'

/**
 * Communication & Notification Platform configuration (Milestone 18 / ADR-0027).
 *
 * Mirrors `ai.config.ts`'s placeholder handling: a value made of repeated `x`s
 * is a `.env.example` leftover, not a credential. Treating one as configured
 * would produce provider 401s that read like an outage instead of what they
 * are - nothing set up. Every channel therefore reports an honest
 * "not configured" and the delivery is recorded FAILED with that reason,
 * never marked sent (the same line TD-0015/TD-0027/TD-0041 already hold).
 */
const PLACEHOLDER = /^x{6,}$|^changeme$|^your[-_]/i

export function realValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed || PLACEHOLDER.test(trimmed)) return undefined
  return trimmed
}

function toInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function toBool(value: string | undefined, fallback: boolean): boolean {
  const trimmed = value?.trim().toLowerCase()
  if (trimmed === undefined || trimmed === '') return fallback
  return trimmed === 'true' || trimmed === '1' || trimmed === 'yes'
}

export default registerAs('notifications', () => ({
  /**
   * Global kill switch, mirroring `AI_ENABLED`. When false the platform still
   * *records* notifications (so nothing is lost) but dispatches nothing.
   */
  enabled: toBool(process.env.NOTIFICATIONS_ENABLED, true),

  /**
   * The background worker that drains the retry queue and releases scheduled
   * notifications. Off under `NODE_ENV=test` by default so unit and e2e runs
   * are deterministic - a timer firing mid-assertion is the classic source of
   * a flaky suite.
   */
  workerEnabled: toBool(process.env.NOTIFICATIONS_WORKER_ENABLED, process.env.NODE_ENV !== 'test'),
  /** How often the worker ticks. */
  workerIntervalMs: toInt(process.env.NOTIFICATIONS_WORKER_INTERVAL_MS, 30_000),
  /** Deliveries claimed per tick - bounds one tick's blast radius. */
  workerBatchSize: toInt(process.env.NOTIFICATIONS_WORKER_BATCH, 50),

  /** Attempts per channel before a delivery is FAILED for good. */
  maxAttempts: toInt(process.env.NOTIFICATIONS_MAX_ATTEMPTS, 4),
  /** First retry delay; doubles each attempt (60s → 120s → 240s …). */
  retryBaseDelaySeconds: toInt(process.env.NOTIFICATIONS_RETRY_BASE_SECONDS, 60),
  retryMaxDelaySeconds: toInt(process.env.NOTIFICATIONS_RETRY_MAX_SECONDS, 3600),

  /** Hours before an appointment that a reminder is scheduled. */
  appointmentReminderHours: toInt(process.env.NOTIFICATIONS_APPOINTMENT_REMINDER_HOURS, 24),

  /** Base URL used to build absolute links inside emails. */
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',

  /**
   * Firebase Cloud Messaging (Checkpoint 18.2). The three service-account
   * fields are what FCM's HTTP v1 API needs to mint an OAuth2 token; the
   * VAPID public key is what the *browser* needs to subscribe. Push is
   * "configured" only when all four are present - a half-set of credentials
   * cannot deliver anything and should say so rather than fail at send time.
   */
  fcm: {
    projectId: realValue(process.env.FCM_PROJECT_ID),
    clientEmail: realValue(process.env.FCM_CLIENT_EMAIL),
    // Stored with literal `\n` escapes in .env, as Google's JSON does.
    privateKey: realValue(process.env.FCM_PRIVATE_KEY)?.replace(/\\n/g, '\n'),
    vapidPublicKey: realValue(process.env.FCM_VAPID_PUBLIC_KEY),
  },

  /**
   * SMS and WhatsApp are provider abstractions only, by explicit instruction
   * for this milestone - no paid provider is integrated. `LOG` writes the
   * message to the application log and marks the delivery SENT with
   * `providerName: 'log'`, which is honest in development and must never be
   * used in production; anything else reports "not configured" and fails the
   * delivery with that reason.
   */
  sms: {
    driver: (realValue(process.env.SMS_DRIVER) ?? 'NONE').toUpperCase(),
    senderId: realValue(process.env.SMS_SENDER_ID),
  },
  whatsapp: {
    driver: (realValue(process.env.WHATSAPP_DRIVER) ?? 'NONE').toUpperCase(),
    senderId: realValue(process.env.WHATSAPP_SENDER_ID),
  },
}))
