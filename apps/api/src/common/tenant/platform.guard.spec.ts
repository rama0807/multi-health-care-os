import { JwtPayload } from '@medicore/types'
import { ExecutionContext, ForbiddenException } from '@nestjs/common'

import { PlatformGuard } from './platform.guard'

function contextWith(user?: Partial<JwtPayload>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext
}

describe('PlatformGuard', () => {
  const guard = new PlatformGuard()

  it('allows a user belonging to the platform tenant', () => {
    expect(guard.canActivate(contextWith({ isPlatform: true }))).toBe(true)
  })

  it('rejects a user from a customer organization', () => {
    expect(() => guard.canActivate(contextWith({ isPlatform: false }))).toThrow(ForbiddenException)
  })

  it('rejects a user whose token predates the isPlatform claim', () => {
    // Fails closed: an absent claim is not platform access.
    expect(() => guard.canActivate(contextWith({}))).toThrow(ForbiddenException)
  })

  it('rejects an unauthenticated request', () => {
    expect(() => guard.canActivate(contextWith(undefined))).toThrow(ForbiddenException)
  })

  it('does not reveal that a platform console exists', () => {
    // Same generic message a missing permission produces.
    expect(() => guard.canActivate(contextWith({ isPlatform: false }))).toThrow('Access denied')
  })
})
