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

describe('Laboratory (e2e)', () => {
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
  const adminEmail = `e2e-lab-admin-${unique}@example.com`
  const orgSlug = `e2e-lab-org-${unique}`
  const doctorEmail = `e2e-lab-doctor-${unique}@example.com`
  const secondDoctorEmail = `e2e-lab-doctor2-${unique}@example.com`
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
      { resource: 'laboratory', action: 'read', scope: 'all' },
      { resource: 'laboratory', action: 'create', scope: 'all' },
      { resource: 'laboratory', action: 'update', scope: 'all' },
      { resource: 'laboratory', action: 'read', scope: 'own' },
      { resource: 'laboratory', action: 'create', scope: 'own' },
      { resource: 'laboratory', action: 'update', scope: 'own' },
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
        organizationName: 'E2E Lab Org',
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
          { resource: 'laboratory', action: 'read' },
          { resource: 'laboratory', action: 'create' },
          { resource: 'laboratory', action: 'update' },
        ],
      },
    })
    await prisma.rolePermission.createMany({
      data: ownPerms.map((p) => ({ roleId: doctorRole.id, permissionId: p.id })),
    })

    const hospitalRes = await request(server)
      .post('/api/v1/hospitals')
      .set(authed())
      .send({ name: 'E2E Lab Hospital', code: 'E2ELAB' })
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
        registrationNumber: `MCI-LAB-${unique}`,
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
        registrationNumber: `MCI-LAB2-${unique}`,
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

    const encounterRes = await request(server)
      .post('/api/v1/encounters')
      .set(authed())
      .send({ patientId, doctorId, type: 'OPD', notes: 'Routine visit' })
      .expect(201)
    encounterId = encounterRes.body.data.id

    const catalogRes = await request(server)
      .post('/api/v1/laboratory/catalog')
      .set(authed())
      .send({
        testCode: `FBS-${unique}`,
        testName: 'Fasting Blood Sugar',
        category: 'Biochemistry',
        unit: 'mg/dL',
        referenceRangeLow: 70,
        referenceRangeHigh: 110,
      })
      .expect(201)
    catalogItemId = catalogRes.body.data.id
  }, 30_000)

  afterAll(async () => {
    await app.close()
  })

  describe('catalog', () => {
    it('lists the seeded catalog item', async () => {
      const res = await request(server).get('/api/v1/laboratory/catalog').set(authed()).expect(200)
      expect(res.body.data.some((item: { id: string }) => item.id === catalogItemId)).toBe(true)
    })

    it('rejects a duplicate test code', async () => {
      await request(server)
        .post('/api/v1/laboratory/catalog')
        .set(authed())
        .send({
          testCode: `FBS-${unique}`,
          testName: 'Duplicate',
          category: 'Biochemistry',
          referenceRangeLow: 70,
          referenceRangeHigh: 110,
        })
        .expect(409)
    })
  })

  describe('ordering, sample collection, and results', () => {
    let labTestId: string
    let itemId: string

    it('creates a lab order from an encounter, auto-populating from the catalog', async () => {
      const res = await request(server)
        .post('/api/v1/laboratory')
        .set(authed())
        .send({ encounterId, priority: 'ROUTINE', items: [{ catalogItemId }] })
        .expect(201)

      labTestId = res.body.data.id
      expect(res.body.data.labOrderNumber).toMatch(/^LAB-.+-\d{4}-\d{6}$/)
      expect(res.body.data.status).toBe('ORDERED')
    })

    it('reads the order back with items and patient/doctor details', async () => {
      const res = await request(server).get(`/api/v1/laboratory/${labTestId}`).set(authed()).expect(200)

      expect(res.body.data.items).toHaveLength(1)
      itemId = res.body.data.items[0].id
      expect(res.body.data.items[0].testName).toBe('Fasting Blood Sugar')
      expect(res.body.data.items[0].referenceRangeLow).toBe(70)
    })

    it('rejects entering results before a sample is collected', async () => {
      await request(server)
        .post(`/api/v1/laboratory/${labTestId}/results`)
        .set(authed())
        .send({ items: [{ itemId, result: '95' }] })
        .expect(400)
    })

    it('collects the sample', async () => {
      const res = await request(server)
        .post(`/api/v1/laboratory/${labTestId}/collect-sample`)
        .set(authed())
        .send({})
        .expect(201)

      expect(res.body.data.status).toBe('SAMPLE_COLLECTED')
      expect(res.body.data.sampleCollectedAt).toBeDefined()
    })

    it('enters an abnormal numeric result and completes the order', async () => {
      const res = await request(server)
        .post(`/api/v1/laboratory/${labTestId}/results`)
        .set(authed())
        .send({ items: [{ itemId, result: '250' }] })
        .expect(201)

      expect(res.body.data.status).toBe('COMPLETED')
      const item = res.body.data.items.find((i: { id: string }) => i.id === itemId)
      expect(item.isAbnormal).toBe(true)
      expect(item.abnormalType).toBe('CRITICAL_HIGH')
    })

    it('downloads a structured PDF report', async () => {
      const res = await request(server).get(`/api/v1/laboratory/${labTestId}/report/pdf`).set(authed()).expect(200)

      expect(res.headers['content-type']).toContain('application/pdf')
      expect(res.headers['content-disposition']).toContain('.pdf')
    })

    it('uploads an external report file and marks the order REPORTED', async () => {
      const res = await request(server)
        .post(`/api/v1/laboratory/${labTestId}/report`)
        .set(authed())
        .attach('file', Buffer.from('%PDF-1.4 fake report'), { filename: 'external-report.pdf', contentType: 'application/pdf' })
        .expect(201)

      expect(res.body.data.status).toBe('REPORTED')
      expect(res.body.data.reportFileUrl).toBeTruthy()
    })

    it('rejects re-reporting an already-reported order', async () => {
      await request(server)
        .post(`/api/v1/laboratory/${labTestId}/report`)
        .set(authed())
        .attach('file', Buffer.from('%PDF-1.4 fake report 2'), { filename: 'external-report-2.pdf', contentType: 'application/pdf' })
        .expect(409)
    })
  })

  describe('an ad-hoc (non-catalog) qualitative item', () => {
    it('creates an order with an ad-hoc item and never auto-flags a qualitative result', async () => {
      const orderRes = await request(server)
        .post('/api/v1/laboratory')
        .set(authed())
        .send({
          encounterId,
          items: [{ testName: 'HIV Screen', testCode: 'HIV', category: 'Serology', referenceRange: 'Non-reactive' }],
        })
        .expect(201)
      const adHocLabTestId = orderRes.body.data.id

      const getRes = await request(server).get(`/api/v1/laboratory/${adHocLabTestId}`).set(authed()).expect(200)
      const adHocItemId = getRes.body.data.items[0].id

      await request(server)
        .post(`/api/v1/laboratory/${adHocLabTestId}/collect-sample`)
        .set(authed())
        .send({})
        .expect(201)

      const resultRes = await request(server)
        .post(`/api/v1/laboratory/${adHocLabTestId}/results`)
        .set(authed())
        .send({ items: [{ itemId: adHocItemId, result: 'Non-reactive' }] })
        .expect(201)

      const item = resultRes.body.data.items.find((i: { id: string }) => i.id === adHocItemId)
      expect(item.isAbnormal).toBe(false)
      expect(item.abnormalType).toBeNull()
    })

    it('rejects an order with no items', async () => {
      await request(server).post('/api/v1/laboratory').set(authed()).send({ encounterId, items: [] }).expect(400)
    })
  })

  describe('cancellation', () => {
    it('cancels an ORDERED lab order via the generic status route', async () => {
      const orderRes = await request(server)
        .post('/api/v1/laboratory')
        .set(authed())
        .send({ encounterId, items: [{ testName: 'Urinalysis', testCode: 'UA', category: 'Microscopy' }] })
        .expect(201)

      await request(server)
        .patch(`/api/v1/laboratory/${orderRes.body.data.id}/status`)
        .set(authed())
        .send({ status: 'CANCELLED' })
        .expect(200)
        .expect((res) => expect(res.body.data.status).toBe('CANCELLED'))
    })

    it('rejects a non-CANCELLED status via the generic route', async () => {
      const orderRes = await request(server)
        .post('/api/v1/laboratory')
        .set(authed())
        .send({ encounterId, items: [{ testName: 'Urinalysis', testCode: 'UA', category: 'Microscopy' }] })
        .expect(201)

      await request(server)
        .patch(`/api/v1/laboratory/${orderRes.body.data.id}/status`)
        .set(authed())
        .send({ status: 'IN_PROGRESS' })
        .expect(400)
    })
  })

  describe('own-scope enforcement for doctors', () => {
    let ownLabTestId: string
    let otherDoctorEncounterId: string
    let otherDoctorLabTestId: string

    beforeAll(async () => {
      const ownRes = await request(server)
        .post('/api/v1/laboratory')
        .set(authed())
        .send({ encounterId, items: [{ testName: 'Lipid Profile', testCode: 'LIPID', category: 'Biochemistry' }] })
        .expect(201)
      ownLabTestId = ownRes.body.data.id

      const otherEncounterRes = await request(server)
        .post('/api/v1/encounters')
        .set(authed())
        .send({ patientId, doctorId: secondDoctorId, type: 'OPD' })
        .expect(201)
      otherDoctorEncounterId = otherEncounterRes.body.data.id

      const otherLabRes = await request(server)
        .post('/api/v1/laboratory')
        .set(authed())
        .send({
          encounterId: otherDoctorEncounterId,
          items: [{ testName: 'Thyroid Profile', testCode: 'TFT', category: 'Biochemistry' }],
        })
        .expect(201)
      otherDoctorLabTestId = otherLabRes.body.data.id
    })

    it('lets a doctor read their own lab order', async () => {
      await request(server).get(`/api/v1/laboratory/${ownLabTestId}`).set(authedAs(doctorToken)).expect(200)
    })

    it("rejects a doctor reading another doctor's lab order", async () => {
      await request(server).get(`/api/v1/laboratory/${otherDoctorLabTestId}`).set(authedAs(doctorToken)).expect(403)
    })

    it("rejects a doctor cancelling another doctor's lab order", async () => {
      await request(server)
        .patch(`/api/v1/laboratory/${otherDoctorLabTestId}/status`)
        .set(authedAs(doctorToken))
        .send({ status: 'CANCELLED' })
        .expect(403)
    })

    it('lets a doctor create a lab order for their own encounter', async () => {
      await request(server)
        .post('/api/v1/laboratory')
        .set(authedAs(doctorToken))
        .send({ encounterId, items: [{ testName: 'Vitamin D', testCode: 'VITD', category: 'Biochemistry' }] })
        .expect(201)
    })
  })

  it('rejects laboratory routes without a bearer token', async () => {
    await request(server).get('/api/v1/laboratory').expect(401)
  })
})
