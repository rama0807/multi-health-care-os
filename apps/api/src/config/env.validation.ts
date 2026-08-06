/**
 * Startup environment validation (Milestone 19.1 / 19.5, ADR-0028).
 *
 * Wired into `ConfigModule.forRoot({ validate })`, so it runs before a single
 * provider is constructed. The rule it enforces is narrow and deliberate:
 *
 * - **Errors abort the boot**, and are reserved for settings that are unsafe
 *   rather than merely unset - a production process running on the shipped
 *   placeholder cookie secret, or with no JWT keypair, is not a degraded
 *   deployment, it is a compromised one waiting to happen. Failing here is
 *   loud and immediate; the alternative is discovering it from an incident.
 * - **Warnings never abort**, and cover deployments that will work but should
 *   not be trusted (a log-only SMS driver in production, an `http://` origin,
 *   an unauthenticated metrics endpoint). They are surfaced through the real
 *   logger once it exists - see `main.ts`.
 *
 * Development and test deployments are validated for *shape* only. Every
 * production-only rule is skipped outside `NODE_ENV=production` so that
 * `pnpm dev`, `pnpm test` and `pnpm test:e2e` need no new variables.
 */

/** Collected during validation, drained by `main.ts` once the logger is up. */
const startupWarnings: string[] = []

export function drainStartupWarnings(): string[] {
  return startupWarnings.splice(0, startupWarnings.length)
}

/** The value `app.config.ts` falls back to - safe in dev, never in production. */
export const DEFAULT_COOKIE_SECRET = 'change-me-in-production-min-32-chars'

const PLACEHOLDER = /^x{6,}$|^changeme$|^change-me|^your[-_]/i

function isPlaceholder(value: string | undefined): boolean {
  const trimmed = value?.trim()
  return !trimmed || PLACEHOLDER.test(trimmed)
}

/** Accepts either a raw PEM or the base64 form `jwt.config.ts` also accepts. */
function looksLikePem(value: string | undefined): boolean {
  if (!value) return false
  if (value.includes('BEGIN')) return true
  try {
    return Buffer.from(value, 'base64').toString('utf8').includes('BEGIN')
  } catch {
    return false
  }
}

/** Mirrors `SecretEncryptionService`'s own key check - a base64-encoded 32-byte (256-bit) key. */
function isValidEncryptionKey(value: string): boolean {
  try {
    return Buffer.from(value, 'base64').length === 32
  } catch {
    return false
  }
}

function isPositiveInt(value: string | undefined): boolean {
  if (value === undefined || value.trim() === '') return true
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0
}

export interface EnvValidationResult {
  errors: string[]
  warnings: string[]
}

/**
 * The pure half - no throwing, no process state - so the rules can be unit
 * tested against a synthetic environment instead of the real one.
 */
export function checkEnv(env: Record<string, unknown>): EnvValidationResult {
  const get = (key: string): string | undefined => {
    const value = env[key]
    return typeof value === 'string' ? value : undefined
  }

  const errors: string[] = []
  const warnings: string[] = []

  const nodeEnv = get('NODE_ENV') ?? 'development'
  const isProduction = nodeEnv === 'production'

  // ── Shape checks, every environment ────────────────────────────────────
  for (const key of ['PORT', 'REDIS_PORT', 'THROTTLE_LIMIT', 'THROTTLE_AUTH_LIMIT']) {
    if (!isPositiveInt(get(key))) errors.push(`${key} must be a positive integer (got "${get(key)}")`)
  }

  const databaseUrl = get('DATABASE_URL')
  if (databaseUrl && !/^postgres(ql)?:\/\//.test(databaseUrl)) {
    errors.push('DATABASE_URL must be a postgresql:// connection string')
  }

  // ── Production-only rules ──────────────────────────────────────────────
  if (!isProduction) {
    startupWarnings.push(...warnings)
    return { errors, warnings }
  }

  if (!databaseUrl) errors.push('DATABASE_URL is required in production')

  if (!looksLikePem(get('JWT_PRIVATE_KEY')) || !looksLikePem(get('JWT_PUBLIC_KEY'))) {
    errors.push(
      'JWT_PRIVATE_KEY and JWT_PUBLIC_KEY must both hold an RS256 PEM (raw or base64) in production - ' +
        'generate one with `pnpm --filter @medicore/api keys:generate`',
    )
  }

  const cookieSecret = get('COOKIE_SECRET')
  if (!cookieSecret || cookieSecret === DEFAULT_COOKIE_SECRET || isPlaceholder(cookieSecret)) {
    errors.push('COOKIE_SECRET must be set to a real secret in production (the shipped default is public)')
  } else if (cookieSecret.length < 32) {
    errors.push(`COOKIE_SECRET must be at least 32 characters in production (got ${cookieSecret.length})`)
  }

  if (!get('REDIS_HOST')) {
    errors.push('REDIS_HOST is required in production - sessions and rate limiting depend on it')
  }

  const origins = (get('CORS_ORIGINS') ?? get('FRONTEND_URL') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  if (origins.length === 0) {
    errors.push('FRONTEND_URL (or CORS_ORIGINS) is required in production - CORS defaults to localhost otherwise')
  }
  if (origins.includes('*')) {
    errors.push('CORS_ORIGINS must not contain "*" - the API is credentialed and a wildcard cannot be honoured')
  }
  for (const origin of origins.filter((origin) => origin.startsWith('http://'))) {
    warnings.push(`CORS origin ${origin} is plain HTTP - session cookies are Secure and will not be sent`)
  }

  if (!get('METRICS_TOKEN')?.trim()) {
    warnings.push('METRICS_TOKEN is not set - /api/metrics is disabled in production rather than served openly')
  }

  for (const key of ['SMS_DRIVER', 'WHATSAPP_DRIVER']) {
    if (get(key)?.trim().toUpperCase() === 'LOG') {
      warnings.push(`${key}=LOG writes message bodies to the application log - never use it in production`)
    }
  }

  if (get('STORAGE_PROVIDER')?.trim().toLowerCase() !== 's3') {
    warnings.push(
      'STORAGE_PROVIDER is not "s3" - uploaded clinical documents are written to the container filesystem ' +
        'and are lost when it is replaced',
    )
  }

  if (get('AI_ENABLED')?.trim().toLowerCase() === 'true' && get('AI_PROVIDER')?.trim().toUpperCase() !== 'OLLAMA') {
    warnings.push(
      'AI is enabled against a third-party provider - confirm a BAA is in place, or set AI_PROVIDER=OLLAMA ' +
        '(see TD-0042)',
    )
  }

  const emailConfigEncryptionKey = get('EMAIL_CONFIG_ENCRYPTION_KEY')?.trim()
  if (!emailConfigEncryptionKey) {
    warnings.push(
      'EMAIL_CONFIG_ENCRYPTION_KEY is not set - organizations cannot configure their own Resend key ' +
        '(TD-0064); every tenant shares the platform RESEND_API_KEY',
    )
  } else if (!isValidEncryptionKey(emailConfigEncryptionKey)) {
    errors.push(
      'EMAIL_CONFIG_ENCRYPTION_KEY must be a base64-encoded 32-byte key (generate one with ' +
        '`node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"`)',
    )
  }

  startupWarnings.push(...warnings)
  return { errors, warnings }
}

/** The `ConfigModule.forRoot({ validate })` hook. Throws to abort the boot. */
export function validateEnv(env: Record<string, unknown>): Record<string, unknown> {
  const { errors } = checkEnv(env)

  if (errors.length > 0) {
    throw new Error(
      `Refusing to start - ${errors.length} environment problem(s):\n` +
        errors.map((message) => `  • ${message}`).join('\n'),
    )
  }

  return env
}
