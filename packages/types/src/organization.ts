import { z } from 'zod'

import { OrganizationStatus, OrganizationType, SubscriptionStatus, SubscriptionTier } from './enums'

export interface Organization {
  id: string
  name: string
  slug: string
  type: OrganizationType
  email: string
  phone: string
  address: string | null
  city: string | null
  state: string | null
  country: string
  pincode: string | null
  logo: string | null
  website: string | null
  licenseNumber: string | null
  taxId: string | null
  status: OrganizationStatus
  suspendedAt: Date | null
  suspensionReason: string | null
  isPlatform: boolean
  subscriptionTier: SubscriptionTier
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Operational settings blob (`Organization.settings`). Every key that existed
 * before Milestone 16 is still required — clinical/billing modules read
 * `uhidPrefix`, `gstRate` and `defaultAppointmentDuration` without a fallback.
 * Keys added for Checkpoint 16.4 are optional so an organization seeded before
 * this milestone stays valid without a data backfill.
 */
export interface OrganizationSettings {
  uhidPrefix: string
  uhidResetYearly: boolean
  timezone: string
  currency: string
  currencySymbol: string
  dateFormat: string
  timeFormat: '12h' | '24h'
  gstNumber?: string
  gstRate: number
  defaultAppointmentDuration: number
  workingDays: number[]
  workingHoursStart: string
  workingHoursEnd: string
  /** BCP-47 tag, e.g. "en-IN". Added in Checkpoint 16.4. */
  language?: string
  /**
   * Per-organization feature toggles. Free-form on purpose: a flag is added by
   * the module that reads it, so this stays a string map rather than a closed
   * union every new module would have to widen.
   */
  featureFlags?: Record<string, boolean>
}

/**
 * Visual identity (`Organization.branding`). Separate column from `settings`
 * so a branding save can never clobber operational settings — see ADR-0025.
 * The logo itself stays on the pre-existing `Organization.logo` column so
 * existing readers keep working; it is not duplicated here.
 */
export interface OrganizationBranding {
  primaryColor?: string
  secondaryColor?: string
  accentColor?: string
  /** Shown in the app header/sidebar in place of the organization name. */
  displayName?: string
  loginTagline?: string
  emailFooterText?: string
}

// ─── Profile / settings / branding schemas ──────────────────────────────────

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/

export const UpdateOrganizationSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().length(2).optional(),
  pincode: z.string().optional(),
  website: z.string().url().optional(),
  licenseNumber: z.string().optional(),
  taxId: z.string().optional(),
  type: z.nativeEnum(OrganizationType).optional(),
})

export type UpdateOrganizationDto = z.infer<typeof UpdateOrganizationSchema>

export const UpdateOrganizationSettingsSchema = z
  .object({
    uhidPrefix: z.string().min(2).max(6).optional(),
    uhidResetYearly: z.boolean().optional(),
    timezone: z.string().min(1).optional(),
    currency: z.string().length(3).optional(),
    currencySymbol: z.string().min(1).max(4).optional(),
    dateFormat: z.string().min(1).optional(),
    timeFormat: z.enum(['12h', '24h']).optional(),
    gstNumber: z.string().optional(),
    gstRate: z.number().min(0).max(100).optional(),
    defaultAppointmentDuration: z.number().int().min(5).max(240).optional(),
    workingDays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    workingHoursStart: z.string().regex(HH_MM, 'Expected HH:mm').optional(),
    workingHoursEnd: z.string().regex(HH_MM, 'Expected HH:mm').optional(),
    language: z.string().min(2).max(10).optional(),
    featureFlags: z.record(z.boolean()).optional(),
  })
  .refine((v) => !v.workingHoursStart || !v.workingHoursEnd || v.workingHoursStart < v.workingHoursEnd, {
    message: 'workingHoursStart must be earlier than workingHoursEnd',
    path: ['workingHoursEnd'],
  })

export type UpdateOrganizationSettingsDto = z.infer<typeof UpdateOrganizationSettingsSchema>

export const UpdateOrganizationBrandingSchema = z.object({
  primaryColor: z.string().regex(HEX_COLOR, 'Expected a hex colour like #0F62FE').optional(),
  secondaryColor: z.string().regex(HEX_COLOR, 'Expected a hex colour like #0F62FE').optional(),
  accentColor: z.string().regex(HEX_COLOR, 'Expected a hex colour like #0F62FE').optional(),
  displayName: z.string().max(60).optional(),
  loginTagline: z.string().max(160).optional(),
  emailFooterText: z.string().max(300).optional(),
})

export type UpdateOrganizationBrandingDto = z.infer<typeof UpdateOrganizationBrandingSchema>

// ─── Organization dashboard / usage (Checkpoint 16.1) ───────────────────────

export interface OrganizationStats {
  hospitals: { total: number; active: number }
  users: { total: number; active: number; activeLast30Days: number }
  departments: number
  patients: number
  doctors: number
  staff: number
  appointmentsLast30Days: number
  admissionsLast30Days: number
  storageBytes: number
  createdAt: Date
}

export interface StorageUsageBreakdown {
  category: string
  bytes: number
  files: number
}

export interface OrganizationUsage {
  storage: {
    totalBytes: number
    quotaMb: number | null
    byCategory: StorageUsageBreakdown[]
  }
  users: { total: number; active: number; activeLast30Days: number; limit: number | null }
  hospitals: { total: number; limit: number | null }
  patients: { total: number; limit: number | null }
  /** Rolling window backed by Redis counters — see `ApiUsageService`. */
  api: {
    windowDays: number
    totalRequests: number
    daily: Array<{ date: string; requests: number }>
  }
  ai: { totalRequests: number; totalTokens: number; estimatedCost: number }
}

export interface SubscriptionSummary {
  plan: SubscriptionTier
  status: SubscriptionStatus
  startsAt: Date
  endsAt: Date | null
  maxHospitals: number | null
  maxUsers: number | null
  maxPatients: number | null
  storageQuotaMb: number | null
  monthlyPrice: string | null
  currency: string
  notes: string | null
}

export const UpsertSubscriptionSchema = z.object({
  plan: z.nativeEnum(SubscriptionTier),
  status: z.nativeEnum(SubscriptionStatus).optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().nullish(),
  maxHospitals: z.number().int().min(0).nullish(),
  maxUsers: z.number().int().min(0).nullish(),
  maxPatients: z.number().int().min(0).nullish(),
  storageQuotaMb: z.number().int().min(0).nullish(),
  monthlyPrice: z.number().min(0).nullish(),
  currency: z.string().length(3).optional(),
  notes: z.string().max(500).nullish(),
})

export type UpsertSubscriptionDto = z.infer<typeof UpsertSubscriptionSchema>
