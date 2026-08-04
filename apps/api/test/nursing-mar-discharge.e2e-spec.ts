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

describe('Nursing, MAR & Discharge (e2e)', () => {
  let app: NestFastifyApplication
  let server: Parameters<typeof request>[0]
  let adminToken: string
  let doctorId: string
  let patientId: string
  let admissionId: string
  let encounterId: string
  let prescriptionItemId: string
  let doseId: string

  const unique = Date.now()
  const adminEmail = `e2e-discharge-admin-${unique}@example.com`
  const orgSlug = `e2e-discharge-org-${unique}`

  function authed() {
    return { Authorization: `Bearer ${adminToken}` }
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
      { resource: 'hospitals', action: 'read', scope: 'all' },
      { resource: 'hospitals', action: 'create', scope: 'all' },
      { resource: 'departments', action: 'read', scope: 'all' },
      { resource: 'departments', action: 'create', scope: 'all' },
      { resource: 'doctors', action: 'read', scope: 'all' },
      { resource: 'doctors', action: 'create', scope: 'all' },
      { resource: 'patients', action: 'create', scope: 'all' },
      { resource: 'ipd.wards', action: 'read', scope: 'all' },
      { resource: 'ipd.wards', action: 'create', scope: 'all' },
      { resource: 'ipd.rooms', action: 'read', scope: 'all' },
      { resource: 'ipd.rooms', action: 'create', scope: 'all' },
      { resource: 'ipd.beds', action: 'read', scope: 'all' },
      { resource: 'ipd.beds', action: 'create', scope: 'all' },
      { resource: 'ipd.admissions', action: 'read', scope: 'all' },
      { resource: 'ipd.admissions', action: 'create', scope: 'all' },
      { resource: 'ipd.admissions', action: 'update', scope: 'all' },
      { resource: 'ipd.nursing', action: 'read', scope: 'all' },
      { resource: 'ipd.nursing', action: 'create', scope: 'all' },
      { resource: 'ipd.orders', action: 'read', scope: 'all' },
      { resource: 'ipd.orders', action: 'create', scope: 'all' },
      { resource: 'ipd.orders', action: 'update', scope: 'all' },
      { resource: 'ipd.tasks', action: 'read', scope: 'all' },
      { resource: 'ipd.tasks', action: 'create', scope: 'all' },
      { resource: 'ipd.tasks', action: 'update', scope: 'all' },
      { resource: 'ipd.mar', action: 'read', scope: 'all' },
      { resource: 'ipd.mar', action: 'create', scope: 'all' },
      { resource: 'ipd.mar', action: 'update', scope: 'all' },
      { resource: 'ipd.discharge', action: 'read', scope: 'all' },
      { resource: 'ipd.discharge', action: 'create', scope: 'all' },
      { resource: 'ipd.discharge', action: 'update', scope: 'all' },
      { resource: 'ipd.discharge', action: 'manage', scope: 'all' },
      { resource: 'prescriptions', action: 'read', scope: 'all' },
      { resource: 'prescriptions', action: 'create', scope: 'all' },
      { resource: 'billing', action: 'read', scope: 'all' },
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
        organizationName: 'E2E Discharge Org',
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
    await prisma.role.create({
      data: { name: 'Doctor', systemRole: 'DOCTOR', organizationId: org.id, description: 'Doctor role' },
    })

    const hospitalRes = await request(server)
      .post('/api/v1/hospitals')
      .set(authed())
      .send({ name: 'E2E Discharge Hospital', code: 'E2EDIS' })
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
        email: `e2e-discharge-doctor-${unique}@example.com`,
        firstName: 'Meena',
        lastName: 'Rao',
        registrationNumber: `MCI-DIS-${unique}`,
        specialization: 'General Medicine',
        qualification: 'MBBS, MD',
        experienceYears: 8,
        languagesSpoken: ['English'],
        consultationFee: 600,
        joiningDate: '2019-01-01',
        hospitalId,
        departmentId,
      })
      .expect(201)
    doctorId = doctorRes.body.data.id

    const patientRes = await request(server)
      .post('/api/v1/patients')
      .set(authed())
      .send({ firstName: 'Sunil', lastName: 'Deshmukh', phone: '9812340077', dateOfBirth: '1965-06-20', gender: 'MALE' })
      .expect(201)
    patientId = patientRes.body.data.id

    const wardRes = await request(server)
      .post('/api/v1/ipd/wards')
      .set(authed())
      .send({ name: 'Medical Ward', code: `MED-${unique}`, type: 'GENERAL' })
      .expect(201)
    const wardId = wardRes.body.data.id

    const roomRes = await request(server)
      .post('/api/v1/ipd/rooms')
      .set(authed())
      .send({ roomNumber: '101', wardId, capacity: 1, chargesPerDay: 2000 })
      .expect(201)
    const roomId = roomRes.body.data.id

    const bedRes = await request(server)
      .post('/api/v1/ipd/beds')
      .set(authed())
      .send({ bedNumber: '101-A', roomId, type: 'GENERAL' })
      .expect(201)
    const bedId = bedRes.body.data.id

    const admissionRes = await request(server)
      .post('/api/v1/ipd/admissions')
      .set(authed())
      .send({
        patientId,
        attendingDoctorId: doctorId,
        wardId,
        roomId,
        bedId,
        type: 'SCHEDULED',
        admissionReason: 'Community-acquired pneumonia',
        diagnosis: 'Pneumonia',
      })
      .expect(201)
    admissionId = admissionRes.body.data.id
    encounterId = admissionRes.body.data.encounterId

    const prescriptionRes = await request(server)
      .post('/api/v1/prescriptions')
      .set(authed())
      .send({
        encounterId,
        items: [
          {
            medicationName: 'Amoxicillin',
            dosage: '500mg',
            frequency: 'TID',
            duration: '7 days',
            route: 'ORAL',
            quantity: 21,
          },
        ],
      })
      .expect(201)
    const prescriptionId = prescriptionRes.body.data.prescription.id

    const prescriptionDetailRes = await request(server)
      .get(`/api/v1/prescriptions/${prescriptionId}`)
      .set(authed())
      .expect(200)
    prescriptionItemId = prescriptionDetailRes.body.data.items[0].id
  }, 30_000)

  afterAll(async () => {
    await app.close()
  })

  it('records a shift-handover nursing note', async () => {
    const res = await request(server)
      .post(`/api/v1/ipd/admissions/${admissionId}/nursing-notes`)
      .set(authed())
      .send({ type: 'SHIFT_HANDOVER', shift: 'MORNING', content: 'Patient stable, afebrile overnight.' })
      .expect(201)

    expect(res.body.data.type).toBe('SHIFT_HANDOVER')

    await request(server)
      .get(`/api/v1/ipd/admissions/${admissionId}/nursing-notes`)
      .set(authed())
      .expect(200)
      .expect((r) => {
        expect(r.body.data.data.length).toBeGreaterThanOrEqual(1)
      })
  })

  it('records a nursing assessment with derived fall-risk and GCS total', async () => {
    const res = await request(server)
      .post(`/api/v1/ipd/admissions/${admissionId}/nursing-assessments`)
      .set(authed())
      .send({ painScore: 3, fallRiskScore: 50, bradenScore: 14, gcsEye: 4, gcsVerbal: 5, gcsMotor: 6 })
      .expect(201)

    expect(res.body.data.fallRiskLevel).toBe('HIGH')
    expect(res.body.data.bradenRiskLevel).toBe('MODERATE')
    expect(res.body.data.gcsTotal).toBe(15)
  })

  it('records an intake/output chart entry with computed balance', async () => {
    const res = await request(server)
      .post(`/api/v1/ipd/admissions/${admissionId}/intake-output`)
      .set(authed())
      .send({ oralIntakeMl: 600, ivFluidIntakeMl: 400, urineOutputMl: 500 })
      .expect(201)

    expect(res.body.data.totalIntakeMl).toBe(1000)
    expect(res.body.data.totalOutputMl).toBe(500)
    expect(res.body.data.balanceMl).toBe(500)
  })

  it('places a doctor order and spawns a nursing task from it', async () => {
    const orderRes = await request(server)
      .post(`/api/v1/ipd/admissions/${admissionId}/orders`)
      .set(authed())
      .send({ category: 'OXYGEN', instructions: '2L/min via nasal cannula' })
      .expect(201)

    expect(orderRes.body.data.status).toBe('ACTIVE')

    const taskRes = await request(server)
      .post(`/api/v1/ipd/admissions/${admissionId}/nursing-tasks`)
      .set(authed())
      .send({ title: 'Check O2 saturation q2h', sourceOrderId: orderRes.body.data.id, priority: 'URGENT' })
      .expect(201)

    expect(taskRes.body.data.status).toBe('PENDING')

    await request(server)
      .patch(`/api/v1/ipd/nursing-tasks/${taskRes.body.data.id}/status`)
      .set(authed())
      .send({ status: 'COMPLETED' })
      .expect(200)
      .expect((r) => {
        expect(r.body.data.status).toBe('COMPLETED')
      })

    await request(server)
      .get('/api/v1/ipd/nursing-tasks')
      .set(authed())
      .expect(200)
      .expect((r) => {
        expect(r.body.data.data.length).toBeGreaterThanOrEqual(1)
      })
  })

  it('generates scheduled MAR doses and administers one', async () => {
    const genRes = await request(server)
      .post(`/api/v1/ipd/admissions/${admissionId}/mar/generate-scheduled`)
      .set(authed())
      .send({ prescriptionItemId, times: ['08:00', '14:00', '20:00'], days: 1 })
      .expect(201)

    expect(genRes.body.data.created).toBe(3)

    const listRes = await request(server)
      .get(`/api/v1/ipd/admissions/${admissionId}/mar`)
      .set(authed())
      .expect(200)
    doseId = listRes.body.data.data[0].id

    const administerRes = await request(server)
      .patch(`/api/v1/ipd/admissions/${admissionId}/mar/${doseId}/administer`)
      .set(authed())
      .send({ doseGiven: '500mg', nurseSignature: 'Nurse Anjali' })
      .expect(200)

    expect(administerRes.body.data.status).toBe('ADMINISTERED')
    expect(administerRes.body.data.nurseSignature).toBe('Nurse Anjali')
  })

  it('records a missed dose with a reason', async () => {
    const listRes = await request(server).get(`/api/v1/ipd/admissions/${admissionId}/mar`).set(authed()).expect(200)
    const pendingDose = listRes.body.data.data.find((d: { status: string }) => d.status === 'PENDING')

    const res = await request(server)
      .patch(`/api/v1/ipd/admissions/${admissionId}/mar/${pendingDose.id}/missed`)
      .set(authed())
      .send({ notes: 'Patient off ward for X-ray', nurseSignature: 'Nurse Anjali' })
      .expect(200)

    expect(res.body.data.status).toBe('MISSED')
  })

  it('rejects finalizing discharge before it has been approved', async () => {
    await request(server).post(`/api/v1/ipd/admissions/${admissionId}/discharge/complete`).set(authed()).send({}).expect(400)
  })

  it('approves discharge and seeds the nursing checklist', async () => {
    await request(server)
      .post(`/api/v1/ipd/admissions/${admissionId}/discharge/approve`)
      .set(authed())
      .send({ dischargeCondition: 'Improved' })
      .expect(201)

    const checklistRes = await request(server)
      .get(`/api/v1/ipd/admissions/${admissionId}/discharge/checklist`)
      .set(authed())
      .expect(200)

    expect(checklistRes.body.data.length).toBe(8)
    expect(checklistRes.body.data.every((i: { completed: boolean }) => i.completed === false)).toBe(true)
  })

  it('rejects finalizing before the checklist is complete', async () => {
    await request(server).post(`/api/v1/ipd/admissions/${admissionId}/discharge/complete`).set(authed()).send({}).expect(409)
  })

  it('completes every discharge checklist item', async () => {
    const checklistRes = await request(server)
      .get(`/api/v1/ipd/admissions/${admissionId}/discharge/checklist`)
      .set(authed())
      .expect(200)

    for (const item of checklistRes.body.data) {
      await request(server)
        .patch(`/api/v1/ipd/admissions/${admissionId}/discharge/checklist/${item.itemKey}`)
        .set(authed())
        .send({ completed: true })
        .expect(200)
        .expect((r) => {
          expect(r.body.data.completed).toBe(true)
        })
    }
  })

  it('rejects finalizing without a discharge summary', async () => {
    await request(server).post(`/api/v1/ipd/admissions/${admissionId}/discharge/complete`).set(authed()).send({}).expect(400)
  })

  it('prepares the discharge summary', async () => {
    const res = await request(server)
      .put(`/api/v1/ipd/admissions/${admissionId}/discharge/summary`)
      .set(authed())
      .send({
        finalDiagnosis: 'Community-acquired pneumonia, resolved',
        courseInHospital: 'Treated with IV antibiotics, afebrile by day 3.',
        conditionAtDischarge: 'Stable, ambulatory',
        followUpInstructions: 'Follow up in OPD after 1 week',
      })
      .expect(200)

    expect(res.body.data.finalDiagnosis).toBe('Community-acquired pneumonia, resolved')
  })

  it('finalizes discharge: vacates the bed, raises a room charge, closes the encounter', async () => {
    const res = await request(server)
      .post(`/api/v1/ipd/admissions/${admissionId}/discharge/complete`)
      .set(authed())
      .send({ dischargeNotes: 'Discharged in stable condition' })
      .expect(201)

    expect(res.body.data.status).toBe('DISCHARGED')
    expect(res.body.data.bed).toBeNull()

    const encounterRes = await request(server).get(`/api/v1/encounters/${encounterId}`).set(authed()).expect(200)
    expect(encounterRes.body.data.status).toBe('COMPLETED')

    const chargesRes = await request(server)
      .get('/api/v1/billing/charges')
      .set(authed())
      .query({ patientId })
      .expect(200)
    const roomCharge = chargesRes.body.data.data.find((c: { sourceModule: string }) => c.sourceModule === 'IPD')
    expect(roomCharge).toBeTruthy()
    expect(Number(roomCharge.totalAmount)).toBeGreaterThan(0)
  })

  it('downloads a real discharge summary PDF', async () => {
    const res = await request(server)
      .get(`/api/v1/ipd/admissions/${admissionId}/discharge/summary/pdf`)
      .set(authed())
      .expect(200)

    expect(res.headers['content-type']).toContain('application/pdf')
    expect(res.headers['content-disposition']).toContain('.pdf')
  })

  it('rejects nursing-note routes without a bearer token', async () => {
    await request(server).get(`/api/v1/ipd/admissions/${admissionId}/nursing-notes`).expect(401)
  })
})
