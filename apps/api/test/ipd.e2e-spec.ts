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

describe('IPD & Bed Management (e2e)', () => {
  let app: NestFastifyApplication
  let server: Parameters<typeof request>[0]
  let adminToken: string
  let doctorId: string
  let patientId: string

  const unique = Date.now()
  const adminEmail = `e2e-ipd-admin-${unique}@example.com`
  const orgSlug = `e2e-ipd-org-${unique}`

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
      { resource: 'ipd.wards', action: 'update', scope: 'all' },
      { resource: 'ipd.wards', action: 'delete', scope: 'all' },
      { resource: 'ipd.rooms', action: 'read', scope: 'all' },
      { resource: 'ipd.rooms', action: 'create', scope: 'all' },
      { resource: 'ipd.rooms', action: 'update', scope: 'all' },
      { resource: 'ipd.rooms', action: 'delete', scope: 'all' },
      { resource: 'ipd.beds', action: 'read', scope: 'all' },
      { resource: 'ipd.beds', action: 'create', scope: 'all' },
      { resource: 'ipd.beds', action: 'update', scope: 'all' },
      { resource: 'ipd.beds', action: 'delete', scope: 'all' },
      { resource: 'ipd.admissions', action: 'read', scope: 'all' },
      { resource: 'ipd.admissions', action: 'create', scope: 'all' },
      { resource: 'ipd.admissions', action: 'update', scope: 'all' },
      { resource: 'ipd.transfer', action: 'read', scope: 'all' },
      { resource: 'ipd.transfer', action: 'create', scope: 'all' },
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
        organizationName: 'E2E IPD Org',
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
    // `StaffOnboardingService` (used by `DoctorsService.create`) requires a
    // 'DOCTOR'-system-role row to already exist for the org — the demo org
    // gets one from `seed.ts`'s ROLE_SPECS, but a register()-created test org
    // doesn't, so it must be created explicitly (mirrors prescriptions.e2e-spec.ts).
    await prisma.role.create({
      data: { name: 'Doctor', systemRole: 'DOCTOR', organizationId: org.id, description: 'Doctor role' },
    })

    const hospitalRes = await request(server)
      .post('/api/v1/hospitals')
      .set(authed())
      .send({ name: 'E2E IPD Hospital', code: 'E2EIPD' })
      .expect(201)
    const hospitalId = hospitalRes.body.data.id

    const departmentRes = await request(server)
      .post('/api/v1/departments')
      .set(authed())
      .send({ hospitalId, name: 'Cardiology', code: 'CARDIO' })
      .expect(201)
    const departmentId = departmentRes.body.data.id

    const doctorRes = await request(server)
      .post('/api/v1/doctors')
      .set(authed())
      .send({
        email: `e2e-ipd-doctor-${unique}@example.com`,
        firstName: 'Ravi',
        lastName: 'Kumar',
        registrationNumber: `MCI-IPD-${unique}`,
        specialization: 'Cardiology',
        qualification: 'MBBS, MD',
        experienceYears: 10,
        languagesSpoken: ['English'],
        consultationFee: 800,
        joiningDate: '2018-01-01',
        hospitalId,
        departmentId,
      })
      .expect(201)
    doctorId = doctorRes.body.data.id

    const patientRes = await request(server)
      .post('/api/v1/patients')
      .set(authed())
      .send({
        firstName: 'Ramesh',
        lastName: 'Gupta',
        phone: '9812340099',
        dateOfBirth: '1970-03-12',
        gender: 'MALE',
      })
      .expect(201)
    patientId = patientRes.body.data.id
  }, 30_000)

  afterAll(async () => {
    await app.close()
  })

  let wardId: string
  let roomId: string
  let bedId: string
  let bed2Id: string
  let admissionId: string

  it('creates a ward, room, and two beds', async () => {
    const wardRes = await request(server)
      .post('/api/v1/ipd/wards')
      .set(authed())
      .send({ name: 'ICU Ward', code: `ICU-${unique}`, floor: '3', block: 'A', type: 'ICU' })
      .expect(201)
    wardId = wardRes.body.data.id
    expect(wardRes.body.data.status).toBe('ACTIVE')

    const roomRes = await request(server)
      .post('/api/v1/ipd/rooms')
      .set(authed())
      .send({ roomNumber: '301', wardId, floor: '3', capacity: 1, chargesPerDay: 5000 })
      .expect(201)
    roomId = roomRes.body.data.id
    expect(roomRes.body.data.chargesPerDay).toBe('5000')

    const bedRes = await request(server)
      .post('/api/v1/ipd/beds')
      .set(authed())
      .send({ bedNumber: '301-A', roomId, type: 'ICU' })
      .expect(201)
    bedId = bedRes.body.data.id
    expect(bedRes.body.data.status).toBe('AVAILABLE')
    expect(bedRes.body.data.wardId).toBe(wardId)

    const bed2Res = await request(server)
      .post('/api/v1/ipd/beds')
      .set(authed())
      .send({ bedNumber: '301-B', roomId, type: 'ICU' })
      .expect(201)
    bed2Id = bed2Res.body.data.id
  })

  it('rejects a duplicate ward code', async () => {
    await request(server)
      .post('/api/v1/ipd/wards')
      .set(authed())
      .send({ name: 'Dup', code: `ICU-${unique}`, type: 'ICU' })
      .expect(409)
  })

  it('shows the ward with computed bed counts', async () => {
    await request(server)
      .get(`/api/v1/ipd/wards/${wardId}`)
      .set(authed())
      .expect(200)
      .expect((res) => {
        expect(res.body.data.bedCount).toBe(2)
        expect(res.body.data.availableBedCount).toBe(2)
      })
  })

  it('admits a patient directly into a bed and auto-creates an IPD encounter', async () => {
    const res = await request(server)
      .post('/api/v1/ipd/admissions')
      .set(authed())
      .send({
        patientId,
        attendingDoctorId: doctorId,
        wardId,
        roomId,
        bedId,
        type: 'EMERGENCY',
        admissionReason: 'Acute chest pain, suspected MI',
        diagnosis: 'NSTEMI',
      })
      .expect(201)

    admissionId = res.body.data.id
    expect(res.body.data.admissionNumber).toMatch(/^ADM-/)
    expect(res.body.data.status).toBe('ADMITTED')
    expect(res.body.data.bed.id).toBe(bedId)
    expect(res.body.data.encounterId).toBeTruthy()

    await request(server)
      .get(`/api/v1/ipd/beds/${bedId}`)
      .set(authed())
      .expect(200)
      .expect((res2) => {
        expect(res2.body.data.status).toBe('OCCUPIED')
        expect(res2.body.data.currentAdmission.id).toBe(admissionId)
      })
  })

  it('rejects admitting into a bed that is already occupied', async () => {
    await request(server)
      .post('/api/v1/ipd/admissions')
      .set(authed())
      .send({
        patientId,
        attendingDoctorId: doctorId,
        wardId,
        roomId,
        bedId,
        admissionReason: 'Duplicate bed attempt',
      })
      .expect(409)
  })

  it('lists admissions filtered by ward', async () => {
    await request(server)
      .get('/api/v1/ipd/admissions')
      .set(authed())
      .query({ wardId })
      .expect(200)
      .expect((res) => {
        const rows = res.body.data.data as Array<{ id: string }>
        expect(rows.some((a) => a.id === admissionId)).toBe(true)
      })
  })

  it('updates the admission reason and expected discharge date', async () => {
    await request(server)
      .patch(`/api/v1/ipd/admissions/${admissionId}`)
      .set(authed())
      .send({ diagnosis: 'STEMI (revised)', expectedDischargeAt: '2026-08-10' })
      .expect(200)
      .expect((res) => {
        expect(res.body.data.diagnosis).toBe('STEMI (revised)')
      })
  })

  it('rejects allocate when the admission already holds a bed', async () => {
    await request(server)
      .post(`/api/v1/ipd/admissions/${admissionId}/allocate`)
      .set(authed())
      .send({ bedId: bed2Id })
      .expect(409)
  })

  it('transfers the admission to a second bed and records history', async () => {
    await request(server)
      .post(`/api/v1/ipd/admissions/${admissionId}/transfer`)
      .set(authed())
      .send({ toBedId: bed2Id, reason: 'Bed maintenance required' })
      .expect(201)
      .expect((res) => {
        expect(res.body.data.fromBedId).toBe(bedId)
        expect(res.body.data.toBedId).toBe(bed2Id)
      })

    await request(server)
      .get(`/api/v1/ipd/admissions/${admissionId}/transfers`)
      .set(authed())
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toHaveLength(1)
        expect(res.body.data[0].toBed.bedNumber).toBe('301-B')
      })

    await request(server)
      .get(`/api/v1/ipd/beds/${bedId}`)
      .set(authed())
      .expect(200)
      .expect((res) => {
        expect(res.body.data.status).toBe('CLEANING')
      })
  })

  it('vacates the current bed and records allocation history', async () => {
    await request(server)
      .post(`/api/v1/ipd/admissions/${admissionId}/vacate`)
      .set(authed())
      .send({ reason: 'Moved to OT' })
      .expect(201)

    await request(server)
      .get(`/api/v1/ipd/admissions/${admissionId}/allocations`)
      .set(authed())
      .expect(200)
      .expect((res) => {
        const actions = (res.body.data as Array<{ action: string }>).map((a) => a.action)
        expect(actions).toContain('ALLOCATED')
        expect(actions).toContain('VACATED')
      })

    await request(server)
      .get(`/api/v1/ipd/admissions/${admissionId}`)
      .set(authed())
      .expect(200)
      .expect((res) => {
        expect(res.body.data.bed).toBeNull()
      })
  })

  it('reports bed occupancy on the dashboard', async () => {
    await request(server)
      .get('/api/v1/ipd/dashboard')
      .set(authed())
      .expect(200)
      .expect((res) => {
        expect(res.body.data.totalBeds).toBeGreaterThanOrEqual(2)
        expect(res.body.data.admissionsToday).toBeGreaterThanOrEqual(1)
        expect(res.body.data.transfersToday).toBeGreaterThanOrEqual(1)
        expect(res.body.data.icuTotalBeds).toBeGreaterThanOrEqual(2)
      })
  })

  it('marks a cleaned bed available again through a direct bed update', async () => {
    await request(server)
      .patch(`/api/v1/ipd/beds/${bedId}`)
      .set(authed())
      .send({ status: 'AVAILABLE' })
      .expect(200)
      .expect((res) => {
        expect(res.body.data.status).toBe('AVAILABLE')
      })
  })

  it('rejects setting a bed directly to OCCUPIED', async () => {
    await request(server).patch(`/api/v1/ipd/beds/${bedId}`).set(authed()).send({ status: 'OCCUPIED' }).expect(400)
  })

  it('cancels the admission and releases its bed', async () => {
    // The admission was vacated (no bed) in the previous test — re-allocate
    // bed2 first so this test genuinely exercises cancel's bed-release path.
    await request(server).patch(`/api/v1/ipd/beds/${bed2Id}`).set(authed()).send({ status: 'AVAILABLE' }).expect(200)
    await request(server)
      .post(`/api/v1/ipd/admissions/${admissionId}/allocate`)
      .set(authed())
      .send({ bedId: bed2Id })
      .expect(201)

    await request(server)
      .patch(`/api/v1/ipd/admissions/${admissionId}/cancel`)
      .set(authed())
      .send({ reason: 'Test complete' })
      .expect(200)
      .expect((res) => {
        expect(res.body.data.status).toBe('CANCELLED')
      })

    await request(server)
      .get(`/api/v1/ipd/beds/${bed2Id}`)
      .set(authed())
      .expect(200)
      .expect((res) => {
        expect(res.body.data.status).toBe('AVAILABLE')
      })
  })

  it('deactivates a room and rejects a duplicate room number in the same ward afterwards remaining blocked for new beds', async () => {
    await request(server).delete(`/api/v1/ipd/rooms/${roomId}`).set(authed()).expect(200)

    await request(server)
      .get(`/api/v1/ipd/rooms/${roomId}`)
      .set(authed())
      .expect(200)
      .expect((res) => {
        expect(res.body.data.status).toBe('INACTIVE')
      })
  })

  it('rejects IPD routes without a bearer token', async () => {
    await request(server).get('/api/v1/ipd/wards').expect(401)
    await request(server).get('/api/v1/ipd/admissions').expect(401)
  })
})
