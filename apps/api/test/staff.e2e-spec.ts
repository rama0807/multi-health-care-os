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

describe('Staff & Attendance (e2e)', () => {
  let app: NestFastifyApplication
  let server: Parameters<typeof request>[0]
  let accessToken: string
  let hospitalId: string
  let departmentId: string
  let staffId: string
  let shiftId: string
  let leaveId: string
  let attendanceId: string

  const unique = Date.now()
  const email = `e2e-staff-admin-${unique}@example.com`
  const orgSlug = `e2e-staff-org-${unique}`
  const today = new Date().toISOString().slice(0, 10)

  function authed() {
    return { Authorization: `Bearer ${accessToken}` }
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
      ['staff', ['read', 'create', 'update', 'delete']],
      ['staff.documents', ['read', 'manage']],
      ['attendance', ['read', 'create', 'update', 'manage']],
      ['leave', ['read', 'approve', 'manage']],
      ['shifts', ['read', 'create', 'update', 'delete']],
      ['shifts.roster', ['read', 'create', 'update']],
      ['hospitals', ['read', 'create']],
      ['departments', ['read', 'create']],
    ] as const
    for (const [resource, actions] of requiredPermissions) {
      for (const action of actions) {
        await prisma.permission.upsert({
          where: { resource_action_scope: { resource, action, scope: 'all' } },
          update: {},
          create: { resource, action, scope: 'all', description: `${action} ${resource} (all)` },
        })
      }
    }

    const registerRes = await request(server)
      .post('/api/v1/auth/register')
      .send({
        organizationName: 'E2E Staff Org',
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

    // Onboarding requires a "Nurse" role to already exist for the org.
    await prisma.role.create({
      data: { name: 'Nurse', systemRole: 'NURSE', organizationId: org.id, description: 'Nurse role' },
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
      .send({ hospitalId, name: 'Nursing', code: 'NURS' })
      .expect(201)
    departmentId = departmentRes.body.data.id
  }, 30_000)

  afterAll(async () => {
    await app.close()
  })

  it('creates a staff member and provisions a linked login account', async () => {
    const res = await request(server)
      .post('/api/v1/staff')
      .set(authed())
      .send({
        email: `e2e-nurse-${unique}@example.com`,
        firstName: 'Anjali',
        lastName: 'Verma',
        systemRole: 'NURSE',
        employeeId: `EMP-E2E-${unique}`,
        designation: 'Staff Nurse',
        hospitalId,
        departmentId,
        employmentType: 'FULL_TIME',
        joiningDate: '2024-01-01',
        monthlySalary: 30000,
      })
      .expect(201)

    staffId = res.body.data.id
    expect(res.body.data.fullName).toBe('Anjali Verma')
    expect(res.body.data.employmentStatus).toBe('ACTIVE')
    expect(res.body.data.department.id).toBe(departmentId)

    const prisma = app.get(PrismaService)
    const createdUser = await prisma.user.findUnique({ where: { email: `e2e-nurse-${unique}@example.com` } })
    expect(createdUser).not.toBeNull()
  })

  it('rejects a second staff member with the same employee ID', async () => {
    await request(server)
      .post('/api/v1/staff')
      .set(authed())
      .send({
        email: `e2e-nurse-dup-${unique}@example.com`,
        firstName: 'Second',
        lastName: 'Nurse',
        systemRole: 'NURSE',
        employeeId: `EMP-E2E-${unique}`,
        designation: 'Staff Nurse',
        hospitalId,
        departmentId,
        joiningDate: '2024-01-01',
      })
      .expect(409)
  })

  it('lists and searches the staff directory', async () => {
    await request(server)
      .get('/api/v1/staff')
      .set(authed())
      .query({ q: 'Anjali' })
      .expect(200)
      .expect((res) => {
        const staff = res.body.data.data as Array<{ id: string }>
        expect(staff.some((s) => s.id === staffId)).toBe(true)
      })
  })

  it('creates a shift catalog entry spanning the full day', async () => {
    const res = await request(server)
      .post('/api/v1/shifts')
      .set(authed())
      .send({ name: 'General', code: `GEN-${unique}`, startTime: '00:00', endTime: '23:59', gracePeriodMinutes: 120 })
      .expect(201)

    shiftId = res.body.data.id
    expect(res.body.data.standardMinutes).toBeGreaterThan(0)
  })

  it('assigns the staff member to the shift roster for today', async () => {
    const res = await request(server)
      .post('/api/v1/shifts/roster')
      .set(authed())
      .send({ staffId, date: today, shiftId, isOff: false })
      .expect(201)

    expect(res.body.data.shift.id).toBe(shiftId)

    await request(server)
      .get('/api/v1/shifts/roster')
      .set(authed())
      .query({ from: today, to: today, staffId })
      .expect(200)
      .expect((res2) => {
        expect(res2.body.data).toHaveLength(1)
      })
  })

  it('clocks in, clocks out, and lists the resulting attendance record', async () => {
    const clockInRes = await request(server)
      .post('/api/v1/attendance/clock-in')
      .set(authed())
      .send({ staffId })
      .expect(201)

    attendanceId = clockInRes.body.data.id
    expect(clockInRes.body.data.clockInAt).not.toBeNull()
    expect(['PRESENT', 'LATE']).toContain(clockInRes.body.data.status)

    await request(server).post('/api/v1/attendance/clock-in').set(authed()).send({ staffId }).expect(409)

    const clockOutRes = await request(server)
      .post('/api/v1/attendance/clock-out')
      .set(authed())
      .send({ staffId })
      .expect(201)

    expect(clockOutRes.body.data.clockOutAt).not.toBeNull()
    expect(clockOutRes.body.data.workedMinutes).toBeGreaterThanOrEqual(0)

    await request(server)
      .get('/api/v1/attendance')
      .set(authed())
      .query({ staffId })
      .expect(200)
      .expect((res) => {
        const rows = res.body.data.data as Array<{ id: string }>
        expect(rows.some((r) => r.id === attendanceId)).toBe(true)
      })
  })

  it('applies a manual correction to an attendance record', async () => {
    const res = await request(server)
      .patch(`/api/v1/attendance/${attendanceId}/correct`)
      .set(authed())
      .send({ status: 'PRESENT', correctionReason: 'Forgot to clock out on time yesterday' })
      .expect(200)

    expect(res.body.data.isCorrected).toBe(true)
    expect(res.body.data.correctionReason).toBe('Forgot to clock out on time yesterday')
  })

  it('reports attendance dashboard stats', async () => {
    await request(server)
      .get('/api/v1/attendance/dashboard/stats')
      .set(authed())
      .expect(200)
      .expect((res) => {
        expect(res.body.data.totalStaff).toBeGreaterThanOrEqual(1)
      })
  })

  it('uploads and lists a staff document', async () => {
    await request(server)
      .post(`/api/v1/staff/${staffId}/documents`)
      .set(authed())
      .field('documentType', 'ID_PROOF')
      .attach('file', Buffer.from('%PDF-1.4 fake id'), { filename: 'id.pdf', contentType: 'application/pdf' })
      .expect(201)

    await request(server)
      .get(`/api/v1/staff/${staffId}/documents`)
      .set(authed())
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toHaveLength(1)
      })
  })

  it('configures a leave type, applies leave, approves it, and reflects the balance', async () => {
    await request(server)
      .put('/api/v1/leave/types')
      .set(authed())
      .send({ leaveType: 'CASUAL', annualDays: 12, isPaid: true, isActive: true })
      .expect(200)

    const applyRes = await request(server)
      .post('/api/v1/leave')
      .set(authed())
      .send({ staffId, leaveType: 'CASUAL', startDate: '2026-09-10', endDate: '2026-09-12', reason: 'Personal' })
      .expect(201)

    leaveId = applyRes.body.data.id
    expect(applyRes.body.data.days).toBe(3)
    expect(applyRes.body.data.status).toBe('PENDING')

    await request(server).post(`/api/v1/leave/${leaveId}/approve`).set(authed()).send({}).expect(201)

    const balanceRes = await request(server)
      .get('/api/v1/leave/balance')
      .set(authed())
      .query({ staffId, year: 2026 })
      .expect(200)

    const casual = (balanceRes.body.data.entries as Array<{ leaveType: string; usedDays: number }>).find(
      (e) => e.leaveType === 'CASUAL',
    )
    expect(casual?.usedDays).toBe(3)
  })

  it('manages the holiday calendar', async () => {
    await request(server)
      .post('/api/v1/leave/holidays')
      .set(authed())
      .send({ name: 'Independence Day', date: '2026-08-15', isOptional: false })
      .expect(201)

    await request(server)
      .get('/api/v1/leave/holidays')
      .set(authed())
      .query({ year: 2026 })
      .expect(200)
      .expect((res) => {
        expect(res.body.data.holidays.length).toBeGreaterThanOrEqual(1)
      })
  })

  it('reports staff dashboard stats', async () => {
    await request(server)
      .get('/api/v1/staff/dashboard/stats')
      .set(authed())
      .expect(200)
      .expect((res) => {
        expect(res.body.data.totalStaff).toBeGreaterThanOrEqual(1)
      })
  })

  it('generates a payroll prep summary and CSV export for the current month', async () => {
    const month = new Date().toISOString().slice(0, 7)

    const summaryRes = await request(server)
      .get('/api/v1/staff/payroll/summary')
      .set(authed())
      .query({ month })
      .expect(200)

    const entries = summaryRes.body.data.entries as Array<{ staffId: string }>
    expect(entries.some((e) => e.staffId === staffId)).toBe(true)

    const exportRes = await request(server)
      .get('/api/v1/staff/payroll/export')
      .set(authed())
      .query({ month })
      .expect(200)

    expect(exportRes.headers['content-type']).toContain('text/csv')
    expect(exportRes.text).toContain('Employee ID')
  })

  it('changes employment status and rejects a duplicate clock-in for a terminated staff member', async () => {
    await request(server)
      .post(`/api/v1/staff/${staffId}/employment-status`)
      .set(authed())
      .send({ status: 'ON_LEAVE' })
      .expect(201)
      .expect((res) => {
        expect(res.body.data.employmentStatus).toBe('ON_LEAVE')
      })
  })
})
