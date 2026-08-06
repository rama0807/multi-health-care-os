import { generateKeyPairSync } from 'crypto'

import fastifyCookie from '@fastify/cookie'
import fastifyMultipart from '@fastify/multipart'
import { VersioningType } from '@nestjs/common'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { Test } from '@nestjs/testing'
import { ZodValidationPipe } from 'nestjs-zod'
import request from 'supertest'

process.env.DATABASE_URL ??= 'postgresql://medicore:medicore@localhost:5434/medicore_test?schema=public'
process.env.REDIS_HOST ??= 'localhost'
process.env.REDIS_PORT ??= '6381'
process.env.COOKIE_SECRET ??= 'e2e-test-cookie-secret'
process.env.FRONTEND_URL ??= 'http://localhost:3000'
process.env.STORAGE_PROVIDER ??= 'local'
process.env.LOCAL_STORAGE_PATH ??= './uploads-e2e-test'

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
// eslint-disable-next-line import/order
import { PrismaService } from '../src/prisma/prisma.service'

describe('Platform & Multi-Tenant Administration (e2e)', () => {
  let app: NestFastifyApplication
  let server: Parameters<typeof request>[0]
  let prisma: PrismaService

  /** An ordinary customer-tenant organization admin. */
  let tenantToken: string
  let tenantOrgId: string

  /** A user inside the platform tenant, holding `platform.*`. */
  let platformToken: string

  let onboardedHospitalId: string

  const unique = Date.now()
  const tenantSlug = `e2e-m16-tenant-${unique}`
  const tenantEmail = `e2e-m16-tenant-${unique}@example.com`
  const platformSlug = `e2e-m16-platform-${unique}`
  const platformEmail = `e2e-m16-platform-${unique}@example.com`

  function tenantAuth() {
    return { Authorization: `Bearer ${tenantToken}` }
  }

  function platformAuth() {
    return { Authorization: `Bearer ${platformToken}` }
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile()

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter())
    await app.register(fastifyCookie, { secret: process.env.COOKIE_SECRET })
    await app.register(fastifyMultipart, { limits: { fileSize: 10 * 1024 * 1024 } })

    app.enableVersioning({ type: VersioningType.URI })
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ZodValidationPipe())
    app.useGlobalFilters(new HttpExceptionFilter())
    app.useGlobalInterceptors(new ResponseTransformInterceptor())

    await app.init()
    await app.getHttpAdapter().getInstance().ready()
    server = app.getHttpAdapter().getInstance().server
    prisma = app.get(PrismaService)

    const requiredPermissions = [
      ['organizations', ['read', 'update']],
      ['hospitals', ['read', 'create', 'update', 'delete']],
      ['departments', ['read', 'create']],
      ['audit', ['read']],
      ['platform', ['read']],
      ['platform.tenants', ['read', 'manage']],
      ['platform.subscriptions', ['read', 'manage']],
      ['platform.analytics', ['read']],
      ['platform.audit', ['read']],
    ] as const

    for (const [resource, actions] of requiredPermissions) {
      for (const action of actions) {
        await prisma.permission.upsert({
          where: { resource_action_scope: { resource, action, scope: 'all' } },
          update: {},
          create: { resource, action, scope: 'all', description: `${action} ${resource} (all)` },
        })
      }
    }

    // ── The customer tenant ────────────────────────────────────────────
    await request(server)
      .post('/api/v1/auth/register')
      .send({
        organizationName: 'E2E M16 Tenant',
        organizationSlug: tenantSlug,
        adminFirstName: 'Tenant',
        adminLastName: 'Admin',
        adminEmail: tenantEmail,
        adminPassword: 'Passw0rd123',
        phone: '9876543210',
      })
      .expect(201)

    tenantOrgId = (await prisma.organization.findUniqueOrThrow({ where: { slug: tenantSlug } })).id

    // ── The platform tenant ────────────────────────────────────────────
    const platformRes = await request(server)
      .post('/api/v1/auth/register')
      .send({
        organizationName: 'E2E M16 Platform',
        organizationSlug: platformSlug,
        adminFirstName: 'Platform',
        adminLastName: 'Owner',
        adminEmail: platformEmail,
        adminPassword: 'Passw0rd123',
        phone: '9876543211',
      })
      .expect(201)

    // Registration never mints a platform tenant - it must be promoted.
    expect(platformRes.body.data.user.isPlatform).toBe(false)

    const platformOrg = await prisma.organization.findUniqueOrThrow({
      where: { slug: platformSlug },
    })
    await prisma.organization.update({ where: { id: platformOrg.id }, data: { isPlatform: true } })

    // Grant the platform.* family, which registration deliberately withholds.
    const platformPermissions = await prisma.permission.findMany({
      where: { resource: { startsWith: 'platform' } },
    })
    const platformRole = await prisma.role.findFirstOrThrow({
      where: { organizationId: platformOrg.id, systemRole: 'ORG_ADMIN' },
    })
    for (const permission of platformPermissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: platformRole.id, permissionId: permission.id } },
        update: {},
        create: { roleId: platformRole.id, permissionId: permission.id },
      })
    }

    // Re-login so both tokens carry the freshly-resolved claims.
    const platformLogin = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: platformEmail, password: 'Passw0rd123' })
      .expect(200)
    platformToken = platformLogin.body.data.accessToken

    const tenantLogin = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: tenantEmail, password: 'Passw0rd123' })
      .expect(200)
    tenantToken = tenantLogin.body.data.accessToken
  }, 60_000)

  afterAll(async () => {
    await app.close()
  })

  // ── Checkpoint 16.3 - Tenant resolution ──────────────────────────────

  describe('Checkpoint 16.3 - tenant resolution', () => {
    it('resolves platform/organization on an authenticated request', async () => {
      const res = await request(server).get('/api/v1/auth/me').set(tenantAuth()).expect(200)

      expect(res.body.data.organizationId).toBe(tenantOrgId)
      expect(res.body.data.organizationSlug).toBe(tenantSlug)
      expect(res.body.data.isPlatform).toBe(false)
    })

    it('marks a platform-tenant user as a platform owner', async () => {
      const res = await request(server).get('/api/v1/auth/me').set(platformAuth()).expect(200)
      expect(res.body.data.isPlatform).toBe(true)
    })
  })

  // ── Checkpoint 16.1 - Organization management ────────────────────────

  describe('Checkpoint 16.1 - organization management', () => {
    it('returns the current organization and its statistics', async () => {
      const org = await request(server)
        .get('/api/v1/organizations/me')
        .set(tenantAuth())
        .expect(200)
      expect(org.body.data.slug).toBe(tenantSlug)

      const stats = await request(server)
        .get('/api/v1/organizations/me/stats')
        .set(tenantAuth())
        .expect(200)

      expect(stats.body.data.users.total).toBeGreaterThanOrEqual(1)
      expect(typeof stats.body.data.storageBytes).toBe('number')
    })

    it('updates the organization profile and records it in the audit trail', async () => {
      await request(server)
        .patch('/api/v1/organizations/me')
        .set(tenantAuth())
        .send({ city: 'Pune', taxId: '27AAAAA0000A1Z5' })
        .expect(200)

      const res = await request(server)
        .get('/api/v1/organizations/me/audit-logs')
        .set(tenantAuth())
        .query({ action: 'organization.updated' })
        .expect(200)

      expect(res.body.data.data.length).toBeGreaterThanOrEqual(1)
      expect(res.body.data.data[0].after.city).toBe('Pune')
    })

    it('onboards a hospital with departments in one call', async () => {
      const res = await request(server)
        .post('/api/v1/hospitals/onboard')
        .set(tenantAuth())
        .send({
          name: 'E2E M16 Hospital',
          code: `M16H${unique % 10000}`,
          city: 'Pune',
          departments: [
            { name: 'General Medicine', code: 'GENMED' },
            { name: 'Cardiology', code: 'CARDIO' },
          ],
        })
        .expect(201)

      onboardedHospitalId = res.body.data.hospital.id
      expect(res.body.data.departments).toHaveLength(2)
      expect(res.body.data.admin).toBeNull()
    })

    it('rejects an onboarding request with duplicate department codes', async () => {
      await request(server)
        .post('/api/v1/hospitals/onboard')
        .set(tenantAuth())
        .send({
          name: 'Bad Hospital',
          code: `M16BAD${unique % 10000}`,
          departments: [
            { name: 'Alpha', code: 'DUP' },
            { name: 'Beta', code: 'DUP' },
          ],
        })
        .expect(409)
    })

    it('deactivates and reactivates a hospital', async () => {
      await request(server)
        .delete(`/api/v1/hospitals/${onboardedHospitalId}`)
        .set(tenantAuth())
        .expect(200)

      let res = await request(server)
        .get(`/api/v1/hospitals/${onboardedHospitalId}`)
        .set(tenantAuth())
        .expect(200)
      expect(res.body.data.isActive).toBe(false)

      await request(server)
        .post(`/api/v1/hospitals/${onboardedHospitalId}/activate`)
        .set(tenantAuth())
        .expect(201)

      res = await request(server)
        .get(`/api/v1/hospitals/${onboardedHospitalId}`)
        .set(tenantAuth())
        .expect(200)
      expect(res.body.data.isActive).toBe(true)
    })

    it('lists the organization administrators', async () => {
      const res = await request(server)
        .get('/api/v1/organizations/me/admins')
        .set(tenantAuth())
        .expect(200)

      expect(res.body.data.some((a: { email: string }) => a.email === tenantEmail)).toBe(true)
    })

    it('reports real usage figures', async () => {
      const res = await request(server)
        .get('/api/v1/organizations/me/usage')
        .set(tenantAuth())
        .expect(200)

      expect(res.body.data.storage.byCategory.length).toBe(5)
      expect(res.body.data.users.total).toBeGreaterThanOrEqual(1)
      expect(res.body.data.api.windowDays).toBe(30)
      expect(res.body.data.api.daily.length).toBe(30)
    })
  })

  // ── Checkpoint 16.4 - Organization settings ──────────────────────────

  describe('Checkpoint 16.4 - organization settings', () => {
    it('merges a settings patch instead of replacing the blob', async () => {
      const before = await request(server)
        .get('/api/v1/organizations/me/settings')
        .set(tenantAuth())
        .expect(200)
      expect(before.body.data.uhidPrefix).toBeTruthy()

      const res = await request(server)
        .patch('/api/v1/organizations/me/settings')
        .set(tenantAuth())
        .send({ timezone: 'Asia/Kolkata', currency: 'INR', language: 'en-IN' })
        .expect(200)

      // The pre-existing keys every clinical module reads must survive.
      expect(res.body.data.uhidPrefix).toBe(before.body.data.uhidPrefix)
      expect(res.body.data.gstRate).toBe(before.body.data.gstRate)
      expect(res.body.data.language).toBe('en-IN')
    })

    it('stores working hours and feature flags', async () => {
      const res = await request(server)
        .patch('/api/v1/organizations/me/settings')
        .set(tenantAuth())
        .send({
          workingDays: [1, 2, 3, 4, 5],
          workingHoursStart: '08:00',
          workingHoursEnd: '20:00',
          featureFlags: { teleconsultation: true, aiAssistant: false },
        })
        .expect(200)

      expect(res.body.data.workingHoursStart).toBe('08:00')
      expect(res.body.data.featureFlags.teleconsultation).toBe(true)
    })

    it('rejects working hours that end before they start', async () => {
      await request(server)
        .patch('/api/v1/organizations/me/settings')
        .set(tenantAuth())
        .send({ workingHoursStart: '18:00', workingHoursEnd: '09:00' })
        .expect(400)
    })

    it('rejects a malformed brand colour', async () => {
      await request(server)
        .patch('/api/v1/organizations/me/branding')
        .set(tenantAuth())
        .send({ primaryColor: 'not-a-colour' })
        .expect(400)
    })

    it('saves branding separately from settings', async () => {
      const res = await request(server)
        .patch('/api/v1/organizations/me/branding')
        .set(tenantAuth())
        .send({ primaryColor: '#0F62FE', displayName: 'M16 Health' })
        .expect(200)

      expect(res.body.data.primaryColor).toBe('#0F62FE')

      const settings = await request(server)
        .get('/api/v1/organizations/me/settings')
        .set(tenantAuth())
        .expect(200)
      // Branding lives in its own column - settings are untouched.
      expect(settings.body.data.uhidPrefix).toBeTruthy()
      expect(settings.body.data.primaryColor).toBeUndefined()
    })
  })

  // ── Checkpoint 16.2 - Platform Owner console + isolation ─────────────

  describe('Checkpoint 16.2 - platform console isolation', () => {
    it('refuses every platform route to a customer-tenant admin', async () => {
      for (const path of [
        '/api/v1/platform/stats',
        '/api/v1/platform/organizations',
        '/api/v1/platform/hospitals',
        '/api/v1/platform/analytics',
        '/api/v1/platform/audit-logs',
        '/api/v1/platform/search?q=test',
      ]) {
        await request(server).get(path).set(tenantAuth()).expect(403)
      }
    })

    it('serves platform statistics to a platform owner', async () => {
      const res = await request(server).get('/api/v1/platform/stats').set(platformAuth()).expect(200)

      expect(res.body.data.organizations.total).toBeGreaterThanOrEqual(1)
      expect(res.body.data.api.windowDays).toBe(30)
      expect(typeof res.body.data.storageBytes).toBe('number')
      expect(typeof res.body.data.ai.totalRequests).toBe('number')
    })

    it('lists every organization and excludes the platform tenant by default', async () => {
      const res = await request(server)
        .get('/api/v1/platform/organizations')
        .set(platformAuth())
        .query({ search: tenantSlug })
        .expect(200)

      expect(res.body.data.data).toHaveLength(1)
      expect(res.body.data.data[0].slug).toBe(tenantSlug)
      expect(res.body.data.data[0].isPlatform).toBe(false)

      const withPlatform = await request(server)
        .get('/api/v1/platform/organizations')
        .set(platformAuth())
        .query({ search: platformSlug, includePlatform: 'true' })
        .expect(200)
      expect(withPlatform.body.data.data[0].isPlatform).toBe(true)
    })

    it('returns a tenant detail view with hospitals and admins', async () => {
      const res = await request(server)
        .get(`/api/v1/platform/organizations/${tenantOrgId}`)
        .set(platformAuth())
        .expect(200)

      expect(res.body.data.slug).toBe(tenantSlug)
      expect(res.body.data.hospitals.length).toBeGreaterThanOrEqual(1)
      expect(res.body.data.admins.some((a: { email: string }) => a.email === tenantEmail)).toBe(true)
    })

    it('lists hospitals across tenants with their owning organization', async () => {
      const res = await request(server)
        .get('/api/v1/platform/hospitals')
        .set(platformAuth())
        .query({ organizationId: tenantOrgId })
        .expect(200)

      expect(res.body.data.data.length).toBeGreaterThanOrEqual(1)
      expect(res.body.data.data[0].organizationName).toBe('E2E M16 Tenant')
    })

    it('runs a global search across organizations, hospitals and users', async () => {
      const res = await request(server)
        .get('/api/v1/platform/search')
        .set(platformAuth())
        .query({ q: tenantSlug })
        .expect(200)

      expect(res.body.data.some((r: { type: string }) => r.type === 'ORGANIZATION')).toBe(true)
    })

    it('returns platform analytics', async () => {
      const res = await request(server)
        .get('/api/v1/platform/analytics')
        .set(platformAuth())
        .expect(200)

      expect(Array.isArray(res.body.data.organizationGrowth)).toBe(true)
      expect(Array.isArray(res.body.data.topOrganizationsByUsers)).toBe(true)
    })

    it('serves a cross-tenant audit log naming each organization', async () => {
      const res = await request(server)
        .get('/api/v1/platform/audit-logs')
        .set(platformAuth())
        .query({ organizationId: tenantOrgId })
        .expect(200)

      expect(res.body.data.data.length).toBeGreaterThanOrEqual(1)
      expect(res.body.data.data[0].organizationName).toBe('E2E M16 Tenant')
    })
  })

  describe('Checkpoint 16.2 - subscriptions', () => {
    it('lets a tenant read but not write its own subscription', async () => {
      const res = await request(server)
        .get('/api/v1/organizations/me/subscription')
        .set(tenantAuth())
        .expect(200)
      expect(res.body.data.plan).toBe('FREE')

      await request(server)
        .put(`/api/v1/platform/organizations/${tenantOrgId}/subscription`)
        .set(tenantAuth())
        .send({ plan: 'ENTERPRISE' })
        .expect(403)
    })

    it('lets a platform owner set a plan with limits', async () => {
      const res = await request(server)
        .put(`/api/v1/platform/organizations/${tenantOrgId}/subscription`)
        .set(platformAuth())
        .send({
          plan: 'PROFESSIONAL',
          status: 'ACTIVE',
          maxHospitals: 5,
          maxUsers: 100,
          storageQuotaMb: 10240,
          monthlyPrice: 4999,
        })
        .expect(200)

      expect(res.body.data.plan).toBe('PROFESSIONAL')
      expect(res.body.data.maxUsers).toBe(100)
    })

    it('surfaces the new plan limits on the tenant usage view', async () => {
      const res = await request(server)
        .get('/api/v1/organizations/me/usage')
        .set(tenantAuth())
        .expect(200)

      expect(res.body.data.users.limit).toBe(100)
      expect(res.body.data.hospitals.limit).toBe(5)
      expect(res.body.data.storage.quotaMb).toBe(10240)
    })

    it('keeps the pre-existing subscriptionTier column in sync', async () => {
      const org = await prisma.organization.findUniqueOrThrow({ where: { id: tenantOrgId } })
      expect(org.subscriptionTier).toBe('PROFESSIONAL')
    })

    it('rejects an end date that is not after the start date', async () => {
      await request(server)
        .put(`/api/v1/platform/organizations/${tenantOrgId}/subscription`)
        .set(platformAuth())
        .send({
          plan: 'STARTER',
          startsAt: '2026-06-01T00:00:00.000Z',
          endsAt: '2026-05-01T00:00:00.000Z',
        })
        .expect(400)
    })
  })

  describe('Checkpoint 16.2 - tenant lifecycle', () => {
    it('suspends a tenant and blocks its users from logging in', async () => {
      await request(server)
        .post(`/api/v1/platform/organizations/${tenantOrgId}/suspend`)
        .set(platformAuth())
        .send({ reason: 'Non-payment' })
        .expect(201)

      const org = await prisma.organization.findUniqueOrThrow({ where: { id: tenantOrgId } })
      expect(org.status).toBe('SUSPENDED')
      expect(org.isActive).toBe(false)

      // The pre-existing auth path enforces it - no second control needed.
      await request(server)
        .post('/api/v1/auth/login')
        .send({ email: tenantEmail, password: 'Passw0rd123' })
        .expect(403)
    })

    it('rejects an empty suspension reason', async () => {
      await request(server)
        .post(`/api/v1/platform/organizations/${tenantOrgId}/suspend`)
        .set(platformAuth())
        .send({ reason: '' })
        .expect(400)
    })

    it('refuses to re-enable a suspended tenant, so the reason is never lost', async () => {
      await request(server)
        .post(`/api/v1/platform/organizations/${tenantOrgId}/enable`)
        .set(platformAuth())
        .expect(400)
    })

    it('reinstates a tenant and restores login', async () => {
      await request(server)
        .post(`/api/v1/platform/organizations/${tenantOrgId}/reinstate`)
        .set(platformAuth())
        .expect(201)

      const org = await prisma.organization.findUniqueOrThrow({ where: { id: tenantOrgId } })
      expect(org.status).toBe('ACTIVE')
      expect(org.suspensionReason).toBeNull()

      const login = await request(server)
        .post('/api/v1/auth/login')
        .send({ email: tenantEmail, password: 'Passw0rd123' })
        .expect(200)
      tenantToken = login.body.data.accessToken
    })

    it('records the suspension in the suspended tenant own audit trail', async () => {
      const res = await request(server)
        .get('/api/v1/organizations/me/audit-logs')
        .set(tenantAuth())
        .query({ action: 'platform.organization_suspended' })
        .expect(200)

      expect(res.body.data.data.length).toBeGreaterThanOrEqual(1)
    })

    it('refuses to suspend the platform tenant itself', async () => {
      const platformOrg = await prisma.organization.findUniqueOrThrow({
        where: { slug: platformSlug },
      })

      await request(server)
        .post(`/api/v1/platform/organizations/${platformOrg.id}/suspend`)
        .set(platformAuth())
        .send({ reason: 'should never work' })
        .expect(400)
    })
  })

  describe('Checkpoint 16.1 - audit log filtering', () => {
    it('paginates and filters by resource', async () => {
      const res = await request(server)
        .get('/api/v1/organizations/me/audit-logs')
        .set(tenantAuth())
        .query({ resource: 'Organization', limit: 2 })
        .expect(200)

      expect(res.body.data.data.length).toBeLessThanOrEqual(2)
      expect(res.body.data.pagination.limit).toBe(2)
      expect(
        res.body.data.data.every((row: { resource: string }) => row.resource === 'Organization'),
      ).toBe(true)
    })

    it('offers the distinct actions and resources present in the trail', async () => {
      const res = await request(server)
        .get('/api/v1/organizations/me/audit-logs/filters')
        .set(tenantAuth())
        .expect(200)

      expect(res.body.data.resources).toContain('Organization')
      expect(res.body.data.actions).toContain('organization.updated')
    })

    it('never returns another tenant audit rows', async () => {
      const res = await request(server)
        .get('/api/v1/organizations/me/audit-logs')
        .set(tenantAuth())
        .query({ limit: 100 })
        .expect(200)

      const orgIds = await prisma.auditLog.findMany({
        where: { id: { in: res.body.data.data.map((r: { id: string }) => r.id) } },
        select: { organizationId: true },
      })
      expect(orgIds.every((row) => row.organizationId === tenantOrgId)).toBe(true)
    })
  })
})
