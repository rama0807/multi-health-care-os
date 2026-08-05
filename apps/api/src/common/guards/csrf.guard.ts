import { timingSafeEqual } from 'node:crypto'

import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { FastifyRequest } from 'fastify'

export const CSRF_COOKIE_NAME = 'medicore_csrf'
export const CSRF_HEADER_NAME = 'x-csrf-token'

/**
 * Double-submit cookie check for the small set of endpoints authenticated via
 * an HttpOnly cookie (refresh/logout/logout-all) rather than a Bearer token.
 * Bearer-authenticated routes never need this — browsers don't auto-attach
 * the Authorization header, so those are not CSRF-able by nature. Applied
 * per-route only; never registered as a global guard.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { cookies?: Record<string, string> }>()

    const cookieToken = request.cookies?.[CSRF_COOKIE_NAME]
    const rawHeader = request.headers[CSRF_HEADER_NAME]
    // A duplicated header arrives as an array. Comparing an array to a string
    // is always false, which would be a confusing 403 rather than a clear one;
    // take the first value, as every other header read in this codebase does.
    const headerToken = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader

    if (!cookieToken || !headerToken || !tokensMatch(cookieToken, headerToken)) {
      throw new ForbiddenException('Invalid or missing CSRF token')
    }

    return true
  }
}

/**
 * Constant-time comparison. `!==` on secrets leaks their prefix through
 * response timing — a weak signal over one request, a usable one over many,
 * and there is no reason to leave it available.
 */
function tokensMatch(cookieToken: string, headerToken: string): boolean {
  const a = Buffer.from(cookieToken)
  const b = Buffer.from(headerToken)
  // `timingSafeEqual` throws on a length mismatch, so length is checked first
  // — it is not secret (the token is a fixed-length nanoid).
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
