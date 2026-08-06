import { SetMetadata } from '@nestjs/common'

export const PERMISSIONS_KEY = 'requiredPermissions'

/**
 * Require one or more "resource.action" permissions on the current route.
 * Checked against the caller's JWT-embedded permission set (3-part
 * "resource.action.scope" strings) by PermissionsGuard - any one of the
 * listed permissions (checked at `.all` or `.own` scope) grants access.
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions)
