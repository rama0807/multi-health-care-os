import type {
  OrganizationStatus,
  OrganizationUsage,
  PlatformAnalytics,
  PlatformHospitalRow,
  PlatformOrganizationDetail,
  PlatformOrganizationSummary,
  PlatformSearchResult,
  PlatformStats,
  SubscriptionSummary,
  SubscriptionTier,
  UpsertSubscriptionDto,
} from '@medicore/types'

import { apiClient } from './client'
import type { Paginated } from './organization'

/**
 * Platform Owner console client (Checkpoint 16.2).
 *
 * Every call targets `/platform/*`, which the API guards with `PlatformGuard`.
 * Nothing here is reachable from an organization-scoped page, and nothing in
 * `organization.ts` reaches these routes.
 */

export interface PlatformOrganizationQueryParams {
  page?: number
  limit?: number
  search?: string
  status?: OrganizationStatus
  plan?: SubscriptionTier
  includePlatform?: boolean
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
  createdAt: string
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const { data } = await apiClient.get<{ data: PlatformStats }>('/platform/stats')
  return data.data
}

export async function getPlatformAnalytics(): Promise<PlatformAnalytics> {
  const { data } = await apiClient.get<{ data: PlatformAnalytics }>('/platform/analytics')
  return data.data
}

export async function searchPlatform(q: string, limit = 10): Promise<PlatformSearchResult[]> {
  const { data } = await apiClient.get<{ data: PlatformSearchResult[] }>('/platform/search', {
    params: { q, limit },
  })
  return data.data
}

export async function listPlatformOrganizations(
  params: PlatformOrganizationQueryParams = {},
): Promise<Paginated<PlatformOrganizationSummary>> {
  const { data } = await apiClient.get<{ data: Paginated<PlatformOrganizationSummary> }>(
    '/platform/organizations',
    { params },
  )
  return data.data
}

export async function getPlatformOrganization(
  organizationId: string,
): Promise<PlatformOrganizationDetail> {
  const { data } = await apiClient.get<{ data: PlatformOrganizationDetail }>(
    `/platform/organizations/${organizationId}`,
  )
  return data.data
}

export async function getPlatformOrganizationUsage(
  organizationId: string,
): Promise<OrganizationUsage> {
  const { data } = await apiClient.get<{ data: OrganizationUsage }>(
    `/platform/organizations/${organizationId}/usage`,
  )
  return data.data
}

export async function suspendOrganization(organizationId: string, reason: string): Promise<void> {
  await apiClient.post(`/platform/organizations/${organizationId}/suspend`, { reason })
}

export async function reinstateOrganization(organizationId: string): Promise<void> {
  await apiClient.post(`/platform/organizations/${organizationId}/reinstate`)
}

export async function setOrganizationEnabled(
  organizationId: string,
  enabled: boolean,
): Promise<void> {
  await apiClient.post(`/platform/organizations/${organizationId}/${enabled ? 'enable' : 'disable'}`)
}

export async function getPlatformSubscription(organizationId: string): Promise<SubscriptionSummary> {
  const { data } = await apiClient.get<{ data: SubscriptionSummary }>(
    `/platform/organizations/${organizationId}/subscription`,
  )
  return data.data
}

export async function upsertPlatformSubscription(
  organizationId: string,
  dto: UpsertSubscriptionDto,
): Promise<SubscriptionSummary> {
  const { data } = await apiClient.put<{ data: SubscriptionSummary }>(
    `/platform/organizations/${organizationId}/subscription`,
    dto,
  )
  return data.data
}

export async function listPlatformHospitals(params: {
  page?: number
  limit?: number
  search?: string
  organizationId?: string
}): Promise<Paginated<PlatformHospitalRow>> {
  const { data } = await apiClient.get<{ data: Paginated<PlatformHospitalRow> }>(
    '/platform/hospitals',
    { params },
  )
  return data.data
}

export async function listPlatformAuditLogs(params: {
  page?: number
  limit?: number
  organizationId?: string
  action?: string
  resource?: string
  search?: string
}): Promise<Paginated<PlatformAuditLogRow>> {
  const { data } = await apiClient.get<{ data: Paginated<PlatformAuditLogRow> }>(
    '/platform/audit-logs',
    { params },
  )
  return data.data
}
