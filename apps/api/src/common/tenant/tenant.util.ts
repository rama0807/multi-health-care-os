import { JwtPayload, TenantContext } from '@medicore/types'

/**
 * Checkpoint 16.3 - Tenant Resolution.
 *
 * This is deliberately *not* a new resolution mechanism. Every field below
 * already travelled on the JWT that `JwtStrategy.validate` verifies on every
 * authenticated request; this function only gives the three levels
 * (platform / organization / hospital) one named shape so callers stop
 * destructuring the raw payload ad hoc.
 *
 * Existing controllers keep using `@CurrentUser('orgId')` - that path is
 * unchanged and still correct. `@Tenant()` is the richer alternative for code
 * that needs more than the organization id.
 */
export function resolveTenantContext(payload: JwtPayload): TenantContext {
  return {
    userId: payload.sub,
    organizationId: payload.orgId,
    organizationSlug: payload.orgSlug,
    isPlatformOwner: payload.isPlatform === true,
    hospitalIds: payload.hospitalIds ?? [],
  }
}

/**
 * Narrows a requested hospital id against the caller's hospital scope.
 *
 * A user whose role assignments carry no `hospitalId` is org-wide and may act
 * on any hospital in their organization - that is the pre-existing meaning of
 * an empty `UserRole.hospitalId`, not something this milestone introduces.
 * Returns `null` when the caller may see every hospital, otherwise the list
 * they are restricted to.
 */
export function hospitalScopeFilter(tenant: TenantContext): string[] | null {
  return tenant.hospitalIds.length > 0 ? tenant.hospitalIds : null
}

/** True when `hospitalId` is inside the caller's hospital scope. */
export function isHospitalInScope(tenant: TenantContext, hospitalId: string): boolean {
  const scope = hospitalScopeFilter(tenant)
  return scope === null || scope.includes(hospitalId)
}
