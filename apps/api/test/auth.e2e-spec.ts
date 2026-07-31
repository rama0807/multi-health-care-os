import { generateKeyPairSync } from 'crypto'

import fastifyCookie from '@fastify/cookie'
import { VersioningType } from '@nestjs/common'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { Test } from '@nestjs/testing'
import { ZodValidationPipe } from 'nestjs-zod'
import request, { Response } from 'supertest'

// Env vars are read lazily (Nest's `registerAs` factories run when the DI
// graph is built, not at import time) so setting them here — before the
// testing module is created — is enough, even though imports are hoisted.
process.env.DATABASE_URL ??= 'postgresql://medicore:medicore@localhost:5434/medicore_test?schema=public'
process.env.REDIS_HOST ??= 'localhost'
process.env.REDIS_PORT ??= '6381'
process.env.COOKIE_SECRET ??= 'e2e-test-cookie-secret'
process.env.FRONTEND_URL ??= 'http://localhost:3000'

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
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter'
// eslint-disable-next-line import/order
import { ResponseTransformInterceptor } from '../src/common/interceptors/response-transform.interceptor'

function extractCookie(setCookieHeaders: string[] | undefined, name: string): string | undefined {
  const header = setCookieHeaders?.find((c) => c.startsWith(`${name}=`))
  return header?.split(';')[0]
}

describe('Auth flow (e2e)', () => {
  let app: NestFastifyApplication
  let server: Parameters<typeof request>[0]

  const unique = Date.now()
  const email = `e2e-admin-${unique}@example.com`
  const orgSlug = `e2e-org-${unique}`

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile()

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter())
    await app.register(fastifyCookie, { secret: process.env.COOKIE_SECRET })

    app.enableVersioning({ type: VersioningType.URI })
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ZodValidationPipe())
    app.useGlobalFilters(new HttpExceptionFilter())
    app.useGlobalInterceptors(new ResponseTransformInterceptor())

    await app.init()
    await app.getHttpAdapter().getInstance().ready()
    server = app.getHttpAdapter().getInstance().server
  }, 30_000)

  afterAll(async () => {
    await app.close()
  })

  it('runs the full register -> login -> refresh -> theft-detection flow', async () => {
    // 1. Register a new organization + admin user.
    const registerRes = await request(server)
      .post('/api/v1/auth/register')
      .send({
        organizationName: 'E2E Test Org',
        organizationSlug: orgSlug,
        adminFirstName: 'E2E',
        adminLastName: 'Admin',
        adminEmail: email,
        adminPassword: 'Passw0rd123',
        phone: '9876543210',
      })
      .expect(201)

    expect(registerRes.body.data.accessToken).toBeTruthy()
    expect(registerRes.body.data.user.email).toBe(email)

    const setCookies = registerRes.headers['set-cookie'] as unknown as string[]
    const refreshCookieV1 = extractCookie(setCookies, 'medicore_rt')
    const csrfCookieV1 = extractCookie(setCookies, 'medicore_csrf')
    const csrfTokenV1 = csrfCookieV1?.split('=')[1]
    expect(refreshCookieV1).toBeTruthy()
    expect(csrfTokenV1).toBeTruthy()

    // 2. GET /me with the access token works.
    await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${registerRes.body.data.accessToken}`)
      .expect(200)
      .expect((res: Response) => {
        expect(res.body.data.email).toBe(email)
      })

    // 3. Rotate the refresh token.
    const refreshRes = await request(server)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [refreshCookieV1!, csrfCookieV1!])
      .set('X-CSRF-Token', csrfTokenV1!)
      .expect(200)

    // Note: we don't assert the access token differs from the pre-refresh one
    // — JWT signing is deterministic given an identical payload, and issuing
    // both tokens within the same wall-clock second (same `iat`) can
    // legitimately produce byte-identical tokens. The refresh *token* cookie
    // rotating (asserted below) is the real guarantee this flow provides.
    const newAccessToken = refreshRes.body.data.accessToken as string
    expect(newAccessToken).toBeTruthy()

    const rotatedSetCookies = refreshRes.headers['set-cookie'] as unknown as string[]
    const refreshCookieV2 = extractCookie(rotatedSetCookies, 'medicore_rt')
    const csrfCookieV2 = extractCookie(rotatedSetCookies, 'medicore_csrf')
    const csrfTokenV2 = csrfCookieV2?.split('=')[1]
    expect(refreshCookieV2).toBeTruthy()
    expect(refreshCookieV2).not.toBe(refreshCookieV1)

    // 4. Replaying the now-rotated (v1) refresh token is treated as theft —
    // and correctly kills the *whole* session, including the "legitimate"
    // v2 side, since we can't tell which side is the attacker.
    await request(server)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [refreshCookieV1!, csrfCookieV1!])
      .set('X-CSRF-Token', csrfTokenV1!)
      .expect(401)

    // 5. Proof the whole session died: even the v2 access token — issued
    // by the legitimate rotation just before the replay — is now rejected.
    await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${newAccessToken}`)
      .expect(401)

    // 6. And the v2 refresh cookie can no longer rotate either.
    await request(server)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [refreshCookieV2!, csrfCookieV2!])
      .set('X-CSRF-Token', csrfTokenV2!)
      .expect(401)
  }, 30_000)

  it('logs out cleanly and revokes the session immediately', async () => {
    const logoutEmail = `e2e-logout-${unique}@example.com`
    const logoutSlug = `e2e-logout-org-${unique}`

    const registerRes = await request(server)
      .post('/api/v1/auth/register')
      .send({
        organizationName: 'E2E Logout Org',
        organizationSlug: logoutSlug,
        adminFirstName: 'Logout',
        adminLastName: 'Test',
        adminEmail: logoutEmail,
        adminPassword: 'Passw0rd123',
        phone: '9876543210',
      })
      .expect(201)

    const accessToken = registerRes.body.data.accessToken as string
    const setCookies = registerRes.headers['set-cookie'] as unknown as string[]
    const refreshCookie = extractCookie(setCookies, 'medicore_rt')
    const csrfCookie = extractCookie(setCookies, 'medicore_csrf')
    const csrfToken = csrfCookie?.split('=')[1]

    await request(server)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', [refreshCookie!, csrfCookie!])
      .set('X-CSRF-Token', csrfToken!)
      .expect(200)

    // The access token issued before logout is rejected immediately — logout
    // revokes the session rather than waiting for the JWT's own 15min expiry.
    await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401)
  }, 30_000)

  it('locks the account after repeated failed login attempts', async () => {
    const lockEmail = `e2e-lockout-${unique}@example.com`
    const lockSlug = `e2e-lock-org-${unique}`

    await request(server)
      .post('/api/v1/auth/register')
      .send({
        organizationName: 'E2E Lockout Org',
        organizationSlug: lockSlug,
        adminFirstName: 'Lock',
        adminLastName: 'Test',
        adminEmail: lockEmail,
        adminPassword: 'Passw0rd123',
        phone: '9876543210',
      })
      .expect(201)

    for (let i = 0; i < 4; i++) {
      await request(server)
        .post('/api/v1/auth/login')
        .send({ email: lockEmail, password: 'wrong-password' })
        .expect(401)
    }

    // 5th failure crosses the threshold and locks the account.
    await request(server)
      .post('/api/v1/auth/login')
      .send({ email: lockEmail, password: 'wrong-password' })
      .expect(401)

    // Even the correct password is now rejected while locked.
    await request(server)
      .post('/api/v1/auth/login')
      .send({ email: lockEmail, password: 'Passw0rd123' })
      .expect(403)
  }, 30_000)
})
