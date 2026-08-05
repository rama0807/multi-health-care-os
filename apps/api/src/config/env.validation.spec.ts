import { checkEnv, DEFAULT_COOKIE_SECRET, drainStartupWarnings, validateEnv } from './env.validation'

/** A production environment with nothing wrong in it, for targeted mutation. */
function productionEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://medicore:secret@db:5432/medicore',
    JWT_PRIVATE_KEY: Buffer.from('-----BEGIN PRIVATE KEY-----\nx\n').toString('base64'),
    JWT_PUBLIC_KEY: '-----BEGIN PUBLIC KEY-----\nx\n',
    COOKIE_SECRET: 'a'.repeat(48),
    REDIS_HOST: 'redis',
    FRONTEND_URL: 'https://app.medicore.test',
    METRICS_TOKEN: 'metrics-secret',
    STORAGE_PROVIDER: 's3',
    ...overrides,
  }
}

describe('checkEnv', () => {
  afterEach(() => drainStartupWarnings())

  describe('outside production', () => {
    it('accepts an environment with nothing configured at all', () => {
      expect(checkEnv({ NODE_ENV: 'development' }).errors).toEqual([])
    })

    it('still rejects a malformed value, because the shape is wrong everywhere', () => {
      const { errors } = checkEnv({ NODE_ENV: 'development', PORT: 'four thousand' })
      expect(errors).toHaveLength(1)
      expect(errors[0]).toContain('PORT')
    })

    it('does not apply the production-only rules', () => {
      // Exactly the environment that must fail in production.
      const { errors } = checkEnv({ NODE_ENV: 'test', COOKIE_SECRET: DEFAULT_COOKIE_SECRET })
      expect(errors).toEqual([])
    })
  })

  describe('in production', () => {
    it('accepts a fully configured environment', () => {
      expect(checkEnv(productionEnv()).errors).toEqual([])
    })

    it('refuses the shipped default cookie secret', () => {
      const { errors } = checkEnv(productionEnv({ COOKIE_SECRET: DEFAULT_COOKIE_SECRET }))
      expect(errors.join()).toContain('COOKIE_SECRET')
    })

    it('refuses a cookie secret that is real but too short', () => {
      const { errors } = checkEnv(productionEnv({ COOKIE_SECRET: 'short-but-not-the-default' }))
      expect(errors.join()).toContain('at least 32 characters')
    })

    it('refuses a missing JWT keypair', () => {
      const { errors } = checkEnv(productionEnv({ JWT_PRIVATE_KEY: undefined }))
      expect(errors.join()).toContain('JWT_PRIVATE_KEY')
    })

    it('refuses a JWT key that is neither PEM nor base64-encoded PEM', () => {
      const { errors } = checkEnv(productionEnv({ JWT_PUBLIC_KEY: 'not-a-key' }))
      expect(errors.join()).toContain('RS256 PEM')
    })

    it('refuses a wildcard CORS origin, which a credentialed API cannot honour', () => {
      const { errors } = checkEnv(productionEnv({ CORS_ORIGINS: '*' }))
      expect(errors.join()).toContain('must not contain "*"')
    })

    it('requires Redis, which sessions and rate limiting depend on', () => {
      const { errors } = checkEnv(productionEnv({ REDIS_HOST: undefined }))
      expect(errors.join()).toContain('REDIS_HOST')
    })

    it('warns — but does not fail — on a plain-HTTP origin', () => {
      const { errors, warnings } = checkEnv(productionEnv({ FRONTEND_URL: 'http://app.medicore.test' }))
      expect(errors).toEqual([])
      expect(warnings.join()).toContain('plain HTTP')
    })

    it('warns about a log-only SMS driver rather than silently shipping it', () => {
      const { errors, warnings } = checkEnv(productionEnv({ SMS_DRIVER: 'log' }))
      expect(errors).toEqual([])
      expect(warnings.join()).toContain('SMS_DRIVER=LOG')
    })

    it('warns when clinical documents would be written to container-local disk', () => {
      const { warnings } = checkEnv(productionEnv({ STORAGE_PROVIDER: 'local' }))
      expect(warnings.join()).toContain('STORAGE_PROVIDER')
    })

    it('warns when AI is enabled against a third-party provider (TD-0042)', () => {
      const { warnings } = checkEnv(productionEnv({ AI_ENABLED: 'true', AI_PROVIDER: 'OPENAI' }))
      expect(warnings.join()).toContain('BAA')
    })

    it('stays quiet about AI when the self-hosted provider is selected', () => {
      const { warnings } = checkEnv(productionEnv({ AI_ENABLED: 'true', AI_PROVIDER: 'OLLAMA' }))
      expect(warnings.join()).not.toContain('BAA')
    })
  })
})

describe('validateEnv', () => {
  afterEach(() => drainStartupWarnings())

  it('returns the environment untouched when it is safe', () => {
    const env = productionEnv()
    expect(validateEnv(env)).toBe(env)
  })

  it('aborts the boot, listing every problem at once', () => {
    expect(() =>
      validateEnv(productionEnv({ COOKIE_SECRET: undefined, REDIS_HOST: undefined })),
    ).toThrow(/2 environment problem\(s\)/)
  })
})

describe('drainStartupWarnings', () => {
  it('hands each warning over exactly once, so a replay cannot duplicate them', () => {
    checkEnv(productionEnv({ SMS_DRIVER: 'LOG' }))

    expect(drainStartupWarnings()).toHaveLength(1)
    expect(drainStartupWarnings()).toHaveLength(0)
  })
})
