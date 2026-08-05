import { generateKeyPairSync } from 'crypto'

import fastifyCookie from '@fastify/cookie'
import fastifyMultipart from '@fastify/multipart'
import { VersioningType } from '@nestjs/common'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { Test } from '@nestjs/testing'
import * as argon2 from 'argon2'
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

describe('Doctor documents + audit timeline (e2e)', () => {
  let app: NestFastifyApplication
  let server: Parameters<typeof request>[0]
  let adminToken: string
  let organizationId: string
  let hospitalId: string
  let departmentId: string
  let doctorId: string
  let doctorToken: string
  let secondDoctorId: string

  const unique = Date.now()
  const adminEmail = `e2e-docdocs-admin-${unique}@example.com`
  const orgSlug = `e2e-docdocs-org-${unique}`
  const doctorEmail = `e2e-docdocs-doctor-${unique}@example.com`
  const secondDoctorEmail = `e2e-docdocs-doctor2-${unique}@example.com`
  const doctorPassword = 'Passw0rd123'

  function authedAs(token: string) {
    return { Authorization: `Bearer ${token}` }
  }
  function authed() {
    return authedAs(adminToken)
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
      { resource: 'doctors', action: 'read', scope: 'all' },
      // The Doctor role below is granted `doctors.read` at `own` scope so it
      // can read its own audit timeline. This row must be upserted here rather
      // than assumed — otherwise the suite passes only against a test database
      // that happens to have been seeded by `seed.ts` beforehand.
      { resource: 'doctors', action: 'read', scope: 'own' },
      { resource: 'doctors', action: 'create', scope: 'all' },
      { resource: 'doctors', action: 'update', scope: 'all' },
      { resource: 'hospitals', action: 'read', scope: 'all' },
      { resource: 'hospitals', action: 'create', scope: 'all' },
      { resource: 'departments', action: 'read', scope: 'all' },
      { resource: 'departments', action: 'create', scope: 'all' },
      { resource: 'doctors.schedule', action: 'read', scope: 'all' },
      { resource: 'doctors.schedule', action: 'update', scope: 'all' },
      { resource: 'doctors.leave', action: 'read', scope: 'all' },
      { resource: 'doctors.leave', action: 'manage', scope: 'all' },
      { resource: 'doctors.documents', action: 'read', scope: 'all' },
      { resource: 'doctors.documents', action: 'manage', scope: 'all' },
      { resource: 'doctors.documents', action: 'read', scope: 'own' },
      { resource: 'doctors.documents', action: 'manage', scope: 'own' },
    ]
    for (const perm of requiredPermissions) {
      await prisma.permission.upsert({
        where: { resource_action_scope: perm },
        update: {},
        create: { ...perm, description: `${perm.action} ${perm.resource} (${perm.scope})` },
      })
    }

    const registerRes = await request(server)
      .post('/api/v1/auth/register')
      .send({
        organizationName: 'E2E Doctor Documents Org',
        organizationSlug: orgSlug,
        adminFirstName: 'E2E',
        adminLastName: 'Admin',
        adminEmail,
        adminPassword: 'Passw0rd123',
        phone: '9876543210',
      })
      .expect(201)
    adminToken = registerRes.body.data.accessToken

    const org = await prisma.organization.findUniqueOrThrow({ where: { slug: orgSlug } })
    organizationId = org.id

    const doctorRole = await prisma.role.create({
      data: { name: 'Doctor', systemRole: 'DOCTOR', organizationId, description: 'Doctor role' },
    })
    // Mirrors seed.ts's own-scope grants for the DOCTOR role, restricted to
    // what this suite exercises (documents own-scope + reading own profile
    // for the audit-timeline own-scope check).
    const ownPerms = await prisma.permission.findMany({
      where: {
        scope: 'own',
        OR: [
          { resource: 'doctors', action: 'read' },
          { resource: 'doctors.documents', action: 'read' },
          { resource: 'doctors.documents', action: 'manage' },
        ],
      },
    })
    await prisma.rolePermission.createMany({
      data: ownPerms.map((p) => ({ roleId: doctorRole.id, permissionId: p.id })),
    })

    const hospitalRes = await request(server)
      .post('/api/v1/hospitals')
      .set(authed())
      .send({ name: 'E2E Doctor Documents Hospital', code: 'E2EDD' })
      .expect(201)
    hospitalId = hospitalRes.body.data.id

    const departmentRes = await request(server)
      .post('/api/v1/departments')
      .set(authed())
      .send({ hospitalId, name: 'Cardiology', code: 'CARDIO' })
      .expect(201)
    departmentId = departmentRes.body.data.id

    const doctorRes = await request(server)
      .post('/api/v1/doctors')
      .set(authed())
      .send({
        email: doctorEmail,
        firstName: 'Priya',
        lastName: 'Sharma',
        registrationNumber: `MCI-DOCDOCS-${unique}`,
        specialization: 'Cardiology',
        qualification: 'MBBS, MD',
        experienceYears: 10,
        languagesSpoken: ['English'],
        consultationFee: 500,
        joiningDate: '2020-01-01',
        hospitalId,
        departmentId,
      })
      .expect(201)
    doctorId = doctorRes.body.data.id

    const secondDoctorRes = await request(server)
      .post('/api/v1/doctors')
      .set(authed())
      .send({
        email: secondDoctorEmail,
        firstName: 'Arjun',
        lastName: 'Rao',
        registrationNumber: `MCI-DOCDOCS2-${unique}`,
        specialization: 'Neurology',
        qualification: 'MBBS, DM',
        experienceYears: 8,
        languagesSpoken: ['English'],
        consultationFee: 600,
        joiningDate: '2021-01-01',
        hospitalId,
        departmentId,
      })
      .expect(201)
    secondDoctorId = secondDoctorRes.body.data.id

    // The onboarding email carries a randomly-generated temporary password
    // that isn't returned over the API — reset it directly so this suite can
    // log in as the doctor to exercise `.own`-scoped permission checks.
    await prisma.user.update({
      where: { email: doctorEmail },
      data: { passwordHash: await argon2.hash(doctorPassword) },
    })
    const doctorLoginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: doctorEmail, password: doctorPassword })
      .expect(200)
    doctorToken = doctorLoginRes.body.data.accessToken
  }, 30_000)

  afterAll(async () => {
    await app.close()
  })

  describe('documents CRUD', () => {
    let documentId: string

    it('uploads a document', async () => {
      const uploadRes = await request(server)
        .post(`/api/v1/doctors/${doctorId}/documents`)
        .set(authed())
        .field('documentType', 'MEDICAL_LICENSE')
        .attach('file', Buffer.from('%PDF-1.4 fake license'), {
          filename: 'license.pdf',
          contentType: 'application/pdf',
        })
        .expect(201)

      documentId = uploadRes.body.data.id
      expect(uploadRes.body.data.fileUrl).toContain('/uploads/')
      expect(uploadRes.body.data.documentType).toBe('MEDICAL_LICENSE')
    })

    it('rejects an unsupported file type', async () => {
      await request(server)
        .post(`/api/v1/doctors/${doctorId}/documents`)
        .set(authed())
        .field('documentType', 'OTHER')
        .attach('file', Buffer.from('#!/bin/sh\necho hi'), {
          filename: 'script.sh',
          contentType: 'application/x-sh',
        })
        .expect(400)
    })

    it('rejects an upload missing documentType', async () => {
      await request(server)
        .post(`/api/v1/doctors/${doctorId}/documents`)
        .set(authed())
        .attach('file', Buffer.from('%PDF-1.4 fake'), { filename: 'x.pdf', contentType: 'application/pdf' })
        .expect(400)
    })

    it('lists documents for the doctor', async () => {
      await request(server)
        .get(`/api/v1/doctors/${doctorId}/documents`)
        .set(authed())
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1)
          expect(res.body.data[0].id).toBe(documentId)
        })
    })

    it('lets a doctor upload and list their own documents', async () => {
      const uploadRes = await request(server)
        .post(`/api/v1/doctors/${doctorId}/documents`)
        .set(authedAs(doctorToken))
        .field('documentType', 'ID_PROOF')
        .attach('file', Buffer.from('%PDF-1.4 fake id'), { filename: 'id.pdf', contentType: 'application/pdf' })
        .expect(201)

      await request(server)
        .delete(`/api/v1/doctors/${doctorId}/documents/${uploadRes.body.data.id as string}`)
        .set(authedAs(doctorToken))
        .expect(200)
    })

    it("rejects a doctor uploading documents for someone else's profile", async () => {
      await request(server)
        .post(`/api/v1/doctors/${secondDoctorId}/documents`)
        .set(authedAs(doctorToken))
        .field('documentType', 'OTHER')
        .attach('file', Buffer.from('%PDF-1.4 fake'), { filename: 'x.pdf', contentType: 'application/pdf' })
        .expect(403)
    })

    it('deletes a document', async () => {
      await request(server)
        .delete(`/api/v1/doctors/${doctorId}/documents/${documentId}`)
        .set(authed())
        .expect(200)

      await request(server)
        .get(`/api/v1/doctors/${doctorId}/documents`)
        .set(authed())
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(0)
        })
    })

    it('rejects document routes without a bearer token', async () => {
      await request(server).get(`/api/v1/doctors/${doctorId}/documents`).expect(401)
    })
  })

  describe('audit timeline', () => {
    it('includes doctor-profile, document, and schedule events for the doctor', async () => {
      // Generates a `Doctor` audit event (resourceId = doctorId directly).
      await request(server)
        .patch(`/api/v1/doctors/${doctorId}`)
        .set(authed())
        .send({ bio: 'Updated bio for audit timeline test' })
        .expect(200)

      // Generates a `DoctorDocument` audit event (doctorId inside `after`).
      const uploadRes = await request(server)
        .post(`/api/v1/doctors/${doctorId}/documents`)
        .set(authed())
        .field('documentType', 'OTHER')
        .attach('file', Buffer.from('%PDF-1.4 fake'), { filename: 'timeline.pdf', contentType: 'application/pdf' })
        .expect(201)

      // Generates a `DoctorSchedule` audit event (doctorId inside `after`).
      await request(server)
        .post(`/api/v1/doctors/${doctorId}/schedule`)
        .set(authed())
        .send({
          effectiveFrom: '2020-01-01',
          days: [
            'SUNDAY',
            'MONDAY',
            'TUESDAY',
            'WEDNESDAY',
            'THURSDAY',
            'FRIDAY',
            'SATURDAY',
          ].map((dayOfWeek) => ({ dayOfWeek, isWorkingDay: false, shifts: [] })),
        })
        .expect(201)

      const timelineRes = await request(server)
        .get(`/api/v1/doctors/${doctorId}/audit-timeline`)
        .set(authed())
        .expect(200)

      const actions = (timelineRes.body.data.entries as Array<{ action: string }>).map((e) => e.action)
      expect(actions).toContain('doctor.updated')
      expect(actions).toContain('doctor.document_uploaded')
      expect(actions).toContain('doctor.schedule.created')

      // Cleanup so it doesn't interfere with the documents-CRUD describe block's counts.
      await request(server)
        .delete(`/api/v1/doctors/${doctorId}/documents/${uploadRes.body.data.id as string}`)
        .set(authed())
        .expect(200)
    })

    it("does not include another doctor's events", async () => {
      const timelineRes = await request(server)
        .get(`/api/v1/doctors/${secondDoctorId}/audit-timeline`)
        .set(authed())
        .expect(200)

      const actions = (timelineRes.body.data.entries as Array<{ action: string }>).map((e) => e.action)
      expect(actions).not.toContain('doctor.document_uploaded')
      expect(actions).not.toContain('doctor.schedule.created')
    })

    it('lets a doctor read their own audit timeline', async () => {
      await request(server)
        .get(`/api/v1/doctors/${doctorId}/audit-timeline`)
        .set(authedAs(doctorToken))
        .expect(200)
    })

    it("rejects a doctor reading someone else's audit timeline", async () => {
      await request(server)
        .get(`/api/v1/doctors/${secondDoctorId}/audit-timeline`)
        .set(authedAs(doctorToken))
        .expect(403)
    })
  })
})
