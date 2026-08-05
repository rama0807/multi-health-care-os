import { generateKeyPairSync } from 'crypto'

import { ConfigService } from '@nestjs/config'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { Test } from '@nestjs/testing'
import request from 'supertest'

process.env.DATABASE_URL ??= 'postgresql://medicore:medicore@localhost:5434/medicore_test?schema=public'
process.env.REDIS_HOST ??= 'localhost'
process.env.REDIS_PORT ??= '6381'
process.env.COOKIE_SECRET ??= 'e2e-test-cookie-secret'
process.env.FRONTEND_URL ??= 'http://localhost:3000'
process.env.STORAGE_PROVIDER ??= 'local'
process.env.LOCAL_STORAGE_PATH ??= './uploads-e2e-test'
process.env.NOTIFICATIONS_WORKER_ENABLED = 'false'
// Exercised by the metrics-authentication assertions below.
process.env.METRICS_TOKEN = 'e2e-metrics-token'

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})
process.env.JWT_PRIVATE_KEY = Buffer.from(privateKey).toString('base64')
process.env.JWT_PUBLIC_KEY = Buffer.from(publicKey).toString('base64')

// eslint-disable-next-line import/order
import { AppModule } from '../src/app.module'
// eslint-disable-next-line import/order
import { configureApp, createHttpAdapter, registerPlugins } from '../src/bootstrap'
// eslint-disable-next-line import/order
import { HealthService } from '../src/modules/health/health.service'

/**
 * Milestone 19 — the hardening that only exists at the HTTP layer.
 *
 * Unlike every other e2e suite here, this one boots the app through
 * `src/bootstrap.ts` — the same `createHttpAdapter` / `registerPlugins` /
 * `configureApp` the real process calls. That is the point: a security header
 * or a probe asserted against a hand-rolled test app proves nothing about what
 * ships. Anything asserted below is genuinely in `main.ts`'s path.
 */
describe('Production hardening (e2e)', () => {
  let app: NestFastifyApplication
  let server: Parameters<typeof request>[0]

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile()

    app = moduleFixture.createNestApplication<NestFastifyApplication>(createHttpAdapter())
    const config = app.get(ConfigService)

    await registerPlugins(app, config)
    configureApp(app, config)

    await app.init()
    await app.getHttpAdapter().getInstance().ready()
    server = app.getHttpAdapter().getInstance().server
  })

  afterAll(async () => {
    await app?.close()
  })

  describe('19.1 — security headers', () => {
    it('sends a strict CSP, frame denial and nosniff on an API response', async () => {
      const response = await request(server).get('/api/health').expect(200)

      expect(response.headers['content-security-policy']).toContain("default-src 'none'")
      expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'")
      expect(response.headers['x-frame-options']).toBe('DENY')
      expect(response.headers['x-content-type-options']).toBe('nosniff')
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
      expect(response.headers['cross-origin-opener-policy']).toBe('same-origin')
    })

    it('does not advertise the framework', async () => {
      const response = await request(server).get('/api/health').expect(200)

      expect(response.headers['x-powered-by']).toBeUndefined()
    })

    it('omits HSTS outside production, so a developer browser is not pinned to HTTPS', async () => {
      const response = await request(server).get('/api/health').expect(200)

      expect(response.headers['strict-transport-security']).toBeUndefined()
    })
  })

  describe('19.1 — CORS', () => {
    it('allows the configured front end with credentials', async () => {
      const response = await request(server)
        .options('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000')
      expect(response.headers['access-control-allow-credentials']).toBe('true')
    })

    it('refuses an origin that is not configured', async () => {
      const response = await request(server)
        .options('/api/v1/auth/login')
        .set('Origin', 'https://evil.example.com')
        .set('Access-Control-Request-Method', 'POST')

      expect(response.headers['access-control-allow-origin']).toBeUndefined()
    })

    it('exposes the correlation headers so a browser client can read them back', async () => {
      const response = await request(server)
        .get('/api/health')
        .set('Origin', 'http://localhost:3000')
        .expect(200)

      expect(response.headers['access-control-expose-headers']?.toLowerCase()).toContain('x-request-id')
    })
  })

  describe('19.4 — correlation and trace propagation', () => {
    it('mints a request id and echoes it on every response', async () => {
      const response = await request(server).get('/api/health').expect(200)

      expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
      expect(response.headers['traceparent']).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/)
    })

    it('honours a caller-supplied request id, so one id spans the whole call chain', async () => {
      const response = await request(server)
        .get('/api/health')
        .set('x-request-id', 'gateway-abc-123')
        .expect(200)

      expect(response.headers['x-request-id']).toBe('gateway-abc-123')
    })

    it('accepts the x-correlation-id spelling too', async () => {
      const response = await request(server)
        .get('/api/health')
        .set('x-correlation-id', 'corr-xyz-789')
        .expect(200)

      expect(response.headers['x-request-id']).toBe('corr-xyz-789')
    })

    it('replaces an unsafe supplied id rather than reflecting it into the logs', async () => {
      const response = await request(server)
        .get('/api/health')
        .set('x-request-id', 'bad id with spaces and \\ttabs')
        .expect(200)

      expect(response.headers['x-request-id']).not.toContain(' ')
      expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
    })

    it('continues an upstream trace, giving this service its own span', async () => {
      const traceId = '4bf92f3577b34da6a3ce929d0e0e4736'
      const response = await request(server)
        .get('/api/health')
        .set('traceparent', `00-${traceId}-00f067aa0ba902b7-01`)
        .expect(200)

      expect(response.headers['traceparent']).toContain(traceId)
      expect(response.headers['traceparent']).not.toContain('00f067aa0ba902b7')
    })

    it('returns the same id in an error body as in the header', async () => {
      const response = await request(server).get('/api/v1/patients').expect(401)

      expect(response.body.meta.requestId).toBe(response.headers['x-request-id'])
      expect(response.body.meta.traceId).toMatch(/^[0-9a-f]{32}$/)
    })
  })

  describe('19.4 — health probes', () => {
    it('serves the detailed check at both the versioned and version-neutral paths', async () => {
      const neutral = await request(server).get('/api/health').expect(200)
      const versioned = await request(server).get('/api/v1/health').expect(200)

      expect(neutral.body.data).toMatchObject({ status: 'ok', database: true, redis: true })
      expect(versioned.body.data.status).toBe('ok')
    })

    it('answers liveness without touching a dependency', async () => {
      const response = await request(server).get('/api/health/live').expect(200)

      expect(response.body.data).toMatchObject({ status: 'ok' })
      expect(response.body.data.uptimeSeconds).toBeGreaterThanOrEqual(0)
    })

    it('reports readiness with each dependency measured', async () => {
      const response = await request(server).get('/api/health/ready').expect(200)

      expect(response.body.data.status).toBe('ready')
      expect(response.body.data.dependencies.database.status).toBe('up')
      expect(response.body.data.dependencies.redis.status).toBe('up')
    })

    it('turns readiness off while draining, but leaves liveness up', async () => {
      const health = app.get(HealthService)
      health.beginShutdown()

      try {
        await request(server).get('/api/health/ready').expect(503)
        // Liveness must stay green — an orchestrator would otherwise kill an
        // instance that is deliberately finishing its in-flight work.
        await request(server).get('/api/health/live').expect(200)
      } finally {
        // The flag is one-way by design; restore it for the remaining tests.
        ;(health as unknown as { shuttingDown: boolean }).shuttingDown = false
      }
    })

    it('leaves the probes public — an unauthenticated orchestrator must reach them', async () => {
      await request(server).get('/api/health/live').expect(200)
      await request(server).get('/api/health/ready').expect(200)
    })
  })

  describe('19.4 — Prometheus metrics', () => {
    it('refuses a scrape with no token', async () => {
      await request(server).get('/api/metrics').expect(403)
    })

    it('refuses a scrape with the wrong token', async () => {
      await request(server).get('/api/metrics').set('Authorization', 'Bearer wrong').expect(403)
    })

    it('serves the exposition format to an authenticated scrape', async () => {
      const response = await request(server)
        .get('/api/metrics')
        .set('Authorization', `Bearer ${process.env.METRICS_TOKEN}`)
        .expect(200)

      expect(response.text).toContain('http_requests_total')
      expect(response.text).toContain('http_request_duration_seconds')
      expect(response.text).toContain('medicore_dependency_up')
    })

    it('labels requests by route pattern, never by URL — no id cardinality', async () => {
      await request(server).get('/api/v1/patients/some-patient-id').expect(401)

      const response = await request(server)
        .get('/api/metrics')
        .set('Authorization', `Bearer ${process.env.METRICS_TOKEN}`)
        .expect(200)

      expect(response.text).not.toContain('some-patient-id')
    })
  })

  describe('19.1 — throttling', () => {
    it('gives credential endpoints a much smaller budget than ordinary reads', async () => {
      const login = await request(server)
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'wrong-password' })
      const read = await request(server).get('/api/health')

      expect(Number(login.headers['x-ratelimit-limit'])).toBeLessThan(
        Number(read.headers['x-ratelimit-limit']),
      )
    })

    it('exempts the metrics endpoint, so a scrape cannot be rate-limited away', async () => {
      const response = await request(server)
        .get('/api/metrics')
        .set('Authorization', `Bearer ${process.env.METRICS_TOKEN}`)
        .expect(200)

      expect(response.headers['x-ratelimit-limit']).toBeUndefined()
    })
  })
})
