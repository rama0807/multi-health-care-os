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
    const headerToken = request.headers[CSRF_HEADER_NAME]

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      throw new ForbiddenException('Invalid or missing CSRF token')
    }

    return true
  }
}
