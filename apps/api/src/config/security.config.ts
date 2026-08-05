import { registerAs } from '@nestjs/config'

function toInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function toBool(value: string | undefined, fallback: boolean): boolean {
  const trimmed = value?.trim().toLowerCase()
  if (trimmed === undefined || trimmed === '') return fallback
  return trimmed === 'true' || trimmed === '1' || trimmed === 'yes'
}

/**
 * Splits a comma-separated origin list, dropping blanks and trailing slashes.
 * `Origin` headers never carry a trailing slash, so a configured
 * `https://app.example.com/` would silently match nothing.
 */
export function parseOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean)
}

const AUTH_THROTTLE_TTL_DEFAULT = 60

/**
 * Deliberately not as small as a single user's credentials would suggest.
 *
 * The throttler keys on `request.ip`, and a hospital LAN puts every
 * workstation behind one NAT address — a limit tuned for one attacker would
 * lock out a whole ward at shift change. Brute-force protection against a
 * *specific account* is the per-user lockout in `AuthService` (5 failed
 * attempts → temporary lock), which NAT cannot dilute. This tier is the
 * coarser second line, sized to stop a scripted flood rather than to count
 * one person's typos.
 */
const AUTH_THROTTLE_LIMIT_DEFAULT = 20

/**
 * The per-route override credential endpoints apply with `@Throttle(...)`.
 *
 * Reads `process.env` directly rather than `ConfigService` because a decorator
 * is evaluated when its class is *loaded* — before the DI container exists.
 * The defaults are kept identical to the `throttle.auth*` values below, and
 * `env.validation.ts` type-checks the same variables at boot.
 */
export function authThrottle(): { default: { ttl: number; limit: number } } {
  return {
    default: {
      ttl: toInt(process.env.THROTTLE_AUTH_TTL_SECONDS, AUTH_THROTTLE_TTL_DEFAULT) * 1000,
      limit: toInt(process.env.THROTTLE_AUTH_LIMIT, AUTH_THROTTLE_LIMIT_DEFAULT),
    },
  }
}

/**
 * Production hardening configuration (Milestone 19.1 / ADR-0028).
 *
 * Everything here has a safe default so a developer running `pnpm dev` needs
 * no new variables; the values that genuinely must change for production are
 * asserted at boot by `validateEnv` (`config/env.validation.ts`) rather than
 * being left to discover in an incident.
 */
export default registerAs('security', () => {
  const isProduction = process.env.NODE_ENV === 'production'

  return {
    /**
     * Browser origins allowed to call the API with credentials. Defaults to
     * `FRONTEND_URL` so existing deployments keep working; `CORS_ORIGINS`
     * takes over when a deployment serves more than one front end (an admin
     * host, a staging alias). A wildcard is never accepted — the API is
     * credentialed, and `Access-Control-Allow-Origin: *` is invalid with
     * `credentials: true` anyway.
     */
    corsOrigins: (() => {
      const configured = parseOrigins(process.env.CORS_ORIGINS)
      if (configured.length > 0) return configured
      return parseOrigins(process.env.FRONTEND_URL ?? 'http://localhost:3000')
    })(),

    /**
     * `X-Forwarded-For` is only trustworthy behind a proxy we control
     * (`infra/nginx/nginx.conf`). Trusting it when directly exposed would let
     * any caller spoof `request.ip` and therefore defeat per-IP rate limiting
     * and the IP recorded on every audit row — so it is off unless declared.
     */
    trustProxy: toBool(process.env.TRUST_PROXY, false),

    /** HTTP Strict Transport Security. Emitted only over HTTPS by design. */
    hstsMaxAgeSeconds: toInt(process.env.HSTS_MAX_AGE_SECONDS, 31_536_000),
    hstsIncludeSubDomains: toBool(process.env.HSTS_INCLUDE_SUBDOMAINS, true),
    hstsPreload: toBool(process.env.HSTS_PRELOAD, false),

    /**
     * The API serves JSON, uploaded files and — unless disabled — the Swagger
     * UI. Swagger needs inline script/style, so the CSP is relaxed exactly
     * where it is mounted and strict everywhere else; disabling the docs in
     * production removes the exception entirely.
     */
    swaggerEnabled: toBool(process.env.SWAGGER_ENABLED, !isProduction),

    /**
     * Global throttling. The defaults match what shipped before this
     * milestone (100 requests/minute); the auth tier is new — credential
     * endpoints are the ones worth spending a much smaller budget on.
     */
    throttle: {
      ttlSeconds: toInt(process.env.THROTTLE_TTL_SECONDS, 60),
      limit: toInt(process.env.THROTTLE_LIMIT, 100),
      authTtlSeconds: toInt(process.env.THROTTLE_AUTH_TTL_SECONDS, AUTH_THROTTLE_TTL_DEFAULT),
      authLimit: toInt(process.env.THROTTLE_AUTH_LIMIT, AUTH_THROTTLE_LIMIT_DEFAULT),
    },

    /**
     * `/api/metrics` exposes operational counters, not patient data, but it
     * still describes the deployment. When `METRICS_TOKEN` is set the endpoint
     * requires `Authorization: Bearer <token>`. When it is not, the endpoint
     * stays open in development (where a local Prometheus needs no ceremony)
     * and **fails closed in production** — an unauthenticated scrape target on
     * a public interface is worse than no scrape target.
     */
    metricsToken: process.env.METRICS_TOKEN?.trim() || undefined,
  }
})
