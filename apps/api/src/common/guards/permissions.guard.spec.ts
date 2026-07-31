import { JwtPayload } from '@medicore/types'
import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'


import { PermissionsGuard } from './permissions.guard'

function contextWithUser(user: JwtPayload | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext
}

const basePayload: JwtPayload = {
  sub: 'user_1',
  email: 'user@example.com',
  orgId: 'org_1',
  orgSlug: 'org-1',
  roles: [],
  permissions: ['patients.read.all'],
  hospitalIds: [],
  sessionId: 'session_1',
  iat: 0,
  exp: 0,
}

describe('PermissionsGuard', () => {
  function makeGuard(required: string[] | undefined) {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(required) } as unknown as Reflector
    return new PermissionsGuard(reflector)
  }

  it('allows the request when no permissions are required', () => {
    const guard = makeGuard(undefined)
    expect(guard.canActivate(contextWithUser(basePayload))).toBe(true)
  })

  it('allows the request when the user holds the required permission', () => {
    const guard = makeGuard(['patients.read'])
    expect(guard.canActivate(contextWithUser(basePayload))).toBe(true)
  })

  it('allows when the user holds the .own variant of a required permission', () => {
    const guard = makeGuard(['patients.read'])
    const payload = { ...basePayload, permissions: ['patients.read.own'] }
    expect(guard.canActivate(contextWithUser(payload))).toBe(true)
  })

  it('denies the request when the user lacks the required permission', () => {
    const guard = makeGuard(['patients.delete'])
    expect(() => guard.canActivate(contextWithUser(basePayload))).toThrow(ForbiddenException)
  })

  it('denies the request when there is no authenticated user', () => {
    const guard = makeGuard(['patients.read'])
    expect(() => guard.canActivate(contextWithUser(undefined))).toThrow(ForbiddenException)
  })
})
