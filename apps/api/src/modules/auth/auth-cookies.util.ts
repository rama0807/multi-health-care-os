import '@fastify/cookie'

import { FastifyReply } from 'fastify'
import { nanoid } from 'nanoid'

import { CSRF_COOKIE_NAME } from '../../common/guards/csrf.guard'

export const REFRESH_COOKIE_NAME = 'medicore_rt'
// Deliberately "/", not "/api/v1/auth": in production, frontend and backend
// sit behind one nginx origin (see infra/nginx/nginx.conf), and the
// frontend's own middleware needs to see this cookie's presence on page
// requests (/dashboard, /login, ...) to redirect appropriately - a
// path-scoped cookie confined to the auth routes would never reach there.
const COOKIE_PATH = '/'

export function setAuthCookies(
  reply: FastifyReply,
  refreshToken: string,
  ttlSeconds: number,
  rememberMe: boolean,
  isProduction: boolean,
): void {
  // "Remember me" gets a persistent cookie (maxAge); otherwise a session
  // cookie that the browser drops on close, backstopped by the shorter
  // server-side Redis TTL used for non-remember-me sessions.
  const maxAge = rememberMe ? ttlSeconds : undefined

  void reply.setCookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: COOKIE_PATH,
    ...(maxAge ? { maxAge } : {}),
  })

  void reply.setCookie(CSRF_COOKIE_NAME, nanoid(32), {
    httpOnly: false,
    secure: isProduction,
    sameSite: 'lax',
    path: COOKIE_PATH,
    ...(maxAge ? { maxAge } : {}),
  })
}

export function clearAuthCookies(reply: FastifyReply, isProduction: boolean): void {
  void reply.clearCookie(REFRESH_COOKIE_NAME, { path: COOKIE_PATH, secure: isProduction, sameSite: 'lax' })
  void reply.clearCookie(CSRF_COOKIE_NAME, { path: COOKIE_PATH, secure: isProduction, sameSite: 'lax' })
}
