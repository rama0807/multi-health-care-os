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

describe('Medical Records / EMR (e2e)', () => {
  let app: NestFastifyApplication
  let server: Parameters<typeof request>[0]
  let adminToken: string
  let doctorId: string
  let doctorToken: string
  let secondDoctorId: string
  let patientId: string

  const unique = Date.now()
  const adminEmail = `e2e-emr-admin-${unique}@example.com`
  const orgSlug = `e2e-emr-org-${unique}`
  const doctorEmail = `e2e-emr-doctor-${unique}@example.com`
  const secondDoctorEmail = `e2e-emr-doctor2-${unique}@example.com`
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
      { resource: 'doctors', action: 'create', scope: 'all' },
      { resource: 'hospitals', action: 'read', scope: 'all' },
      { resource: 'hospitals', action: 'create', scope: 'all' },
      { resource: 'departments', action: 'read', scope: 'all' },
      { resource: 'departments', action: 'create', scope: 'all' },
      { resource: 'patients', action: 'create', scope: 'all' },
      { resource: 'medical_records', action: 'read', scope: 'all' },
      { resource: 'medical_records', action: 'create', scope: 'all' },
      { resource: 'medical_records', action: 'update', scope: 'all' },
      { resource: 'medical_records', action: 'read', scope: 'own' },
      { resource: 'medical_records', action: 'update', scope: 'own' },
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
        organizationName: 'E2E EMR Org',
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
    const organizationId = org.id

    const doctorRole = await prisma.role.create({
      data: { name: 'Doctor', systemRole: 'DOCTOR', organizationId, description: 'Doctor role' },
    })
    const ownPerms = await prisma.permission.findMany({
      where: {
        scope: 'own',
        OR: [
          { resource: 'medical_records', action: 'read' },
          { resource: 'medical_records', action: 'update' },
        ],
      },
    })
    await prisma.rolePermission.createMany({
      data: ownPerms.map((p) => ({ roleId: doctorRole.id, permissionId: p.id })),
    })

    const hospitalRes = await request(server)
      .post('/api/v1/hospitals')
      .set(authed())
      .send({ name: 'E2E EMR Hospital', code: 'E2EEMR' })
      .expect(201)
    const hospitalId = hospitalRes.body.data.id

    const departmentRes = await request(server)
      .post('/api/v1/departments')
      .set(authed())
      .send({ hospitalId, name: 'General Medicine', code: 'GENMED' })
      .expect(201)
    const departmentId = departmentRes.body.data.id

    const doctorRes = await request(server)
      .post('/api/v1/doctors')
      .set(authed())
      .send({
        email: doctorEmail,
        firstName: 'Priya',
        lastName: 'Sharma',
        registrationNumber: `MCI-EMR-${unique}`,
        specialization: 'General Medicine',
        qualification: 'MBBS',
        experienceYears: 6,
        languagesSpoken: ['English'],
        consultationFee: 400,
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
        registrationNumber: `MCI-EMR2-${unique}`,
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

    const patientRes = await request(server)
      .post('/api/v1/patients')
      .set(authed())
      .send({
        firstName: 'Anita',
        lastName: 'Desai',
        phone: '9123456780',
        dateOfBirth: '1990-05-15',
        gender: 'FEMALE',
      })
      .expect(201)
    patientId = patientRes.body.data.id

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

  describe('encounters', () => {
    let encounterId: string

    it('creates an encounter', async () => {
      const res = await request(server)
        .post('/api/v1/encounters')
        .set(authed())
        .send({ patientId, doctorId, type: 'OPD', notes: 'Routine visit' })
        .expect(201)

      encounterId = res.body.data.id
      expect(res.body.data.status).toBe('IN_PROGRESS')
    })

    it('reads the encounter back with patient/doctor details', async () => {
      const res = await request(server).get(`/api/v1/encounters/${encounterId}`).set(authed()).expect(200)

      expect(res.body.data.patient.fullName).toBe('Anita Desai')
      expect(res.body.data.doctor.fullName).toBe('Priya Sharma')
    })

    it('lists encounters filtered by patient', async () => {
      const res = await request(server)
        .get(`/api/v1/encounters?patientId=${patientId}`)
        .set(authed())
        .expect(200)

      expect(res.body.data.data.length).toBeGreaterThanOrEqual(1)
    })

    describe('clinical notes (versioned)', () => {
      it('creates version 1', async () => {
        const res = await request(server)
          .post(`/api/v1/encounters/${encounterId}/clinical-notes`)
          .set(authed())
          .send({ chiefComplaint: 'Fever for 3 days', allergies: 'None known' })
          .expect(201)

        expect(res.body.data.version).toBe(1)
      })

      it('creates version 2 without overwriting version 1', async () => {
        const res = await request(server)
          .post(`/api/v1/encounters/${encounterId}/clinical-notes`)
          .set(authed())
          .send({ chiefComplaint: 'Fever for 3 days, now with cough', allergies: 'None known' })
          .expect(201)

        expect(res.body.data.version).toBe(2)

        const historyRes = await request(server)
          .get(`/api/v1/encounters/${encounterId}/clinical-notes`)
          .set(authed())
          .expect(200)

        expect(historyRes.body.data.notes).toHaveLength(2)
        expect(historyRes.body.data.notes.map((n: { version: number }) => n.version)).toEqual([2, 1])
      })

      it('returns the current (highest-version) note', async () => {
        const res = await request(server)
          .get(`/api/v1/encounters/${encounterId}/clinical-notes/current`)
          .set(authed())
          .expect(200)

        expect(res.body.data.version).toBe(2)
        expect(res.body.data.chiefComplaint).toContain('cough')
      })
    })

    describe('vitals', () => {
      it('records vitals and computes BMI', async () => {
        const res = await request(server)
          .post(`/api/v1/encounters/${encounterId}/vitals`)
          .set(authed())
          .send({ heightCm: 170, weightKg: 70, pulse: 78, spo2: 98 })
          .expect(201)

        expect(res.body.data.bmi).toBeCloseTo(24.2, 1)
      })

      it('lists vitals for the encounter', async () => {
        const res = await request(server)
          .get(`/api/v1/encounters/${encounterId}/vitals`)
          .set(authed())
          .expect(200)

        expect(res.body.data.vitals).toHaveLength(1)
      })

      it('lists the vitals trend across all of the patient\'s encounters', async () => {
        const res = await request(server).get(`/api/v1/vitals?patientId=${patientId}`).set(authed()).expect(200)

        expect(res.body.data.vitals.length).toBeGreaterThanOrEqual(1)
      })
    })

    describe('diagnoses', () => {
      it('adds a primary and a secondary diagnosis', async () => {
        await request(server)
          .post(`/api/v1/encounters/${encounterId}/diagnoses`)
          .set(authed())
          .send({ type: 'PRIMARY', description: 'Viral fever', icdCode: 'B34.9' })
          .expect(201)

        await request(server)
          .post(`/api/v1/encounters/${encounterId}/diagnoses`)
          .set(authed())
          .send({ type: 'SECONDARY', description: 'Mild dehydration' })
          .expect(201)

        const res = await request(server)
          .get(`/api/v1/encounters/${encounterId}/diagnoses`)
          .set(authed())
          .expect(200)

        expect(res.body.data.diagnoses).toHaveLength(2)
      })
    })

    describe('procedures', () => {
      it('adds a minor procedure', async () => {
        await request(server)
          .post(`/api/v1/encounters/${encounterId}/procedures`)
          .set(authed())
          .send({ name: 'IV cannulation', notes: 'Left forearm' })
          .expect(201)

        const res = await request(server)
          .get(`/api/v1/encounters/${encounterId}/procedures`)
          .set(authed())
          .expect(200)

        expect(res.body.data.procedures).toHaveLength(1)
      })
    })

    describe('attachments', () => {
      let attachmentId: string

      it('uploads an attachment', async () => {
        const res = await request(server)
          .post(`/api/v1/encounters/${encounterId}/attachments`)
          .set(authed())
          .field('documentType', 'EXTERNAL_REPORT')
          .attach('file', Buffer.from('%PDF-1.4 fake lab report'), {
            filename: 'report.pdf',
            contentType: 'application/pdf',
          })
          .expect(201)

        attachmentId = res.body.data.id
        expect(res.body.data.fileUrl).toContain('/uploads/')
      })

      it('lists attachments', async () => {
        const res = await request(server)
          .get(`/api/v1/encounters/${encounterId}/attachments`)
          .set(authed())
          .expect(200)

        expect(res.body.data.attachments).toHaveLength(1)
      })

      it('deletes an attachment', async () => {
        await request(server)
          .delete(`/api/v1/encounters/${encounterId}/attachments/${attachmentId}`)
          .set(authed())
          .expect(200)

        const res = await request(server)
          .get(`/api/v1/encounters/${encounterId}/attachments`)
          .set(authed())
          .expect(200)

        expect(res.body.data.attachments).toHaveLength(0)
      })
    })

    describe('status transitions', () => {
      it('walks IN_PROGRESS -> COMPLETED -> AMENDED -> COMPLETED', async () => {
        await request(server)
          .patch(`/api/v1/encounters/${encounterId}/status`)
          .set(authed())
          .send({ status: 'COMPLETED' })
          .expect(200)
          .expect((res) => expect(res.body.data.status).toBe('COMPLETED'))

        await request(server)
          .patch(`/api/v1/encounters/${encounterId}/status`)
          .set(authed())
          .send({ status: 'AMENDED' })
          .expect(200)

        await request(server)
          .patch(`/api/v1/encounters/${encounterId}/status`)
          .set(authed())
          .send({ status: 'COMPLETED' })
          .expect(200)
      })

      it('rejects an invalid jump from IN_PROGRESS to AMENDED on a fresh encounter', async () => {
        const freshRes = await request(server)
          .post('/api/v1/encounters')
          .set(authed())
          .send({ patientId, doctorId, type: 'FOLLOW_UP' })
          .expect(201)

        await request(server)
          .patch(`/api/v1/encounters/${freshRes.body.data.id}/status`)
          .set(authed())
          .send({ status: 'AMENDED' })
          .expect(400)
      })
    })
  })

  describe('own-scope enforcement for doctors', () => {
    let ownEncounterId: string
    let otherDoctorEncounterId: string

    beforeAll(async () => {
      const ownRes = await request(server)
        .post('/api/v1/encounters')
        .set(authed())
        .send({ patientId, doctorId, type: 'OPD' })
        .expect(201)
      ownEncounterId = ownRes.body.data.id

      const otherRes = await request(server)
        .post('/api/v1/encounters')
        .set(authed())
        .send({ patientId, doctorId: secondDoctorId, type: 'OPD' })
        .expect(201)
      otherDoctorEncounterId = otherRes.body.data.id
    })

    it('lets a doctor add a clinical note to their own encounter', async () => {
      await request(server)
        .post(`/api/v1/encounters/${ownEncounterId}/clinical-notes`)
        .set(authedAs(doctorToken))
        .send({ chiefComplaint: 'Own encounter note' })
        .expect(201)
    })

    it("rejects a doctor adding a note to another doctor's encounter", async () => {
      await request(server)
        .post(`/api/v1/encounters/${otherDoctorEncounterId}/clinical-notes`)
        .set(authedAs(doctorToken))
        .send({ chiefComplaint: 'Should be rejected' })
        .expect(403)
    })

    it("rejects a doctor reading another doctor's encounter", async () => {
      await request(server)
        .get(`/api/v1/encounters/${otherDoctorEncounterId}`)
        .set(authedAs(doctorToken))
        .expect(403)
    })

    it('lets a doctor read their own encounter', async () => {
      await request(server).get(`/api/v1/encounters/${ownEncounterId}`).set(authedAs(doctorToken)).expect(200)
    })
  })

  it('rejects encounter routes without a bearer token', async () => {
    await request(server).get('/api/v1/encounters').expect(401)
  })
})
