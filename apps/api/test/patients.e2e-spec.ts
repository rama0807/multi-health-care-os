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
      { resource: 'patients', action: 'manage', scope: 'all' },
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

  it('links two patients as a family, lists the group, then unlinks', async () => {
    const headRes = await request(server)
      .post('/api/v1/patients')
      .set(authed())
      .send({
        firstName: 'Ramesh',
        lastName: 'Gupta',
        phone: '9811100001',
        dateOfBirth: '1975-02-10',
        gender: 'MALE',
      })
      .expect(201)
    const memberRes = await request(server)
      .post('/api/v1/patients')
      .set(authed())
      .send({
        firstName: 'Sunita',
        lastName: 'Gupta',
        phone: '9811100002',
        dateOfBirth: '2001-06-01',
        gender: 'FEMALE',
      })
      .expect(201)

    const headId = headRes.body.data.id as string
    const memberId = memberRes.body.data.id as string

    await request(server)
      .patch(`/api/v1/patients/${memberId}/family`)
      .set(authed())
      .send({ headOfFamilyId: headId })
      .expect(200)
      .expect((res) => {
        expect(res.body.data.headOfFamilyId).toBe(headId)
      })

    await request(server)
      .get(`/api/v1/patients/${memberId}/family`)
      .set(authed())
      .expect(200)
      .expect((res) => {
        expect(res.body.data.headOfFamily.id).toBe(headId)
        expect(res.body.data.members.map((m: { id: string }) => m.id)).toContain(memberId)
      })

    await request(server).delete(`/api/v1/patients/${memberId}/family`).set(authed()).expect(200)

    await request(server)
      .get(`/api/v1/patients/${memberId}/family`)
      .set(authed())
      .expect(200)
      .expect((res) => {
        expect(res.body.data.headOfFamily.id).toBe(memberId)
      })
  })

  it('merges a duplicate patient into a survivor, reassigning linked records', async () => {
    const survivorRes = await request(server)
      .post('/api/v1/patients')
      .set(authed())
      .send({
        firstName: 'Meera',
        lastName: 'Iyer',
        phone: '9822200001',
        dateOfBirth: '1992-08-15',
        gender: 'FEMALE',
      })
      .expect(201)
    const duplicateRes = await request(server)
      .post('/api/v1/patients')
      .set(authed())
      .send({
        firstName: 'Meera',
        lastName: 'Iyer',
        phone: '9822200002',
        dateOfBirth: '1992-08-15',
        gender: 'FEMALE',
      })
      .expect(201)

    const survivorId = survivorRes.body.data.id as string
    const duplicateId = duplicateRes.body.data.id as string

    // Give the duplicate a document so there's something real to reassign.
    const uploadRes = await request(server)
      .post(`/api/v1/patients/${duplicateId}/documents`)
      .set(authed())
      .field('documentType', 'AADHAAR')
      .attach('file', Buffer.from('%PDF-1.4 fake content'), {
        filename: 'aadhaar.pdf',
        contentType: 'application/pdf',
      })
      .expect(201)

    await request(server)
      .post('/api/v1/patients/merge')
      .set(authed())
      .send({ sourcePatientId: duplicateId, targetPatientId: survivorId })
      .expect(201)
      .expect((res) => {
        expect(res.body.data.survivorPatientId).toBe(survivorId)
        expect(res.body.data.mergedPatientId).toBe(duplicateId)
        expect(res.body.data.reassignedCounts.patientDocument).toBe(1)
      })

    // The merged record is soft-deleted...
    await request(server).get(`/api/v1/patients/${duplicateId}`).set(authed()).expect(404)

    // ...and cannot be independently restored.
    await request(server).post(`/api/v1/patients/${duplicateId}/restore`).set(authed()).expect(400)

    // The document moved to the survivor.
    await request(server)
      .get(`/api/v1/patients/${survivorId}/documents`)
      .set(authed())
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toHaveLength(1)
        expect(res.body.data[0].id).toBe(uploadRes.body.data.id)
      })
  })

  it('imports patients from a CSV file, reporting per-row success and failure', async () => {
    const csv = [
      'firstName,lastName,phone,dateOfBirth,gender',
      'Karan,Mehta,9833300001,1995-04-12,MALE',
      'Bad,Row,123,not-a-date,MALE',
    ].join('\n')

    const res = await request(server)
      .post('/api/v1/patients/import')
      .set(authed())
      .attach('file', Buffer.from(csv), { filename: 'patients.csv', contentType: 'text/csv' })
      .expect(201)

    expect(res.body.data.total).toBe(2)
    expect(res.body.data.created).toBe(1)
    expect(res.body.data.failed).toBe(1)
    expect(res.body.data.results[0]).toEqual(expect.objectContaining({ row: 2, success: true }))
    expect(res.body.data.results[1]).toEqual(expect.objectContaining({ row: 3, success: false }))

    await request(server)
      .get('/api/v1/patients/search')
      .set(authed())
      .query({ phone: '9833300001' })
      .expect(200)
      .expect((res2) => {
        expect(res2.body.data.data).toHaveLength(1)
      })
  })

  it('rejects patient routes without a bearer token', async () => {
    await request(server).get('/api/v1/patients').expect(401)
  })
})
