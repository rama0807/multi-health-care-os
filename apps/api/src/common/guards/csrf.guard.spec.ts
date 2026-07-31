import { ExecutionContext, ForbiddenException } from '@nestjs/common'

import { CsrfGuard } from './csrf.guard'

function contextWith(cookies: Record<string, string> | undefined, headerToken?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        cookies,
        headers: headerToken ? { 'x-csrf-token': headerToken } : {},
      }),
    }),
  } as unknown as ExecutionContext
}

describe('CsrfGuard', () => {
  const guard = new CsrfGuard()

  it('allows the request when the cookie and header match', () => {
    const context = contextWith({ medicore_csrf: 'token-abc' }, 'token-abc')
    expect(guard.canActivate(context)).toBe(true)
  })

  it('denies when the header is missing', () => {
    const context = contextWith({ medicore_csrf: 'token-abc' }, undefined)
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException)
  })

  it('denies when the cookie is missing', () => {
    const context = contextWith(undefined, 'token-abc')
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException)
  })

  it('denies when the cookie and header do not match', () => {
    const context = contextWith({ medicore_csrf: 'token-abc' }, 'token-xyz')
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException)
  })
})
