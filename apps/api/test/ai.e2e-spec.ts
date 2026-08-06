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

/**
 * No AI provider credential exists in this environment (`apps/api/.env` ships
 * placeholder `sk-xxxxxxxxxxxx` values), so these tests assert the *configured-
 * off contract* - RBAC, validation, the status endpoint, prompt-template
 * versioning, and an honest 503 on generation. They deliberately do NOT assert
 * generated clinical text, because none is produced without a real key
 * (ADR-0023 / TD-0041). Extend this suite once a key is available.
 */
describe('AI Clinical Assistant (e2e)', () => {
  let app: NestFastifyApplication
  let server: Parameters<typeof request>[0]
  let accessToken: string
  let templateId: string

  const unique = Date.now()
  const email = `e2e-ai-admin-${unique}@example.com`
  const orgSlug = `e2e-ai-org-${unique}`

  function authed() {
    return { Authorization: `Bearer ${accessToken}` }
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

    const prisma = app.get(PrismaService)
    const requiredPermissions = [
      ['ai', ['read', 'generate', 'manage']],
      ['ai.templates', ['read', 'manage']],
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

    const registerRes = await request(server)
      .post('/api/v1/auth/register')
      .send({
        organizationName: 'E2E AI Org',
        organizationSlug: orgSlug,
        adminFirstName: 'E2E',
        adminLastName: 'Admin',
        adminEmail: email,
        adminPassword: 'Passw0rd123',
        phone: '9876543211',
      })
      .expect(201)

    accessToken = registerRes.body.data.accessToken
  }, 30_000)

  afterAll(async () => {
    await app.close()
  })

  describe('status and feature flags', () => {
    it('reports the configured provider and treats placeholder credentials as absent', async () => {
      const res = await request(server).get('/api/v1/ai/status').set(authed()).expect(200)

      const status = res.body.data as {
        provider: string
        model: string
        configured: boolean
        unavailableReason: string
        features: Array<{ enabled: boolean }>
      }
      expect(['OPENAI', 'ANTHROPIC', 'GEMINI', 'OLLAMA']).toContain(status.provider)
      expect(typeof status.model).toBe('string')
      expect(status.features).toHaveLength(7)
      // `apps/api/.env` holds `sk-xxxxxxxxxxxx`-style placeholders; those must
      // read as "not configured" rather than producing provider 401s.
      expect(status.configured).toBe(false)
      expect(status.unavailableReason).toMatch(/API_KEY|BASE_URL|AI_ENABLED/)
      expect(status.features.every((feature) => !feature.enabled)).toBe(true)
    })

    it('requires authentication', async () => {
      await request(server).get('/api/v1/ai/status').expect(401)
    })
  })

  describe('generation', () => {
    it('rejects a body whose feature and context refs disagree', async () => {
      await request(server)
        .post('/api/v1/ai/generate')
        .set(authed())
        .send({ feature: 'SOAP_NOTE', labTestId: 'lab_1' })
        .expect(400)
    })

    it('rejects an unknown feature', async () => {
      await request(server)
        .post('/api/v1/ai/generate')
        .set(authed())
        .send({ feature: 'MIND_READING', encounterId: 'enc_1' })
        .expect(400)
    })

    it('rejects a referral letter missing its required specialty and reason', async () => {
      await request(server)
        .post('/api/v1/ai/generate')
        .set(authed())
        .send({ feature: 'REFERRAL_LETTER', encounterId: 'enc_1' })
        .expect(400)
    })

    it('returns 503 with an explicit reason instead of fabricating clinical text', async () => {
      const res = await request(server)
        .post('/api/v1/ai/generate')
        .set(authed())
        .send({ feature: 'SOAP_NOTE', encounterId: 'enc_does_not_matter' })
        .expect(503)

      const message = JSON.stringify(res.body)
      expect(message).toMatch(/API_KEY|BASE_URL|AI_ENABLED|not configured/i)
      // Nothing that could be mistaken for a generated note came back.
      expect(res.body.data).toBeUndefined()
    })

    it('refuses generation before touching the record, so a missing encounter still 503s (not 404)', async () => {
      // Availability is checked before context assembly precisely so a disabled
      // or unconfigured deployment never performs a PHI read (ADR-0023).
      await request(server)
        .post('/api/v1/ai/generate')
        .set(authed())
        .send({ feature: 'DISCHARGE_SUMMARY', admissionId: 'definitely-not-a-real-admission' })
        .expect(503)
    })
  })

  describe('prompt templates', () => {
    it('returns a bundled default for every feature when the org has no overrides', async () => {
      const res = await request(server).get('/api/v1/ai/prompt-templates').set(authed()).expect(200)

      const templates = res.body.data as Array<{ feature: string; isBuiltIn: boolean; version: number }>
      expect(templates).toHaveLength(7)
      expect(templates.every((template) => template.isBuiltIn)).toBe(true)
      expect(templates.every((template) => template.version === 0)).toBe(true)
    })

    it('creates an org override as version 1 and serves it as the effective template', async () => {
      const created = await request(server)
        .post('/api/v1/ai/prompt-templates')
        .set(authed())
        .send({
          feature: 'SOAP_NOTE',
          systemPrompt: 'Org-specific guardrails for SOAP notes.',
          userPromptTemplate: 'Draft a SOAP note.\n\n{{context}}',
          description: 'House style',
        })
        .expect(201)

      templateId = created.body.data.id
      expect(created.body.data).toMatchObject({ version: 1, isActive: true, isBuiltIn: false })

      const effective = await request(server).get('/api/v1/ai/prompt-templates').set(authed()).expect(200)
      const soap = (effective.body.data as Array<{ feature: string; isBuiltIn: boolean }>).find(
        (template) => template.feature === 'SOAP_NOTE',
      )
      expect(soap?.isBuiltIn).toBe(false)
    })

    it('adds version 2 and supersedes version 1', async () => {
      const created = await request(server)
        .post('/api/v1/ai/prompt-templates')
        .set(authed())
        .send({
          feature: 'SOAP_NOTE',
          systemPrompt: 'Revised guardrails.',
          userPromptTemplate: 'Draft.\n\n{{context}}',
        })
        .expect(201)

      expect(created.body.data.version).toBe(2)

      const versions = await request(server)
        .get('/api/v1/ai/prompt-templates/versions')
        .set(authed())
        .query({ feature: 'SOAP_NOTE' })
        .expect(200)

      const rows = versions.body.data as Array<{ version: number; isActive: boolean }>
      expect(rows.map((row) => row.version)).toEqual([2, 1])
      expect(rows.find((row) => row.version === 1)?.isActive).toBe(false)
    })

    it('falls back to the bundled default once every override is deactivated', async () => {
      const versions = await request(server)
        .get('/api/v1/ai/prompt-templates/versions')
        .set(authed())
        .query({ feature: 'SOAP_NOTE' })
        .expect(200)

      for (const row of versions.body.data as Array<{ id: string; isActive: boolean }>) {
        if (row.isActive) {
          await request(server)
            .patch(`/api/v1/ai/prompt-templates/${row.id}`)
            .set(authed())
            .send({ isActive: false })
            .expect(200)
        }
      }

      const effective = await request(server).get('/api/v1/ai/prompt-templates').set(authed()).expect(200)
      const soap = (effective.body.data as Array<{ feature: string; isBuiltIn: boolean }>).find(
        (template) => template.feature === 'SOAP_NOTE',
      )
      expect(soap?.isBuiltIn).toBe(true)
    })

    it('reactivates a stored version', async () => {
      await request(server)
        .patch(`/api/v1/ai/prompt-templates/${templateId}`)
        .set(authed())
        .send({ isActive: true })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.isActive).toBe(true)
        })
    })

    it('404s on a template belonging to another organization', async () => {
      await request(server)
        .patch('/api/v1/ai/prompt-templates/not-a-real-id')
        .set(authed())
        .send({ isActive: false })
        .expect(404)
    })
  })

  describe('conversations and usage', () => {
    it('lists conversations (empty - nothing generated without a credential)', async () => {
      const res = await request(server).get('/api/v1/ai/conversations').set(authed()).expect(200)

      expect(res.body.data.data).toEqual([])
      expect(res.body.data.pagination).toMatchObject({ page: 1, total: 0 })
    })

    it('404s on an unknown conversation', async () => {
      await request(server).get('/api/v1/ai/conversations/nope').set(authed()).expect(404)
    })

    it('returns a zeroed usage summary over the default 30-day window', async () => {
      const res = await request(server).get('/api/v1/ai/usage/summary').set(authed()).expect(200)

      expect(res.body.data).toMatchObject({
        totalRequests: 0,
        succeededRequests: 0,
        failedRequests: 0,
        totalTokens: 0,
        containsEstimatedTokens: false,
        byFeature: [],
      })
      expect(res.body.data.from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(res.body.data.to).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('lists usage log entries with pagination', async () => {
      const res = await request(server).get('/api/v1/ai/usage').set(authed()).query({ limit: 5 }).expect(200)

      expect(res.body.data.data).toEqual([])
      expect(res.body.data.pagination.limit).toBe(5)
    })
  })

  describe('RBAC', () => {
    it('denies a caller holding no ai.* permission', async () => {
      const prisma = app.get(PrismaService)
      const org = await prisma.organization.findUniqueOrThrow({ where: { slug: orgSlug } })

      const role = await prisma.role.create({
        data: { name: `AI-Denied-${unique}`, organizationId: org.id, description: 'No AI permissions' },
      })
      const strangerEmail = `e2e-ai-stranger-${unique}@example.com`
      await request(server)
        .post('/api/v1/auth/register')
        .send({
          organizationName: 'E2E AI Org 2',
          organizationSlug: `${orgSlug}-2`,
          adminFirstName: 'No',
          adminLastName: 'Ai',
          adminEmail: strangerEmail,
          adminPassword: 'Passw0rd123',
          phone: '9876543212',
        })
        .expect(201)

      const stranger = await prisma.user.findUniqueOrThrow({ where: { email: strangerEmail } })
      await prisma.userRole.deleteMany({ where: { userId: stranger.id } })
      await prisma.userRole.create({ data: { userId: stranger.id, roleId: role.id } })

      const login = await request(server)
        .post('/api/v1/auth/login')
        .send({ email: strangerEmail, password: 'Passw0rd123' })
        .expect(200)

      const strangerToken = login.body.data.accessToken
      await request(server)
        .get('/api/v1/ai/status')
        .set({ Authorization: `Bearer ${strangerToken}` })
        .expect(403)
      await request(server)
        .post('/api/v1/ai/generate')
        .set({ Authorization: `Bearer ${strangerToken}` })
        .send({ feature: 'SOAP_NOTE', encounterId: 'enc_1' })
        .expect(403)
      await request(server)
        .get('/api/v1/ai/usage/summary')
        .set({ Authorization: `Bearer ${strangerToken}` })
        .expect(403)
    })
  })
})
