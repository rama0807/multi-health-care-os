import { JwtPayload } from '@medicore/types'

import { PermissionsService } from './permissions.service'

function payloadWith(permissions: string[]): JwtPayload {
  return {
    sub: 'user_1',
    email: 'user@example.com',
    orgId: 'org_1',
    orgSlug: 'org-1',
    orgType: 'HOSPITAL' as any,
    isPlatform: false,
    roles: [],
    permissions,
    hospitalIds: [],
    sessionId: 'session_1',
    iat: 0,
    exp: 0,
  }
}

describe('PermissionsService', () => {
  const service = new PermissionsService()

  describe('getScope', () => {
    it('returns "all" when the caller holds the .all variant', () => {
      const payload = payloadWith(['patients.read.all'])
      expect(service.getScope(payload, 'patients', 'read')).toBe('all')
    })

    it('returns "own" when only the .own variant is present', () => {
      const payload = payloadWith(['patients.read.own'])
      expect(service.getScope(payload, 'patients', 'read')).toBe('own')
    })

    it('prefers "all" over "own" when both are present', () => {
      const payload = payloadWith(['patients.read.own', 'patients.read.all'])
      expect(service.getScope(payload, 'patients', 'read')).toBe('all')
    })

    it('returns null when the permission is absent', () => {
      const payload = payloadWith(['patients.read.all'])
      expect(service.getScope(payload, 'patients', 'delete')).toBeNull()
    })

    it('handles a missing permissions array without throwing', () => {
      const payload = { ...payloadWith([]), permissions: undefined as unknown as string[] }
      expect(service.getScope(payload, 'patients', 'read')).toBeNull()
    })
  })

  describe('has', () => {
    it('is true when any scope is granted', () => {
      const payload = payloadWith(['users.manage.all'])
      expect(service.has(payload, 'users', 'manage')).toBe(true)
    })

    it('is false when no scope is granted', () => {
      const payload = payloadWith([])
      expect(service.has(payload, 'users', 'manage')).toBe(false)
    })
  })
})
