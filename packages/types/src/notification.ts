import { z } from 'zod'

// Communication & Notification Platform (Milestone 18 / ADR-0027).
//
// Every module in MediCore notifies through this one surface. The shapes here
// describe the *message* and its *delivery*, never the domain event that
// produced it - an event listener translates its own module's payload into a
// send call, and nothing about billing, laboratory or IPD leaks into this file.

// ─── Enums (mirror the Prisma enums of the same name) ───────────────────────

export enum NotificationType {
  APPOINTMENT_BOOKED = 'APPOINTMENT_BOOKED',
  APPOINTMENT_REMINDER = 'APPOINTMENT_REMINDER',
  APPOINTMENT_CONFIRMED = 'APPOINTMENT_CONFIRMED',
  APPOINTMENT_CANCELLED = 'APPOINTMENT_CANCELLED',
  ENCOUNTER_CREATED = 'ENCOUNTER_CREATED',
  ENCOUNTER_UPDATED = 'ENCOUNTER_UPDATED',
  LAB_SAMPLE_COLLECTED = 'LAB_SAMPLE_COLLECTED',
  LAB_RESULT_READY = 'LAB_RESULT_READY',
  RADIOLOGY_REPORT_RELEASED = 'RADIOLOGY_REPORT_RELEASED',
  INVOICE_GENERATED = 'INVOICE_GENERATED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  PREAUTH_APPROVED = 'PREAUTH_APPROVED',
  CLAIM_APPROVED = 'CLAIM_APPROVED',
  CLAIM_REJECTED = 'CLAIM_REJECTED',
  PRESCRIPTION_READY = 'PRESCRIPTION_READY',
  MEDICINE_DISPENSED = 'MEDICINE_DISPENSED',
  INVENTORY_LOW_STOCK = 'INVENTORY_LOW_STOCK',
  INVENTORY_REORDER_LEVEL = 'INVENTORY_REORDER_LEVEL',
  IPD_ADMITTED = 'IPD_ADMITTED',
  IPD_TRANSFERRED = 'IPD_TRANSFERRED',
  IPD_DISCHARGED = 'IPD_DISCHARGED',
  DISCHARGE_SUMMARY = 'DISCHARGE_SUMMARY',
  STAFF_LEAVE_APPROVED = 'STAFF_LEAVE_APPROVED',
  STAFF_SHIFT_ASSIGNED = 'STAFF_SHIFT_ASSIGNED',
  SCHEDULED_REPORT_READY = 'SCHEDULED_REPORT_READY',
  ORGANIZATION_ONBOARDED = 'ORGANIZATION_ONBOARDED',
  HOSPITAL_CREATED = 'HOSPITAL_CREATED',
  CUSTOM = 'CUSTOM',
}

export enum NotificationCategory {
  APPOINTMENT = 'APPOINTMENT',
  CLINICAL = 'CLINICAL',
  LABORATORY = 'LABORATORY',
  RADIOLOGY = 'RADIOLOGY',
  BILLING = 'BILLING',
  INSURANCE = 'INSURANCE',
  PHARMACY = 'PHARMACY',
  INVENTORY = 'INVENTORY',
  IPD = 'IPD',
  STAFF = 'STAFF',
  REPORTS = 'REPORTS',
  PLATFORM = 'PLATFORM',
  SYSTEM = 'SYSTEM',
}

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
  IN_APP = 'IN_APP',
  WHATSAPP = 'WHATSAPP',
}

export enum NotificationPriority {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  NORMAL = 'NORMAL',
  LOW = 'LOW',
  SILENT = 'SILENT',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SCHEDULED = 'SCHEDULED',
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  PARTIALLY_SENT = 'PARTIALLY_SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  READ = 'READ',
}

export enum NotificationDeliveryStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  SENDING = 'SENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
  CANCELLED = 'CANCELLED',
}

export enum EmailDigestFrequency {
  IMMEDIATE = 'IMMEDIATE',
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  NEVER = 'NEVER',
}

export enum DevicePlatform {
  WEB = 'WEB',
  ANDROID = 'ANDROID',
  IOS = 'IOS',
}

/** Every channel, in the order the dispatcher attempts them. */
export const NOTIFICATION_CHANNELS = [
  NotificationChannel.IN_APP,
  NotificationChannel.PUSH,
  NotificationChannel.EMAIL,
  NotificationChannel.SMS,
  NotificationChannel.WHATSAPP,
] as const

export const NOTIFICATION_CATEGORIES = Object.values(NotificationCategory)

// ─── Read models ────────────────────────────────────────────────────────────

export interface NotificationDeliveryRecord {
  id: string
  channel: NotificationChannel
  status: NotificationDeliveryStatus
  destination: string | null
  attempts: number
  nextAttemptAt: string | null
  lastAttemptAt: string | null
  sentAt: string | null
  deliveredAt: string | null
  failedAt: string | null
  failureReason: string | null
  providerName: string | null
  providerMessageId: string | null
}

export interface Notification {
  id: string
  organizationId: string
  hospitalId: string | null
  recipientId: string | null
  patientId: string | null
  type: NotificationType
  category: NotificationCategory
  priority: NotificationPriority
  title: string
  body: string
  icon: string | null
  imageUrl: string | null
  deepLink: string | null
  payload: Record<string, unknown>
  scheduleAt: string | null
  retryCount: number
  deliveryStatus: NotificationStatus
  failureReason: string | null
  isRead: boolean
  readAt: string | null
  isArchived: boolean
  archivedAt: string | null
  isPinned: boolean
  pinnedAt: string | null
  sentAt: string | null
  eventKey: string | null
  createdAt: string
  /** Populated by the history/admin reads; omitted from the inbox list. */
  deliveries?: NotificationDeliveryRecord[]
  recipient?: { id: string; firstName: string; lastName: string; email: string } | null
}

export interface NotificationUnreadSummary {
  unread: number
  /** Unread notifications at `CRITICAL` priority - drives the bell's red state. */
  critical: number
  pinned: number
  byCategory: Array<{ category: NotificationCategory; count: number }>
}

// ─── Inbox queries ──────────────────────────────────────────────────────────

/** Which slice of a user's own centre to read (Checkpoint 18.3). */
export type NotificationInboxFilter = 'all' | 'unread' | 'read' | 'archived' | 'pinned' | 'critical'

export interface NotificationQuery {
  page?: number
  limit?: number
  filter?: NotificationInboxFilter
  category?: NotificationCategory
  type?: NotificationType
  priority?: NotificationPriority
  search?: string
  from?: string
  to?: string
}

/** Org-wide history (Checkpoint 18.6) - adds the dimensions an admin needs. */
export interface NotificationHistoryQuery extends NotificationQuery {
  recipientId?: string
  channel?: NotificationChannel
  status?: NotificationStatus
  deliveryStatus?: NotificationDeliveryStatus
  /** Only notifications with at least one delivery that exhausted its retries. */
  failedOnly?: boolean
  scheduledOnly?: boolean
}

// ─── Send / schedule ────────────────────────────────────────────────────────

const isoDateTime = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'Must be an ISO date-time' })

/**
 * A broadcast or one-off message composed by a human (Checkpoint 18.6), as
 * opposed to the event-driven path, which never goes through HTTP.
 * `recipientIds` and `roleSlugs` are additive; at least one must resolve to a
 * real user or the request is rejected rather than silently sending nothing.
 */
export const SendNotificationSchema = z
  .object({
    title: z.string().min(1).max(200),
    body: z.string().min(1).max(2000),
    category: z.nativeEnum(NotificationCategory).default(NotificationCategory.SYSTEM),
    priority: z.nativeEnum(NotificationPriority).default(NotificationPriority.NORMAL),
    channels: z.array(z.nativeEnum(NotificationChannel)).min(1).optional(),
    recipientIds: z.array(z.string()).max(500).optional(),
    roleSlugs: z.array(z.string().min(1)).max(20).optional(),
    hospitalId: z.string().optional(),
    icon: z.string().max(60).optional(),
    imageUrl: z.string().url().optional(),
    deepLink: z.string().max(500).optional(),
    payload: z.record(z.unknown()).optional(),
    scheduleAt: isoDateTime.optional(),
  })
  .refine((value) => (value.recipientIds?.length ?? 0) + (value.roleSlugs?.length ?? 0) > 0, {
    message: 'Provide at least one recipient or role',
    path: ['recipientIds'],
  })

export type SendNotificationDto = z.infer<typeof SendNotificationSchema>

export const MarkNotificationsSchema = z.object({
  ids: z.array(z.string()).min(1).max(500),
})
export type MarkNotificationsDto = z.infer<typeof MarkNotificationsSchema>

// ─── Preferences (Checkpoint 18.5) ──────────────────────────────────────────

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/

export const CategoryPreferenceSchema = z.object({
  enabled: z.boolean(),
  channels: z.array(z.nativeEnum(NotificationChannel)).optional(),
})
export type CategoryPreference = z.infer<typeof CategoryPreferenceSchema>

export const UpdateNotificationPreferenceSchema = z.object({
  inAppEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  whatsappEnabled: z.boolean().optional(),
  emailFrequency: z.nativeEnum(EmailDigestFrequency).optional(),
  quietHoursStart: z.string().regex(HH_MM, 'Expected HH:mm').nullable().optional(),
  quietHoursEnd: z.string().regex(HH_MM, 'Expected HH:mm').nullable().optional(),
  timezone: z.string().min(1).max(64).optional(),
  categoryPreferences: z.record(z.nativeEnum(NotificationCategory), CategoryPreferenceSchema).optional(),
})

export type UpdateNotificationPreferenceDto = z.infer<typeof UpdateNotificationPreferenceSchema>

export interface NotificationPreference {
  userId: string
  inAppEnabled: boolean
  emailEnabled: boolean
  pushEnabled: boolean
  smsEnabled: boolean
  whatsappEnabled: boolean
  emailFrequency: EmailDigestFrequency
  quietHoursStart: string | null
  quietHoursEnd: string | null
  timezone: string
  categoryPreferences: Partial<Record<NotificationCategory, CategoryPreference>>
  updatedAt: string | null
}

// ─── Devices (Checkpoint 18.2) ──────────────────────────────────────────────

export const RegisterDeviceSchema = z.object({
  token: z.string().min(10).max(4096),
  platform: z.nativeEnum(DevicePlatform).default(DevicePlatform.WEB),
  deviceName: z.string().max(120).optional(),
  browser: z.string().max(60).optional(),
  osName: z.string().max(60).optional(),
  userAgent: z.string().max(500).optional(),
})
export type RegisterDeviceDto = z.infer<typeof RegisterDeviceSchema>

export interface UserDevice {
  id: string
  platform: DevicePlatform
  deviceName: string | null
  browser: string | null
  osName: string | null
  isActive: boolean
  lastSeenAt: string
  createdAt: string
  /** Last 8 characters only - a push token is a credential. */
  tokenSuffix: string
}

/** What the browser needs to subscribe. `configured: false` means push is off. */
export interface PushConfigStatus {
  configured: boolean
  /** FCM Web Push public VAPID key; null when push is not configured. */
  vapidPublicKey: string | null
  projectId: string | null
  /** Populated when `configured` is false - states exactly what is missing. */
  reason: string | null
}

// ─── Templates (Checkpoint 18.6) ────────────────────────────────────────────

export const UpsertNotificationTemplateSchema = z.object({
  key: z.string().min(1).max(80),
  channel: z.nativeEnum(NotificationChannel),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  category: z.nativeEnum(NotificationCategory),
  priority: z.nativeEnum(NotificationPriority).default(NotificationPriority.NORMAL),
  subjectTemplate: z.string().max(300).optional(),
  bodyTemplate: z.string().min(1).max(5000),
  deepLinkTemplate: z.string().max(500).optional(),
  isActive: z.boolean().default(true),
})
export type UpsertNotificationTemplateDto = z.infer<typeof UpsertNotificationTemplateSchema>

export const PreviewNotificationTemplateSchema = z.object({
  key: z.string().min(1).max(80),
  channel: z.nativeEnum(NotificationChannel),
  variables: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
})
export type PreviewNotificationTemplateDto = z.infer<typeof PreviewNotificationTemplateSchema>

export interface NotificationTemplate {
  id: string | null
  organizationId: string | null
  key: string
  channel: NotificationChannel
  version: number
  name: string
  description: string | null
  category: NotificationCategory
  priority: NotificationPriority
  subjectTemplate: string | null
  bodyTemplate: string
  deepLinkTemplate: string | null
  variables: string[]
  isActive: boolean
  /** True when this is the bundled default rather than an org override. */
  isDefault: boolean
  updatedAt: string | null
}

export interface RenderedTemplate {
  subject: string | null
  body: string
  deepLink: string | null
  /** Variables the template referenced that the caller did not supply. */
  missingVariables: string[]
}

// ─── Statistics & queue monitoring (Checkpoint 18.6) ────────────────────────

export interface NotificationChannelStat {
  channel: NotificationChannel
  attempted: number
  sent: number
  failed: number
  skipped: number
  pending: number
  /** `sent / (sent + failed)` as a 0–100 fixed-2 string. Null when nothing was attempted. */
  successRate: string | null
}

export interface NotificationDeliveryStats {
  period: { from: string; to: string }
  total: number
  read: number
  unread: number
  scheduled: number
  failed: number
  byChannel: NotificationChannelStat[]
  byCategory: Array<{ category: NotificationCategory; count: number }>
  byPriority: Array<{ priority: NotificationPriority; count: number }>
  /** Daily volume, `YYYY-MM-DD` local-time buckets. */
  series: Array<{ bucket: string; sent: number; failed: number }>
  /** Null when nothing was attempted in the period - never a misleading 0. */
  successRate: string | null
  failureRate: string | null
}

export interface NotificationQueueStatus {
  pending: number
  queued: number
  /** Rows whose `nextAttemptAt` has elapsed and are waiting for the worker. */
  due: number
  retrying: number
  failed: number
  scheduled: number
  oldestPendingAt: string | null
  workerEnabled: boolean
  /** Set when the worker is disabled, naming the reason. */
  workerDisabledReason: string | null
}

/** One channel adapter's configuration state (Checkpoint 18.6 / platform). */
export interface NotificationProviderStatus {
  channel: NotificationChannel
  providerName: string
  configured: boolean
  /** Why it is unconfigured - shown verbatim; never "coming soon". */
  reason: string | null
}

export interface PlatformNotificationAnalytics {
  period: { from: string; to: string }
  totals: NotificationDeliveryStats
  providers: NotificationProviderStatus[]
  queue: NotificationQueueStatus
  byOrganization: Array<{
    organizationId: string
    organizationName: string
    total: number
    sent: number
    failed: number
    successRate: string | null
  }>
}
