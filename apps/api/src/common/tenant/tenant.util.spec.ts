import { JwtPayload } from '@medicore/types'

import { hospitalScopeFilter, isHospitalInScope, resolveTenantContext } from './tenant.util'

function payload(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return {
    sub: 'user_1',
    email: 'user@example.com',
    orgId: 'org_1',
    orgSlug: 'org-1',
    isPlatform: false,
    roles: [],
    permissions: [],
    hospitalIds: [],
    sessionId: 'session_1',
    iat: 0,
    exp: 0,
    ...overrides,
  }
}

describe('resolveTenantContext', () => {
  it('resolves all three tenant levels from the JWT', () => {
    const tenant = resolveTenantContext(
      payload({ isPlatform: true, hospitalIds: ['hosp_1', 'hosp_2'] }),
    )

    expect(tenant).toEqual({
      userId: 'user_1',
      organizationId: 'org_1',
      organizationSlug: 'org-1',
      isPlatformOwner: true,
      hospitalIds: ['hosp_1', 'hosp_2'],
    })
  })

  it('treats a missing isPlatform claim as not a platform owner', () => {
    // A token minted before Milestone 16 carries no `isPlatform` claim at all.
    // It must fail closed, never default to platform access.
    const legacy = payload()
    delete (legacy as Partial<JwtPayload>).isPlatform

    expect(resolveTenantContext(legacy).isPlatformOwner).toBe(false)
  })

  it('defaults hospitalIds to an empty array when the claim is absent', () => {
    const legacy = payload()
    delete (legacy as Partial<JwtPayload>).hospitalIds

    expect(resolveTenantContext(legacy).hospitalIds).toEqual([])
  })
})

describe('hospitalScopeFilter', () => {
  it('returns null for an org-wide user, meaning "every hospital"', () => {
    expect(hospitalScopeFilter(resolveTenantContext(payload()))).toBeNull()
  })

  it('returns the assigned hospital ids for a hospital-scoped user', () => {
    const tenant = resolveTenantContext(payload({ hospitalIds: ['hosp_1'] }))
    expect(hospitalScopeFilter(tenant)).toEqual(['hosp_1'])
  })
})

describe('isHospitalInScope', () => {
  it('allows any hospital for an org-wide user', () => {
    const tenant = resolveTenantContext(payload())
    expect(isHospitalInScope(tenant, 'any_hospital')).toBe(true)
  })

  it('allows only assigned hospitals for a hospital-scoped user', () => {
    const tenant = resolveTenantContext(payload({ hospitalIds: ['hosp_1'] }))

    expect(isHospitalInScope(tenant, 'hosp_1')).toBe(true)
    expect(isHospitalInScope(tenant, 'hosp_2')).toBe(false)
  })
})
