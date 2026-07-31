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

describe('Doctors (e2e)', () => {
  let app: NestFastifyApplication
  let server: Parameters<typeof request>[0]
  let accessToken: string
  let organizationId: string
  let hospitalId: string
  let departmentId: string

  const unique = Date.now()
  const email = `e2e-doctors-admin-${unique}@example.com`
  const orgSlug = `e2e-doctors-org-${unique}`

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

    // Ensure the permission catalog this suite depends on exists in the test
    // DB regardless of whether `db:seed` has been run against it —
    // /auth/register grants the new org's admin role every row currently in
    // the Permission table.
    const prisma = app.get(PrismaService)
    const requiredPermissions = [
      { resource: 'doctors', action: 'read', scope: 'all' },
      { resource: 'doctors', action: 'create', scope: 'all' },
      { resource: 'doctors', action: 'update', scope: 'all' },
      { resource: 'doctors', action: 'delete', scope: 'all' },
      { resource: 'hospitals', action: 'read', scope: 'all' },
      { resource: 'hospitals', action: 'create', scope: 'all' },
      { resource: 'departments', action: 'read', scope: 'all' },
      { resource: 'departments', action: 'create', scope: 'all' },
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
        organizationName: 'E2E Doctors Org',
        organizationSlug: orgSlug,
        adminFirstName: 'E2E',
        adminLastName: 'Admin',
        adminEmail: email,
        adminPassword: 'Passw0rd123',
        phone: '9876543210',
      })
      .expect(201)

    accessToken = registerRes.body.data.accessToken

    const org = await prisma.organization.findUniqueOrThrow({ where: { slug: orgSlug } })
    organizationId = org.id

    // Onboarding requires a "Doctor" role to already exist for the org —
    // /auth/register only provisions the org-admin role, so create it
    // directly (mirrors what packages/database/prisma/seed.ts does for the
    // demo org).
    await prisma.role.create({
      data: { name: 'Doctor', systemRole: 'DOCTOR', organizationId, description: 'Doctor role' },
    })

    const hospitalRes = await request(server)
      .post('/api/v1/hospitals')
      .set(authed())
      .send({ name: 'E2E Test Hospital', code: 'E2EH' })
      .expect(201)
    hospitalId = hospitalRes.body.data.id

    const departmentRes = await request(server)
      .post('/api/v1/departments')
      .set(authed())
      .send({ hospitalId, name: 'Cardiology', code: 'CARDIO' })
      .expect(201)
    departmentId = departmentRes.body.data.id

    function authed() {
      return { Authorization: `Bearer ${accessToken}` }
    }
  }, 30_000)

  afterAll(async () => {
    await app.close()
  })

  function authed() {
    return { Authorization: `Bearer ${accessToken}` }
  }

  const baseDoctorDto = {
    email: `e2e-doctor-${unique}@example.com`,
    firstName: 'Priya',
    lastName: 'Sharma',
    registrationNumber: `MCI-E2E-${unique}`,
    specialization: 'Cardiology',
    subSpecialization: 'Interventional Cardiology',
    qualification: 'MBBS, MD (Cardiology)',
    experienceYears: 12,
    languagesSpoken: ['English', 'Hindi'],
    consultationFee: 800,
    joiningDate: '2020-06-01',
  }

  it('creates a doctor and provisions a linked login account', async () => {
    const res = await request(server)
      .post('/api/v1/doctors')
      .set(authed())
      .send({ ...baseDoctorDto, hospitalId, departmentId })
      .expect(201)

    expect(res.body.data.fullName).toBe('Priya Sharma')
    expect(res.body.data.hospital.id).toBe(hospitalId)
    expect(res.body.data.department.id).toBe(departmentId)
    expect(res.body.data.availabilityStatus).toBe('AVAILABLE')

    const prisma = app.get(PrismaService)
    const createdUser = await prisma.user.findUnique({ where: { email: baseDoctorDto.email } })
    expect(createdUser).not.toBeNull()
    expect(createdUser?.organizationId).toBe(organizationId)
  })

  it('rejects a second doctor with the same registration number', async () => {
    await request(server)
      .post('/api/v1/doctors')
      .set(authed())
      .send({
        ...baseDoctorDto,
        email: `e2e-doctor-dup-${unique}@example.com`,
        hospitalId,
        departmentId,
      })
      .expect(409)
  })

  it('runs the full profile -> list -> search -> filter -> update -> deactivate -> restore flow', async () => {
    const createRes = await request(server)
      .post('/api/v1/doctors')
      .set(authed())
      .send({
        ...baseDoctorDto,
        email: `e2e-doctor-flow-${unique}@example.com`,
        registrationNumber: `MCI-E2E-FLOW-${unique}`,
        firstName: 'Arjun',
        lastName: 'Mehta',
        hospitalId,
        departmentId,
      })
      .expect(201)

    const doctorId = createRes.body.data.id as string

    await request(server)
      .get(`/api/v1/doctors/${doctorId}`)
      .set(authed())
      .expect(200)
      .expect((res) => {
        expect(res.body.data.summary).toEqual(
          expect.objectContaining({ appointments: 0, patients: 0, prescriptions: 0 }),
        )
      })

    await request(server)
      .get('/api/v1/doctors')
      .set(authed())
      .query({ q: 'Arjun' })
      .expect(200)
      .expect((res) => {
        const doctors = res.body.data.data as Array<{ id: string }>
        expect(doctors.some((d) => d.id === doctorId)).toBe(true)
      })

    await request(server)
      .get('/api/v1/doctors')
      .set(authed())
      .query({ hospitalId, departmentId, availabilityStatus: 'AVAILABLE' })
      .expect(200)
      .expect((res) => {
        const doctors = res.body.data.data as Array<{ id: string }>
        expect(doctors.some((d) => d.id === doctorId)).toBe(true)
      })

    await request(server)
      .get('/api/v1/doctors')
      .set(authed())
      .query({ language: 'Hindi' })
      .expect(200)
      .expect((res) => {
        const doctors = res.body.data.data as Array<{ id: string }>
        expect(doctors.some((d) => d.id === doctorId)).toBe(true)
      })

    await request(server)
      .patch(`/api/v1/doctors/${doctorId}`)
      .set(authed())
      .send({ consultationFee: 950 })
      .expect(200)
      .expect((res) => {
        expect(res.body.data.consultationFee).toBe(950)
      })

    await request(server).delete(`/api/v1/doctors/${doctorId}`).set(authed()).expect(200)

    await request(server)
      .get('/api/v1/doctors')
      .set(authed())
      .query({ isActive: 'false' })
      .expect(200)
      .expect((res) => {
        const doctors = res.body.data.data as Array<{ id: string }>
        expect(doctors.some((d) => d.id === doctorId)).toBe(true)
      })

    await request(server).post(`/api/v1/doctors/${doctorId}/restore`).set(authed()).expect(201)

    await request(server)
      .get(`/api/v1/doctors/${doctorId}`)
      .set(authed())
      .expect(200)
      .expect((res) => {
        expect(res.body.data.isActive).toBe(true)
      })
  }, 30_000)

  it('reports dashboard stats', async () => {
    await request(server)
      .get('/api/v1/doctors/stats/dashboard')
      .set(authed())
      .expect(200)
      .expect((res) => {
        expect(res.body.data.totalDoctors).toBeGreaterThan(0)
        expect(typeof res.body.data.activeDoctors).toBe('number')
      })
  })

  it('returns 404 from /doctors/me for a user with no linked doctor profile', async () => {
    await request(server).get('/api/v1/doctors/me').set(authed()).expect(404)
  })

  it('rejects doctor routes without a bearer token', async () => {
    await request(server).get('/api/v1/doctors').expect(401)
  })

  it('rejects doctor routes for a user without the doctors permission', async () => {
    const prisma = app.get(PrismaService)
    const restrictedRole = await prisma.role.create({
      data: { name: 'No Access', organizationId, description: 'Restricted test role' },
    })
    const restrictedPassword = 'Passw0rd123'
    await prisma.user.create({
      data: {
        email: `e2e-restricted-${unique}@example.com`,
        passwordHash: await argon2.hash(restrictedPassword),
        firstName: 'No',
        lastName: 'Access',
        organizationId,
        status: 'ACTIVE',
        isEmailVerified: true,
        userRoles: { create: [{ roleId: restrictedRole.id }] },
      },
    })

    const loginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: `e2e-restricted-${unique}@example.com`, password: restrictedPassword })
      .expect(200)

    const restrictedToken = loginRes.body.data.accessToken

    await request(server)
      .get('/api/v1/doctors')
      .set({ Authorization: `Bearer ${restrictedToken}` })
      .expect(403)
  })
})
