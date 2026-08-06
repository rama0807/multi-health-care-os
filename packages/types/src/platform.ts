import { z } from 'zod'

import { OrganizationStatus, OrganizationType, SubscriptionStatus, SubscriptionTier } from './enums'

/**
 * Platform Owner console contracts (Milestone 16, Checkpoint 16.2 / ADR-0025).
 *
 * Everything here is cross-tenant by definition and is only ever served by
 * `/platform/*` routes, which `PlatformGuard` restricts to users belonging to
 * the tenant flagged `Organization.isPlatform`. Nothing in this file is
 * reachable from an organization-scoped controller.
 */

export interface PlatformOrganizationSummary {
  id: string
  name: string
  slug: string
  type: OrganizationType
  status: OrganizationStatus
  isActive: boolean
  isPlatform: boolean
  email: string
  phone: string
  city: string | null
  country: string
  suspendedAt: Date | null
  suspensionReason: string | null
  subscriptionPlan: SubscriptionTier
  subscriptionStatus: SubscriptionStatus | null
  subscriptionEndsAt: Date | null
  hospitalCount: number
  userCount: number
  patientCount: number
  createdAt: Date
}

export interface PlatformOrganizationDetail extends PlatformOrganizationSummary {
  address: string | null
  state: string | null
  pincode: string | null
  website: string | null
  licenseNumber: string | null
  taxId: string | null
  hospitals: Array<{
    id: string
    name: string
    code: string
    city: string | null
    isActive: boolean
    departmentCount: number
    createdAt: Date
  }>
  admins: Array<{
    id: string
    email: string
    firstName: string
    lastName: string
    lastLoginAt: Date | null
  }>
  storageBytes: number
  activeUsersLast30Days: number
}

export interface PlatformHospitalRow {
  id: string
  name: string
  code: string
  city: string | null
  isActive: boolean
  createdAt: Date
  organizationId: string
  organizationName: string
  organizationSlug: string
  departmentCount: number
}

export interface PlatformStats {
  organizations: {
    total: number
    active: number
    suspended: number
    trial: number
    cancelled: number
  }
  hospitals: { total: number; active: number }
  users: { total: number; active: number; activeLast30Days: number }
  patients: number
  storageBytes: number
  subscriptionsByPlan: Array<{ plan: SubscriptionTier; count: number }>
  /** Rolling window backed by Redis counters - see `ApiUsageService`. */
  api: { windowDays: number; totalRequests: number; daily: Array<{ date: string; requests: number }> }
  ai: { totalRequests: number; totalTokens: number; estimatedCost: number }
  signupsLast30Days: number
}

export interface PlatformAnalytics {
  /** Organizations created per month, oldest first. */
  organizationGrowth: Array<{ month: string; created: number; cumulative: number }>
  topOrganizationsByUsers: Array<{ organizationId: string; name: string; slug: string; users: number }>
  topOrganizationsByStorage: Array<{ organizationId: string; name: string; slug: string; bytes: number }>
  topOrganizationsByApiRequests: Array<{
    organizationId: string
    name: string
    slug: string
    requests: number
  }>
  statusBreakdown: Array<{ status: OrganizationStatus; count: number }>
}

export type PlatformSearchResultType = 'ORGANIZATION' | 'HOSPITAL' | 'USER'

export interface PlatformSearchResult {
  type: PlatformSearchResultType
  id: string
  title: string
  subtitle: string
  organizationId: string
  organizationName: string
}

export interface PlatformAuditLogRow {
  id: string
  action: string
  resource: string
  resourceId: string | null
  userId: string | null
  userEmail: string | null
  organizationId: string
  organizationName: string
  ipAddress: string | null
  createdAt: Date
}

// ─── Request schemas ────────────────────────────────────────────────────────

export const PlatformOrganizationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().min(1).optional(),
  status: z.nativeEnum(OrganizationStatus).optional(),
  plan: z.nativeEnum(SubscriptionTier).optional(),
  /** The platform's own tenant is excluded by default - it is not a customer. */
  includePlatform: z.coerce.boolean().optional(),
})

export type PlatformOrganizationQuery = z.infer<typeof PlatformOrganizationQuerySchema>

export const SuspendOrganizationSchema = z.object({
  reason: z.string().trim().min(3).max(500),
})

export type SuspendOrganizationDto = z.infer<typeof SuspendOrganizationSchema>

export const PlatformAuditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  organizationId: z.string().optional(),
  userId: z.string().optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

export type PlatformAuditQuery = z.infer<typeof PlatformAuditQuerySchema>
