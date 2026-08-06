import type { AuthenticatedUser, ChangePasswordDto, SessionInfo } from '@medicore/types'

import { apiClient } from './client'

/**
 * The personal account surface (`/dashboard/settings`) - everything here is
 * self-scoped (`/auth/*`), no permission beyond a valid session required.
 *
 * Deliberately thin: `/auth/me` returns the same `AuthenticatedUser` shape
 * already carried on the JWT, not an extended profile - there is no
 * self-service "update my profile" endpoint yet (only an admin-only
 * `PATCH /users/:id`), so the settings UI treats profile fields as read-only
 * rather than pretending an edit would persist.
 */

export async function getCurrentUser(): Promise<AuthenticatedUser> {
  const { data } = await apiClient.get<{ data: AuthenticatedUser }>('/auth/me')
  return data.data
}

export async function changePassword(dto: ChangePasswordDto): Promise<void> {
  await apiClient.post('/auth/change-password', dto)
}

export async function getSessions(): Promise<SessionInfo[]> {
  const { data } = await apiClient.get<{ data: SessionInfo[] }>('/auth/sessions')
  return data.data
}
