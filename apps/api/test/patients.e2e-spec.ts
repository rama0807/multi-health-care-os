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

describe('Patients (e2e)', () => {
  let app: NestFastifyApplication
  let server: Parameters<typeof request>[0]
  let accessToken: string

  const unique = Date.now()
  const email = `e2e-patients-admin-${unique}@example.com`
  const orgSlug = `e2e-patients-org-${unique}`

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

    // Ensure the patients permission catalog exists in the test DB regardless
    // of whether `db:seed` has been run against it — /auth/register grants
    // the new org's admin role every row currently in the Permission table.
    const prisma = app.get(PrismaService)
    const patientPermissions = [
      { resource: 'patients', action: 'read', scope: 'all' },
      { resource: 'patients', action: 'create', scope: 'all' },
      { resource: 'patients', action: 'update', scope: 'all' },
      { resource: 'patients', action: 'delete', scope: 'all' },
    ]
    for (const perm of patientPermissions) {
      await prisma.permission.upsert({
        where: { resource_action_scope: perm },
        update: {},
        create: { ...perm, description: `${perm.action} ${perm.resource} (${perm.scope})` },
      })
    }

    const registerRes = await request(server)
      .post('/api/v1/auth/register')
      .send({
        organizationName: 'E2E Patients Org',
        organizationSlug: orgSlug,
        adminFirstName: 'E2E',
        adminLastName: 'Admin',
        adminEmail: email,
        adminPassword: 'Passw0rd123',
        phone: '9876543210',
      })
      .expect(201)

    accessToken = registerRes.body.data.accessToken
  }, 30_000)

  afterAll(async () => {
    await app.close()
  })

  function authed() {
    return { Authorization: `Bearer ${accessToken}` }
  }

  it('registers a patient with a generated UHID', async () => {
    const res = await request(server)
      .post('/api/v1/patients')
      .set(authed())
      .send({
        firstName: 'Asha',
        lastName: 'Rao',
        phone: '9812345670',
        dateOfBirth: '1990-05-15',
        gender: 'FEMALE',
      })
      .expect(201)

    // AuthService.register derives uhidPrefix from the org slug's first 4
    // characters uppercased (not a fixed "MED") — see auth.service.ts.
    const expectedPrefix = orgSlug.toUpperCase().slice(0, 4)
    expect(res.body.data.uhid).toMatch(new RegExp(`^${expectedPrefix}-\\d{4}-\\d{6}$`))
    expect(res.body.data.fullName).toBe('Asha Rao')
  })

  it('rejects a second registration with the same phone number', async () => {
    await request(server)
      .post('/api/v1/patients')
      .set(authed())
      .send({
        firstName: 'Duplicate',
        lastName: 'Person',
        phone: '9812345670',
        dateOfBirth: '1985-01-01',
        gender: 'MALE',
      })
      .expect(409)
  })

  it('runs the full profile -> search -> duplicate-check -> update -> timeline -> documents -> delete -> restore flow', async () => {
    const createRes = await request(server)
      .post('/api/v1/patients')
      .set(authed())
      .send({
        firstName: 'Vikram',
        lastName: 'Nair',
        phone: '9900112233',
        dateOfBirth: '1988-11-20',
        gender: 'MALE',
      })
      .expect(201)

    const patientId = createRes.body.data.id as string

    // GET by id
    await request(server)
      .get(`/api/v1/patients/${patientId}`)
      .set(authed())
      .expect(200)
      .expect((res) => {
        expect(res.body.data.uhid).toBe(createRes.body.data.uhid)
        expect(res.body.data.summary).toEqual(
          expect.objectContaining({ appointments: 0, admissions: 0 }),
        )
      })

    // List / search
    await request(server)
      .get('/api/v1/patients')
      .set(authed())
      .query({ q: 'Vikram' })
      .expect(200)
      .expect((res) => {
        const patients = res.body.data.data as Array<{ id: string }>
        expect(patients.some((p) => p.id === patientId)).toBe(true)
      })

    await request(server)
      .get('/api/v1/patients/search')
      .set(authed())
      .query({ phone: '9900112233' })
      .expect(200)
      .expect((res) => {
        expect(res.body.data.data).toHaveLength(1)
      })

    // Duplicate detection against the same phone number
    await request(server)
      .get('/api/v1/patients/duplicates/check')
      .set(authed())
      .query({ phone: '9900112233' })
      .expect(200)
      .expect((res) => {
        expect(res.body.data.matches[0].confidence).toBeGreaterThan(0)
        expect(res.body.data.matches[0].patient.id).toBe(patientId)
      })

    // Update
    await request(server)
      .patch(`/api/v1/patients/${patientId}`)
      .set(authed())
      .send({ city: 'Bengaluru' })
      .expect(200)
      .expect((res) => {
        expect(res.body.data.city).toBe('Bengaluru')
      })

    // Timeline includes the registration event
    await request(server)
      .get(`/api/v1/patients/${patientId}/timeline`)
      .set(authed())
      .expect(200)
      .expect((res) => {
        const entries = res.body.data.entries as Array<{ type: string }>
        expect(entries.some((e) => e.type === 'REGISTRATION')).toBe(true)
      })

    // Document upload / list / delete
    const uploadRes = await request(server)
      .post(`/api/v1/patients/${patientId}/documents`)
      .set(authed())
      .field('documentType', 'AADHAAR')
      .attach('file', Buffer.from('%PDF-1.4 fake content'), {
        filename: 'aadhaar.pdf',
        contentType: 'application/pdf',
      })
      .expect(201)

    const documentId = uploadRes.body.data.id as string
    expect(uploadRes.body.data.fileUrl).toContain('/uploads/')

    await request(server)
      .get(`/api/v1/patients/${patientId}/documents`)
      .set(authed())
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toHaveLength(1)
      })

    await request(server)
      .delete(`/api/v1/patients/${patientId}/documents/${documentId}`)
      .set(authed())
      .expect(200)

    // Soft delete then restore
    await request(server).delete(`/api/v1/patients/${patientId}`).set(authed()).expect(200)

    await request(server).get(`/api/v1/patients/${patientId}`).set(authed()).expect(404)

    await request(server).post(`/api/v1/patients/${patientId}/restore`).set(authed()).expect(201)

    await request(server).get(`/api/v1/patients/${patientId}`).set(authed()).expect(200)
  }, 30_000)

  it('rejects patient routes without a bearer token', async () => {
    await request(server).get('/api/v1/patients').expect(401)
  })
})
