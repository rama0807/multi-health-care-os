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

describe('Radiology (e2e)', () => {
  let app: NestFastifyApplication
  let server: Parameters<typeof request>[0]
  let adminToken: string
  let doctorId: string
  let doctorToken: string
  let secondDoctorId: string
  let patientId: string
  let encounterId: string
  let catalogItemId: string

  const unique = Date.now()
  const adminEmail = `e2e-rad-admin-${unique}@example.com`
  const orgSlug = `e2e-rad-org-${unique}`
  const doctorEmail = `e2e-rad-doctor-${unique}@example.com`
  const secondDoctorEmail = `e2e-rad-doctor2-${unique}@example.com`
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
    await app.register(fastifyMultipart, { limits: { fileSize: 20 * 1024 * 1024 } })

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
      { resource: 'radiology', action: 'read', scope: 'all' },
      { resource: 'radiology', action: 'create', scope: 'all' },
      { resource: 'radiology', action: 'update', scope: 'all' },
      { resource: 'radiology', action: 'read', scope: 'own' },
      { resource: 'radiology', action: 'create', scope: 'own' },
      { resource: 'radiology', action: 'update', scope: 'own' },
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
        organizationName: 'E2E Radiology Org',
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
          { resource: 'radiology', action: 'read' },
          { resource: 'radiology', action: 'create' },
          { resource: 'radiology', action: 'update' },
        ],
      },
    })
    await prisma.rolePermission.createMany({
      data: ownPerms.map((p) => ({ roleId: doctorRole.id, permissionId: p.id })),
    })

    const hospitalRes = await request(server)
      .post('/api/v1/hospitals')
      .set(authed())
      .send({ name: 'E2E Radiology Hospital', code: 'E2ERAD' })
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
        registrationNumber: `MCI-RAD-${unique}`,
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
        registrationNumber: `MCI-RAD2-${unique}`,
        specialization: 'Radiology',
        qualification: 'MBBS, MD',
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
      .send({ firstName: 'Anita', lastName: 'Desai', phone: '9123456780', dateOfBirth: '1990-05-15', gender: 'FEMALE' })
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

    const encounterRes = await request(server)
      .post('/api/v1/encounters')
      .set(authed())
      .send({ patientId, doctorId, type: 'OPD', notes: 'Routine visit' })
      .expect(201)
    encounterId = encounterRes.body.data.id

    const catalogRes = await request(server)
      .post('/api/v1/radiology/catalog')
      .set(authed())
      .send({
        code: `XR-CHEST-${unique}`,
        name: 'X-Ray Chest',
        category: 'X-Ray',
        modality: 'X_RAY',
        bodyPart: 'Chest',
        contrastRequired: false,
        price: 500,
        estimatedDurationMinutes: 15,
      })
      .expect(201)
    catalogItemId = catalogRes.body.data.id
  }, 30_000)

  afterAll(async () => {
    await app.close()
  })

  describe('catalog', () => {
    it('lists the seeded catalog item', async () => {
      const res = await request(server).get('/api/v1/radiology/catalog').set(authed()).expect(200)
      expect(res.body.data.some((item: { id: string }) => item.id === catalogItemId)).toBe(true)
    })

    it('rejects a duplicate code', async () => {
      await request(server)
        .post('/api/v1/radiology/catalog')
        .set(authed())
        .send({
          code: `XR-CHEST-${unique}`,
          name: 'Duplicate',
          category: 'X-Ray',
          modality: 'X_RAY',
          bodyPart: 'Chest',
          price: 500,
          estimatedDurationMinutes: 15,
        })
        .expect(409)
    })
  })

  describe('full order lifecycle: schedule -> start -> complete -> report -> verify -> release', () => {
    let orderId: string

    it('creates a radiology order from an encounter, auto-populating from the catalog', async () => {
      const res = await request(server)
        .post('/api/v1/radiology')
        .set(authed())
        .send({ encounterId, catalogItemId, priority: 'ROUTINE', clinicalIndication: 'Persistent cough' })
        .expect(201)

      orderId = res.body.data.id
      expect(res.body.data.orderNumber).toMatch(/^RAD-.+-\d{4}-\d{6}$/)
      expect(res.body.data.status).toBe('ORDERED')
      expect(res.body.data.modality).toBe('X_RAY')
      expect(res.body.data.bodyPart).toBe('Chest')
    })

    it('reads the order back with patient/doctor details', async () => {
      const res = await request(server).get(`/api/v1/radiology/${orderId}`).set(authed()).expect(200)
      expect(res.body.data.patient.uhid).toBeTruthy()
      expect(res.body.data.doctor.fullName).toContain('Priya')
      expect(res.body.data.reports).toEqual([])
    })

    it('rejects starting a study before it is scheduled', async () => {
      await request(server).post(`/api/v1/radiology/${orderId}/start`).set(authed()).send({}).expect(400)
    })

    it('schedules the study', async () => {
      const res = await request(server)
        .post(`/api/v1/radiology/${orderId}/schedule`)
        .set(authed())
        .send({
          scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
          room: 'Room 3',
          machine: 'XR-1',
          radiologistDoctorId: secondDoctorId,
          durationMinutes: 20,
        })
        .expect(201)

      expect(res.body.data.status).toBe('SCHEDULED')
      expect(res.body.data.room).toBe('Room 3')
      expect(res.body.data.radiologistDoctorId).toBe(secondDoctorId)
    })

    it('starts the study', async () => {
      const res = await request(server).post(`/api/v1/radiology/${orderId}/start`).set(authed()).send({}).expect(201)
      expect(res.body.data.status).toBe('IN_PROGRESS')
    })

    it('rejects authoring a report before the study is completed', async () => {
      await request(server)
        .post(`/api/v1/radiology/${orderId}/reports`)
        .set(authed())
        .send({ findings: 'Too early' })
        .expect(400)
    })

    it('completes the study', async () => {
      const res = await request(server).post(`/api/v1/radiology/${orderId}/complete`).set(authed()).send({}).expect(201)
      expect(res.body.data.status).toBe('COMPLETED')
    })

    it('rejects releasing before verification', async () => {
      await request(server).post(`/api/v1/radiology/${orderId}/reports/release`).set(authed()).send({}).expect(400)
    })

    it('rejects verifying before any report is authored', async () => {
      await request(server).post(`/api/v1/radiology/${orderId}/reports/verify`).set(authed()).send({}).expect(400)
    })

    it('authors a report version', async () => {
      const res = await request(server)
        .post(`/api/v1/radiology/${orderId}/reports`)
        .set(authed())
        .send({
          clinicalIndication: 'Persistent cough',
          technique: 'PA and lateral views',
          findings: 'No focal consolidation. Heart size normal.',
          impression: 'No acute cardiopulmonary abnormality.',
          recommendations: 'Clinical correlation advised.',
        })
        .expect(201)

      expect(res.body.data.reports).toHaveLength(1)
      expect(res.body.data.reports[0].version).toBe(1)
      expect(res.body.data.findings).toContain('No focal consolidation')
      expect(res.body.data.status).toBe('COMPLETED')
    })

    it('verifies the report', async () => {
      const res = await request(server).post(`/api/v1/radiology/${orderId}/reports/verify`).set(authed()).send({}).expect(201)
      expect(res.body.data.verifiedAt).toBeDefined()
    })

    it('releases the report, transitioning to REPORTED', async () => {
      const res = await request(server).post(`/api/v1/radiology/${orderId}/reports/release`).set(authed()).send({}).expect(201)
      expect(res.body.data.status).toBe('REPORTED')
      expect(res.body.data.releasedAt).toBeDefined()
    })

    it('downloads a structured PDF report', async () => {
      const res = await request(server).get(`/api/v1/radiology/${orderId}/report/pdf`).set(authed()).expect(200)
      expect(res.headers['content-type']).toContain('application/pdf')
      expect(res.headers['content-disposition']).toContain('.pdf')
    })

    it('uploads an image attachment', async () => {
      const res = await request(server)
        .post(`/api/v1/radiology/${orderId}/attachments/file?type=IMAGE`)
        .set(authed())
        .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47]), { filename: 'xray.png', contentType: 'image/png' })
        .expect(201)

      expect(res.body.data.type).toBe('IMAGE')
      expect(res.body.data.fileUrl).toBeTruthy()
    })

    it('records an external-imaging attachment (PACS placeholder, no file)', async () => {
      const res = await request(server)
        .post(`/api/v1/radiology/${orderId}/attachments/external`)
        .set(authed())
        .send({ type: 'DICOM_PLACEHOLDER', metadata: { accessionNumber: `ACC-${unique}`, studyInstanceUid: '1.2.3.4' } })
        .expect(201)

      expect(res.body.data.type).toBe('DICOM_PLACEHOLDER')
      expect(res.body.data.fileUrl).toBeNull()
      expect(res.body.data.metadata.accessionNumber).toBe(`ACC-${unique}`)
    })

    it('lists both attachments', async () => {
      const res = await request(server).get(`/api/v1/radiology/${orderId}/attachments`).set(authed()).expect(200)
      expect(res.body.data).toHaveLength(2)
    })
  })

  describe('external report file path', () => {
    it('uploads an external report file and marks the order REPORTED directly', async () => {
      const orderRes = await request(server)
        .post('/api/v1/radiology')
        .set(authed())
        .send({ encounterId, modality: 'CT', bodyPart: 'Brain', priority: 'STAT' })
        .expect(201)
      const orderId = orderRes.body.data.id

      await request(server).post(`/api/v1/radiology/${orderId}/schedule`).set(authed()).send({ scheduledAt: new Date().toISOString() }).expect(201)
      await request(server).post(`/api/v1/radiology/${orderId}/start`).set(authed()).send({}).expect(201)
      await request(server).post(`/api/v1/radiology/${orderId}/complete`).set(authed()).send({}).expect(201)

      const res = await request(server)
        .post(`/api/v1/radiology/${orderId}/report-file`)
        .set(authed())
        .attach('file', Buffer.from('%PDF-1.4 fake external report'), {
          filename: 'external-report.pdf',
          contentType: 'application/pdf',
        })
        .expect(201)

      expect(res.body.data.status).toBe('REPORTED')
      expect(res.body.data.reportFileUrl).toBeTruthy()
    })
  })

  describe('rejection and cancellation', () => {
    it('rejects an ORDERED study via the generic status route', async () => {
      const orderRes = await request(server)
        .post('/api/v1/radiology')
        .set(authed())
        .send({ encounterId, modality: 'MRI', bodyPart: 'Spine' })
        .expect(201)

      await request(server)
        .patch(`/api/v1/radiology/${orderRes.body.data.id}/status`)
        .set(authed())
        .send({ status: 'REJECTED', reason: 'Duplicate order' })
        .expect(200)
        .expect((res) => expect(res.body.data.status).toBe('REJECTED'))
    })

    it('cancels a SCHEDULED study via the generic status route', async () => {
      const orderRes = await request(server)
        .post('/api/v1/radiology')
        .set(authed())
        .send({ encounterId, modality: 'ULTRASOUND', bodyPart: 'Abdomen' })
        .expect(201)
      const orderId = orderRes.body.data.id
      await request(server).post(`/api/v1/radiology/${orderId}/schedule`).set(authed()).send({ scheduledAt: new Date().toISOString() }).expect(201)

      await request(server)
        .patch(`/api/v1/radiology/${orderId}/status`)
        .set(authed())
        .send({ status: 'CANCELLED' })
        .expect(200)
        .expect((res) => expect(res.body.data.status).toBe('CANCELLED'))
    })

    it('rejects a non-terminal status via the generic route', async () => {
      const orderRes = await request(server)
        .post('/api/v1/radiology')
        .set(authed())
        .send({ encounterId, modality: 'MRI', bodyPart: 'Knee' })
        .expect(201)

      await request(server)
        .patch(`/api/v1/radiology/${orderRes.body.data.id}/status`)
        .set(authed())
        .send({ status: 'IN_PROGRESS' })
        .expect(400)
    })
  })

  it('rejects an order with neither a catalogItemId nor an ad-hoc modality/bodyPart', async () => {
    await request(server).post('/api/v1/radiology').set(authed()).send({ encounterId }).expect(400)
  })

  it('returns dashboard stats', async () => {
    const res = await request(server).get('/api/v1/radiology/dashboard-stats').set(authed()).expect(200)
    expect(res.body.data).toEqual(
      expect.objectContaining({
        todaysStudies: expect.any(Number),
        pendingReporting: expect.any(Number),
        completedStudies: expect.any(Number),
        cancelled: expect.any(Number),
        urgent: expect.any(Number),
      }),
    )
  })

  describe('own-scope enforcement for doctors', () => {
    let ownOrderId: string
    let otherDoctorEncounterId: string
    let otherDoctorOrderId: string

    beforeAll(async () => {
      const ownRes = await request(server)
        .post('/api/v1/radiology')
        .set(authed())
        .send({ encounterId, modality: 'X_RAY', bodyPart: 'Wrist' })
        .expect(201)
      ownOrderId = ownRes.body.data.id

      const otherEncounterRes = await request(server)
        .post('/api/v1/encounters')
        .set(authed())
        .send({ patientId, doctorId: secondDoctorId, type: 'OPD' })
        .expect(201)
      otherDoctorEncounterId = otherEncounterRes.body.data.id

      const otherOrderRes = await request(server)
        .post('/api/v1/radiology')
        .set(authed())
        .send({ encounterId: otherDoctorEncounterId, modality: 'CT', bodyPart: 'Abdomen' })
        .expect(201)
      otherDoctorOrderId = otherOrderRes.body.data.id
    })

    it("lets a doctor read their own radiology order", async () => {
      await request(server).get(`/api/v1/radiology/${ownOrderId}`).set(authedAs(doctorToken)).expect(200)
    })

    it("rejects a doctor reading another doctor's radiology order", async () => {
      await request(server).get(`/api/v1/radiology/${otherDoctorOrderId}`).set(authedAs(doctorToken)).expect(403)
    })

    it("rejects a doctor cancelling another doctor's radiology order", async () => {
      await request(server)
        .patch(`/api/v1/radiology/${otherDoctorOrderId}/status`)
        .set(authedAs(doctorToken))
        .send({ status: 'CANCELLED' })
        .expect(403)
    })

    it('lets a doctor create a radiology order for their own encounter', async () => {
      await request(server)
        .post('/api/v1/radiology')
        .set(authedAs(doctorToken))
        .send({ encounterId, modality: 'X_RAY', bodyPart: 'Ankle' })
        .expect(201)
    })
  })

  it('rejects radiology routes without a bearer token', async () => {
    await request(server).get('/api/v1/radiology').expect(401)
  })
})
