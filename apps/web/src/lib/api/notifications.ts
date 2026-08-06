import type {
  MarkNotificationsDto,
  Notification,
  NotificationDeliveryStats,
  NotificationHistoryQuery,
  NotificationPreference,
  NotificationProviderStatus,
  NotificationQuery,
  NotificationQueueStatus,
  NotificationTemplate,
  PaginatedResponse,
  PlatformNotificationAnalytics,
  PushConfigStatus,
  RegisterDeviceDto,
  RenderedTemplate,
  ReportFilterQuery,
  SendNotificationDto,
  UpdateNotificationPreferenceDto,
  UpsertNotificationTemplateDto,
  UserDevice,
  NotificationChannel,
} from '@medicore/types'

import { apiClient } from './client'

/**
 * Communication & Notification Platform client (Milestone 18).
 *
 * Three surfaces, matching the API's three controllers exactly:
 * `/notifications` (the caller's own centre - no permission needed),
 * `/notifications/admin` (org-wide, permission-gated), and
 * `/platform/notifications` (platform owner only).
 */

/**
 * Drops empty and `false` values so an unset filter never reaches the API as
 * `?category=` or `?failedOnly=false`, which the controllers would otherwise
 * have to special-case.
 */
function toParams(query: object = {}): Record<string, string> {
  return Object.fromEntries(
    Object.entries(query)
      .filter(([, value]) => value !== undefined && value !== null && value !== '' && value !== false)
      .map(([key, value]) => [key, String(value)]),
  )
}

// ─── My notification centre (18.3) ───────────────────────────────────────────

export async function listNotifications(
  query: NotificationQuery = {},
): Promise<PaginatedResponse<Notification>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<Notification> }>('/notifications', {
    params: toParams(query),
  })
  return data.data
}

export async function getNotificationSummary() {
  const { data } = await apiClient.get<{
    data: { unread: number; critical: number; pinned: number; byCategory: Array<{ category: string; count: number }> }
  }>('/notifications/summary')
  return data.data
}

export async function getNotification(id: string): Promise<Notification> {
  const { data } = await apiClient.get<{ data: Notification }>(`/notifications/${id}`)
  return data.data
}

export async function markNotificationsRead(dto: MarkNotificationsDto): Promise<number> {
  const { data } = await apiClient.post<{ data: { updated: number } }>('/notifications/read', dto)
  return data.data.updated
}

export async function markAllNotificationsRead(): Promise<number> {
  const { data } = await apiClient.post<{ data: { updated: number } }>('/notifications/read-all')
  return data.data.updated
}

const act = async (id: string, action: string): Promise<Notification> => {
  const { data } = await apiClient.post<{ data: Notification }>(`/notifications/${id}/${action}`)
  return data.data
}

export const markNotificationUnread = (id: string) => act(id, 'unread')
export const archiveNotification = (id: string) => act(id, 'archive')
export const unarchiveNotification = (id: string) => act(id, 'unarchive')
export const pinNotification = (id: string) => act(id, 'pin')
export const unpinNotification = (id: string) => act(id, 'unpin')

export async function deleteNotification(id: string): Promise<void> {
  await apiClient.delete(`/notifications/${id}`)
}

// ─── Preferences (18.5) ──────────────────────────────────────────────────────

export async function getNotificationPreferences(): Promise<NotificationPreference> {
  const { data } = await apiClient.get<{ data: NotificationPreference }>('/notifications/preferences')
  return data.data
}

export async function updateNotificationPreferences(
  dto: UpdateNotificationPreferenceDto,
): Promise<NotificationPreference> {
  const { data } = await apiClient.patch<{ data: NotificationPreference }>('/notifications/preferences', dto)
  return data.data
}

// ─── Devices (18.2) ──────────────────────────────────────────────────────────

export async function getPushConfig(): Promise<PushConfigStatus> {
  const { data } = await apiClient.get<{ data: PushConfigStatus }>('/notifications/devices/push-config')
  return data.data
}

export async function listDevices(): Promise<UserDevice[]> {
  const { data } = await apiClient.get<{ data: UserDevice[] }>('/notifications/devices')
  return data.data
}

export async function registerDevice(dto: RegisterDeviceDto): Promise<UserDevice> {
  const { data } = await apiClient.post<{ data: UserDevice }>('/notifications/devices', dto)
  return data.data
}

export async function deactivateDevice(id: string): Promise<UserDevice> {
  const { data } = await apiClient.delete<{ data: UserDevice }>(`/notifications/devices/${id}`)
  return data.data
}

// ─── Organization admin console (18.6) ───────────────────────────────────────

export async function listNotificationHistory(
  query: NotificationHistoryQuery = {},
): Promise<PaginatedResponse<Notification>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<Notification> }>(
    '/notifications/admin/history',
    { params: toParams(query) },
  )
  return data.data
}

export async function getNotificationStats(
  range: ReportFilterQuery = {},
): Promise<NotificationDeliveryStats> {
  const { data } = await apiClient.get<{ data: NotificationDeliveryStats }>('/notifications/admin/stats', {
    params: toParams(range),
  })
  return data.data
}

export async function getQueueStatus(): Promise<NotificationQueueStatus> {
  const { data } = await apiClient.get<{ data: NotificationQueueStatus }>('/notifications/admin/queue')
  return data.data
}

export async function getProviderStatuses(): Promise<NotificationProviderStatus[]> {
  const { data } = await apiClient.get<{ data: NotificationProviderStatus[] }>('/notifications/admin/providers')
  return data.data
}

export async function sendNotification(dto: SendNotificationDto) {
  const { data } = await apiClient.post<{ data: { created: number; duplicates: number } }>(
    '/notifications/admin/send',
    dto,
  )
  return data.data
}

export async function cancelScheduledNotification(id: string): Promise<void> {
  await apiClient.delete(`/notifications/admin/scheduled/${id}`)
}

export async function retryFailedDeliveries(deliveryIds?: string[]): Promise<number> {
  const { data } = await apiClient.post<{ data: { requeued: number } }>('/notifications/admin/retry', {
    deliveryIds,
  })
  return data.data.requeued
}

export async function listNotificationTemplates(
  channel?: NotificationChannel,
): Promise<NotificationTemplate[]> {
  const { data } = await apiClient.get<{ data: NotificationTemplate[] }>('/notifications/admin/templates', {
    params: toParams({ channel }),
  })
  return data.data
}

export async function listTemplateVersions(
  key: string,
  channel: NotificationChannel,
): Promise<NotificationTemplate[]> {
  const { data } = await apiClient.get<{ data: NotificationTemplate[] }>(
    `/notifications/admin/templates/${encodeURIComponent(key)}/${channel}/versions`,
  )
  return data.data
}

export async function upsertNotificationTemplate(
  dto: UpsertNotificationTemplateDto,
): Promise<NotificationTemplate> {
  const { data } = await apiClient.post<{ data: NotificationTemplate }>('/notifications/admin/templates', dto)
  return data.data
}

export async function setTemplateActive(id: string, active: boolean): Promise<NotificationTemplate> {
  const { data } = await apiClient.post<{ data: NotificationTemplate }>(
    `/notifications/admin/templates/${id}/${active ? 'activate' : 'deactivate'}`,
  )
  return data.data
}

export async function previewTemplate(
  key: string,
  channel: NotificationChannel,
  variables: Record<string, string | number | boolean | null>,
): Promise<RenderedTemplate> {
  const { data } = await apiClient.post<{ data: RenderedTemplate }>('/notifications/admin/templates/preview', {
    key,
    channel,
    variables,
  })
  return data.data
}

// ─── Platform Owner analytics (18.6) ─────────────────────────────────────────

export async function getPlatformNotificationAnalytics(
  range: ReportFilterQuery = {},
): Promise<PlatformNotificationAnalytics> {
  const { data } = await apiClient.get<{ data: PlatformNotificationAnalytics }>(
    '/platform/notifications/analytics',
    { params: toParams(range) },
  )
  return data.data
}

export async function getPlatformQueueStatus(): Promise<NotificationQueueStatus> {
  const { data } = await apiClient.get<{ data: NotificationQueueStatus }>('/platform/notifications/queue')
  return data.data
}

export async function getPlatformProviderStatuses(): Promise<NotificationProviderStatus[]> {
  const { data } = await apiClient.get<{ data: NotificationProviderStatus[] }>(
    '/platform/notifications/providers',
  )
  return data.data
}
