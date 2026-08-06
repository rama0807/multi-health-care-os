import type {
  CreateDepartmentDto,
  Department,
  Hospital,
  OnboardHospitalDto,
  OnboardHospitalResult,
  Organization,
  OrganizationBranding,
  OrganizationSettings,
  OrganizationStats,
  OrganizationUsage,
  SubscriptionSummary,
  UpdateOrganizationBrandingDto,
  UpdateOrganizationDto,
  UpdateOrganizationSettingsDto,
  UpdateDepartmentDto,
} from '@medicore/types'

import { apiClient } from './client'

export interface OrganizationAdmin {
  id: string
  email: string
  firstName: string
  lastName: string
  phone: string | null
  status: string
  lastLoginAt: string | null
  createdAt: string
  roles: Array<{
    roleId: string
    roleName: string
    systemRole: string | null
    hospitalId: string | null
  }>
}

export interface AuditLogRow {
  id: string
  action: string
  resource: string
  resourceId: string | null
  userId: string | null
  userEmail: string | null
  userName: string | null
  ipAddress: string | null
  before: unknown
  after: unknown
  createdAt: string
}

export interface Paginated<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export interface AuditLogQuery {
  page?: number
  limit?: number
  action?: string
  resource?: string
  userId?: string
  search?: string
  from?: string
  to?: string
}

/** A hospital row as returned by `GET /hospitals`, which includes counts. */
export type HospitalWithCounts = Hospital & {
  _count: { departments: number; doctors: number; staff: number }
}

export async function getOrganization(): Promise<Organization> {
  const { data } = await apiClient.get<{ data: Organization }>('/organizations/me')
  return data.data
}

export async function updateOrganization(dto: UpdateOrganizationDto): Promise<Organization> {
  const { data } = await apiClient.patch<{ data: Organization }>('/organizations/me', dto)
  return data.data
}

export async function getOrganizationStats(): Promise<OrganizationStats> {
  const { data } = await apiClient.get<{ data: OrganizationStats }>('/organizations/me/stats')
  return data.data
}

export async function getOrganizationUsage(): Promise<OrganizationUsage> {
  const { data } = await apiClient.get<{ data: OrganizationUsage }>('/organizations/me/usage')
  return data.data
}

export async function getOrganizationAdmins(): Promise<OrganizationAdmin[]> {
  const { data } = await apiClient.get<{ data: OrganizationAdmin[] }>('/organizations/me/admins')
  return data.data
}

export async function getOrganizationSettings(): Promise<OrganizationSettings> {
  const { data } = await apiClient.get<{ data: OrganizationSettings }>('/organizations/me/settings')
  return data.data
}

export async function updateOrganizationSettings(
  dto: UpdateOrganizationSettingsDto,
): Promise<OrganizationSettings> {
  const { data } = await apiClient.patch<{ data: OrganizationSettings }>(
    '/organizations/me/settings',
    dto,
  )
  return data.data
}

export type BrandingWithLogo = OrganizationBranding & { logo: string | null }

export async function getOrganizationBranding(): Promise<BrandingWithLogo> {
  const { data } = await apiClient.get<{ data: BrandingWithLogo }>('/organizations/me/branding')
  return data.data
}

export async function updateOrganizationBranding(
  dto: UpdateOrganizationBrandingDto,
): Promise<BrandingWithLogo> {
  const { data } = await apiClient.patch<{ data: BrandingWithLogo }>(
    '/organizations/me/branding',
    dto,
  )
  return data.data
}

export async function uploadOrganizationLogo(file: File): Promise<{ logo: string }> {
  const form = new FormData()
  form.append('file', file)

  // Content-Type is deliberately cleared so the browser sets the multipart
  // boundary itself.
  const { data } = await apiClient.post<{ data: { logo: string } }>(
    '/organizations/me/branding/logo',
    form,
    { headers: { 'Content-Type': undefined } },
  )
  return data.data
}

export async function removeOrganizationLogo(): Promise<void> {
  await apiClient.delete('/organizations/me/branding/logo')
}

export async function getSubscription(): Promise<SubscriptionSummary> {
  const { data } = await apiClient.get<{ data: SubscriptionSummary }>(
    '/organizations/me/subscription',
  )
  return data.data
}

export async function listAuditLogs(query: AuditLogQuery = {}): Promise<Paginated<AuditLogRow>> {
  const { data } = await apiClient.get<{ data: Paginated<AuditLogRow> }>(
    '/organizations/me/audit-logs',
    { params: query },
  )
  return data.data
}

export async function getAuditFilterOptions(): Promise<{ actions: string[]; resources: string[] }> {
  const { data } = await apiClient.get<{ data: { actions: string[]; resources: string[] } }>(
    '/organizations/me/audit-logs/filters',
  )
  return data.data
}

// ── Hospitals (Checkpoint 16.1) ─────────────────────────────────────────

export async function listHospitalsWithCounts(): Promise<HospitalWithCounts[]> {
  const { data } = await apiClient.get<{ data: HospitalWithCounts[] }>('/hospitals')
  return data.data
}

export async function onboardHospital(dto: OnboardHospitalDto): Promise<OnboardHospitalResult> {
  const { data } = await apiClient.post<{ data: OnboardHospitalResult }>('/hospitals/onboard', dto)
  return data.data
}

export async function activateHospital(hospitalId: string): Promise<Hospital> {
  const { data } = await apiClient.post<{ data: Hospital }>(`/hospitals/${hospitalId}/activate`)
  return data.data
}

export async function deactivateHospital(hospitalId: string): Promise<Hospital> {
  const { data } = await apiClient.delete<{ data: Hospital }>(`/hospitals/${hospitalId}`)
  return data.data
}

export async function listOrganizationDepartments(hospitalId?: string): Promise<Department[]> {
  const { data } = await apiClient.get<{ data: Department[] }>('/departments', {
    params: hospitalId ? { hospitalId } : undefined,
  })
  return data.data
}

export async function createDepartment(dto: CreateDepartmentDto): Promise<Department> {
  const { data } = await apiClient.post<{ data: Department }>('/departments', dto)
  return data.data
}

export async function updateDepartment(id: string, dto: UpdateDepartmentDto): Promise<Department> {
  const { data } = await apiClient.patch<{ data: Department }>(`/departments/${id}`, dto)
  return data.data
}

export async function deactivateDepartment(id: string): Promise<Department> {
  const { data } = await apiClient.delete<{ data: Department }>(`/departments/${id}`)
  return data.data
}
