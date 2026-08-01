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

describe('Prescriptions / Orders (e2e)', () => {
  let app: NestFastifyApplication
  let server: Parameters<typeof request>[0]
  let adminToken: string
  let doctorId: string
  let doctorToken: string
  let secondDoctorId: string
  let patientId: string
  let encounterId: string

  const unique = Date.now()
  const adminEmail = `e2e-rx-admin-${unique}@example.com`
  const orgSlug = `e2e-rx-org-${unique}`
  const doctorEmail = `e2e-rx-doctor-${unique}@example.com`
  const secondDoctorEmail = `e2e-rx-doctor2-${unique}@example.com`
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
      { resource: 'prescriptions', action: 'read', scope: 'all' },
      { resource: 'prescriptions', action: 'create', scope: 'all' },
      { resource: 'prescriptions', action: 'update', scope: 'all' },
      { resource: 'prescriptions', action: 'read', scope: 'own' },
      { resource: 'prescriptions', action: 'create', scope: 'own' },
      { resource: 'prescriptions', action: 'update', scope: 'own' },
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
        organizationName: 'E2E Rx Org',
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
          { resource: 'prescriptions', action: 'read' },
          { resource: 'prescriptions', action: 'create' },
          { resource: 'prescriptions', action: 'update' },
        ],
      },
    })
    await prisma.rolePermission.createMany({
      data: ownPerms.map((p) => ({ roleId: doctorRole.id, permissionId: p.id })),
    })

    const hospitalRes = await request(server)
      .post('/api/v1/hospitals')
      .set(authed())
      .send({ name: 'E2E Rx Hospital', code: 'E2ERX' })
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
        registrationNumber: `MCI-RX-${unique}`,
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
        registrationNumber: `MCI-RX2-${unique}`,
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
  }, 30_000)

  afterAll(async () => {
    await app.close()
  })

  describe('creating and reading prescriptions', () => {
    let prescriptionId: string

    it('creates a prescription with a valid prescriptionNumber and no warnings for unrelated medications', async () => {
      const res = await request(server)
        .post('/api/v1/prescriptions')
        .set(authed())
        .send({
          encounterId,
          notes: 'Take with food',
          items: [
            { medicationName: 'Paracetamol', dosage: '500mg', frequency: 'TDS', duration: '5 days', quantity: 15 },
          ],
        })
        .expect(201)

      prescriptionId = res.body.data.prescription.id
      expect(res.body.data.prescription.prescriptionNumber).toMatch(/^RX-.+-\d{4}-\d{6}$/)
      expect(res.body.data.prescription.status).toBe('ACTIVE')
      expect(res.body.data.warnings).toEqual([])
    })

    it('reads the prescription back with items and patient/doctor details', async () => {
      const res = await request(server).get(`/api/v1/prescriptions/${prescriptionId}`).set(authed()).expect(200)

      expect(res.body.data.items).toHaveLength(1)
      expect(res.body.data.patient.uhid).toBeDefined()
      expect(res.body.data.doctor.fullName).toContain('Priya')
    })

    it('lists prescriptions filtered by patient', async () => {
      const res = await request(server)
        .get(`/api/v1/prescriptions?patientId=${patientId}`)
        .set(authed())
        .expect(200)

      expect(res.body.data.data.length).toBeGreaterThanOrEqual(1)
      expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(1)
    })

    it('downloads a PDF for the prescription', async () => {
      const res = await request(server)
        .get(`/api/v1/prescriptions/${prescriptionId}/pdf`)
        .set(authed())
        .expect(200)

      expect(res.headers['content-type']).toContain('application/pdf')
      expect(res.headers['content-disposition']).toContain('.pdf')
    })

    it('flags a known drug interaction across a new prescription', async () => {
      const res = await request(server)
        .post('/api/v1/prescriptions')
        .set(authed())
        .send({
          encounterId,
          items: [
            { medicationName: 'Warfarin', dosage: '5mg', frequency: 'OD', duration: '30 days', quantity: 30 },
            { medicationName: 'Aspirin', dosage: '75mg', frequency: 'OD', duration: '30 days', quantity: 30 },
          ],
        })
        .expect(201)

      expect(res.body.data.warnings.length).toBeGreaterThanOrEqual(1)
      expect(res.body.data.warnings[0]).toMatchObject({ severity: 'severe' })
    })

    it('rejects a prescription with no items', async () => {
      await request(server)
        .post('/api/v1/prescriptions')
        .set(authed())
        .send({ encounterId, items: [] })
        .expect(400)
    })
  })

  describe('status transitions', () => {
    let statusPrescriptionId: string

    beforeAll(async () => {
      const res = await request(server)
        .post('/api/v1/prescriptions')
        .set(authed())
        .send({
          encounterId,
          items: [{ medicationName: 'Cetirizine', dosage: '10mg', frequency: 'OD', duration: '7 days', quantity: 7 }],
        })
        .expect(201)
      statusPrescriptionId = res.body.data.prescription.id
    })

    it('rejects setting the same status again', async () => {
      await request(server)
        .patch(`/api/v1/prescriptions/${statusPrescriptionId}/status`)
        .set(authed())
        .send({ status: 'ACTIVE' })
        .expect(409)
    })

    it('transitions ACTIVE -> DISCONTINUED', async () => {
      await request(server)
        .patch(`/api/v1/prescriptions/${statusPrescriptionId}/status`)
        .set(authed())
        .send({ status: 'DISCONTINUED' })
        .expect(200)
        .expect((res) => expect(res.body.data.status).toBe('DISCONTINUED'))
    })

    it('rejects transitioning out of a terminal state', async () => {
      await request(server)
        .patch(`/api/v1/prescriptions/${statusPrescriptionId}/status`)
        .set(authed())
        .send({ status: 'ACTIVE' })
        .expect(400)
    })
  })

  describe('own-scope enforcement for doctors', () => {
    let ownPrescriptionId: string
    let otherDoctorEncounterId: string
    let otherDoctorPrescriptionId: string

    beforeAll(async () => {
      const ownRes = await request(server)
        .post('/api/v1/prescriptions')
        .set(authed())
        .send({
          encounterId,
          items: [{ medicationName: 'Amoxicillin', dosage: '500mg', frequency: 'TDS', duration: '5 days', quantity: 15 }],
        })
        .expect(201)
      ownPrescriptionId = ownRes.body.data.prescription.id

      const otherEncounterRes = await request(server)
        .post('/api/v1/encounters')
        .set(authed())
        .send({ patientId, doctorId: secondDoctorId, type: 'OPD' })
        .expect(201)
      otherDoctorEncounterId = otherEncounterRes.body.data.id

      const otherRxRes = await request(server)
        .post('/api/v1/prescriptions')
        .set(authed())
        .send({
          encounterId: otherDoctorEncounterId,
          items: [{ medicationName: 'Metformin', dosage: '500mg', frequency: 'BD', duration: '30 days', quantity: 60 }],
        })
        .expect(201)
      otherDoctorPrescriptionId = otherRxRes.body.data.prescription.id
    })

    it('lets a doctor read their own prescription', async () => {
      await request(server)
        .get(`/api/v1/prescriptions/${ownPrescriptionId}`)
        .set(authedAs(doctorToken))
        .expect(200)
    })

    it("rejects a doctor reading another doctor's prescription", async () => {
      await request(server)
        .get(`/api/v1/prescriptions/${otherDoctorPrescriptionId}`)
        .set(authedAs(doctorToken))
        .expect(403)
    })

    it("rejects a doctor updating another doctor's prescription status", async () => {
      await request(server)
        .patch(`/api/v1/prescriptions/${otherDoctorPrescriptionId}/status`)
        .set(authedAs(doctorToken))
        .send({ status: 'DISCONTINUED' })
        .expect(403)
    })

    it('lets a doctor create a prescription for their own encounter', async () => {
      await request(server)
        .post('/api/v1/prescriptions')
        .set(authedAs(doctorToken))
        .send({
          encounterId,
          items: [{ medicationName: 'Ibuprofen', dosage: '400mg', frequency: 'BD', duration: '5 days', quantity: 10 }],
        })
        .expect(201)
    })
  })

  it('rejects prescription routes without a bearer token', async () => {
    await request(server).get('/api/v1/prescriptions').expect(401)
  })
})
