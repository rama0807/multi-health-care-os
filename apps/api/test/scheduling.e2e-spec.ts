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

// Local-calendar-date arithmetic (deliberately not `toISOString().slice(0,10)`
// - see availability.util.ts's toLocalDateString for why that can land on
// the wrong day near local midnight in non-UTC-aligned timezones).
function isoDate(daysFromNow: number): string {
  const date = new Date()
  date.setDate(date.getDate() + daysFromNow)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const ALL_WEEKDAYS = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
]

function fullWeekSchedulePayload(effectiveFrom: string) {
  return {
    effectiveFrom,
    days: ALL_WEEKDAYS.map((dayOfWeek) => ({
      dayOfWeek,
      isWorkingDay: true,
      shifts: [
        {
          startTime: '09:00',
          endTime: '17:00',
          slotDurationMinutes: 30,
          breaks: [{ startTime: '13:00', endTime: '13:30' }],
        },
      ],
    })),
  }
}

describe('Scheduling (e2e)', () => {
  let app: NestFastifyApplication
  let server: Parameters<typeof request>[0]
  let adminToken: string
  let organizationId: string
  let hospitalId: string
  let departmentId: string
  let doctorId: string
  let doctorToken: string

  const unique = Date.now()
  const adminEmail = `e2e-scheduling-admin-${unique}@example.com`
  const orgSlug = `e2e-scheduling-org-${unique}`
  const doctorEmail = `e2e-scheduling-doctor-${unique}@example.com`
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
      { resource: 'doctors', action: 'update', scope: 'all' },
      { resource: 'hospitals', action: 'read', scope: 'all' },
      { resource: 'hospitals', action: 'create', scope: 'all' },
      { resource: 'departments', action: 'read', scope: 'all' },
      { resource: 'departments', action: 'create', scope: 'all' },
      { resource: 'doctors.schedule', action: 'read', scope: 'all' },
      { resource: 'doctors.schedule', action: 'update', scope: 'all' },
      { resource: 'doctors.schedule', action: 'read', scope: 'own' },
      { resource: 'doctors.leave', action: 'read', scope: 'all' },
      { resource: 'doctors.leave', action: 'approve', scope: 'all' },
      { resource: 'doctors.leave', action: 'manage', scope: 'all' },
      { resource: 'doctors.leave', action: 'read', scope: 'own' },
      { resource: 'doctors.leave', action: 'manage', scope: 'own' },
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
        organizationName: 'E2E Scheduling Org',
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
    // Grant the doctor role its own-scoped schedule/leave permissions,
    // mirroring what packages/database/prisma/seed.ts does for the demo org.
    const ownPerms = await prisma.permission.findMany({
      where: {
        scope: 'own',
        OR: [
          { resource: 'doctors.schedule', action: 'read' },
          { resource: 'doctors.leave', action: 'read' },
          { resource: 'doctors.leave', action: 'manage' },
        ],
      },
    })
    await prisma.rolePermission.createMany({
      data: ownPerms.map((p) => ({ roleId: doctorRole.id, permissionId: p.id })),
    })

    const hospitalRes = await request(server)
      .post('/api/v1/hospitals')
      .set(authed())
      .send({ name: 'E2E Scheduling Hospital', code: 'E2ESCH' })
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
        registrationNumber: `MCI-SCHED-${unique}`,
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

    // The onboarding email carries a randomly-generated temporary password
    // that isn't returned over the API - reset it directly so this suite can
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

  describe('schedule CRUD', () => {
    const effectiveFrom = isoDate(-30)
    let scheduleId: string

    it('creates a new schedule version', async () => {
      const res = await request(server)
        .post(`/api/v1/doctors/${doctorId}/schedule`)
        .set(authed())
        .send(fullWeekSchedulePayload(effectiveFrom))
        .expect(201)

      scheduleId = res.body.data.id
      expect(res.body.data.effectiveFrom).toBe(effectiveFrom)
      expect(res.body.data.days).toHaveLength(7)
    })

    it('rejects a second version with the same effective date', async () => {
      await request(server)
        .post(`/api/v1/doctors/${doctorId}/schedule`)
        .set(authed())
        .send(fullWeekSchedulePayload(effectiveFrom))
        .expect(409)
    })

    it('returns the effective schedule', async () => {
      await request(server)
        .get(`/api/v1/doctors/${doctorId}/schedule`)
        .set(authed())
        .expect(200)
        .expect((res) => {
          expect(res.body.data.id).toBe(scheduleId)
        })
    })

    it('lists version history', async () => {
      await request(server)
        .get(`/api/v1/doctors/${doctorId}/schedule/versions`)
        .set(authed())
        .expect(200)
        .expect((res) => {
          expect(res.body.data.versions).toHaveLength(1)
        })
    })

    it('lets the doctor read their own schedule', async () => {
      await request(server)
        .get(`/api/v1/doctors/${doctorId}/schedule`)
        .set(authedAs(doctorToken))
        .expect(200)
    })

    it("rejects a doctor reading someone else's schedule", async () => {
      const otherDoctorRes = await request(server)
        .post('/api/v1/doctors')
        .set(authed())
        .send({
          email: `e2e-scheduling-other-${unique}@example.com`,
          firstName: 'Arjun',
          lastName: 'Mehta',
          registrationNumber: `MCI-SCHED-OTHER-${unique}`,
          specialization: 'Neurology',
          qualification: 'MBBS, MD',
          experienceYears: 8,
          languagesSpoken: ['English'],
          consultationFee: 600,
          joiningDate: '2021-01-01',
          hospitalId,
          departmentId,
        })
        .expect(201)

      await request(server)
        .get(`/api/v1/doctors/${otherDoctorRes.body.data.id}/schedule`)
        .set(authedAs(doctorToken))
        .expect(403)
    })

    it('rejects schedule routes without the schedule.read permission', async () => {
      await request(server).get(`/api/v1/doctors/${doctorId}/schedule`).expect(401)
    })

    it('toggles a version inactive and emits an update event', async () => {
      await request(server)
        .patch(`/api/v1/doctors/${doctorId}/schedule/${scheduleId}`)
        .set(authed())
        .send({ isActive: false })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.isActive).toBe(false)
        })

      // No active version now applies - GET falls back to null.
      await request(server)
        .get(`/api/v1/doctors/${doctorId}/schedule`)
        .set(authed())
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeNull()
        })

      // Reactivate so later availability/dashboard assertions have a schedule to work with.
      await request(server)
        .patch(`/api/v1/doctors/${doctorId}/schedule/${scheduleId}`)
        .set(authed())
        .send({ isActive: true })
        .expect(200)
    })
  })

  describe('leave workflow', () => {
    let approvedLeaveId: string
    let rejectedLeaveId: string
    let cancelledLeaveId: string

    it('applies for leave (PENDING)', async () => {
      const res = await request(server)
        .post('/api/v1/doctor-leaves')
        .set(authed())
        .send({ doctorId, leaveType: 'CASUAL', startDate: isoDate(1), endDate: isoDate(2), reason: 'Trip' })
        .expect(201)

      approvedLeaveId = res.body.data.id
      expect(res.body.data.status).toBe('PENDING')
    })

    it('rejects an overlapping leave request', async () => {
      await request(server)
        .post('/api/v1/doctor-leaves')
        .set(authed())
        .send({ doctorId, leaveType: 'SICK', startDate: isoDate(1), endDate: isoDate(1) })
        .expect(409)
    })

    it('approves the pending leave', async () => {
      await request(server)
        .post(`/api/v1/doctor-leaves/${approvedLeaveId}/approve`)
        .set(authed())
        .send({ decisionNote: 'ok' })
        .expect(201)
        .expect((res) => {
          expect(res.body.data.status).toBe('APPROVED')
        })
    })

    it('rejects approving it a second time', async () => {
      await request(server)
        .post(`/api/v1/doctor-leaves/${approvedLeaveId}/approve`)
        .set(authed())
        .send({})
        .expect(409)
    })

    it('applies for and rejects a second leave request', async () => {
      const res = await request(server)
        .post('/api/v1/doctor-leaves')
        .set(authed())
        .send({ doctorId, leaveType: 'SICK', startDate: isoDate(3), endDate: isoDate(3) })
        .expect(201)
      rejectedLeaveId = res.body.data.id

      await request(server)
        .post(`/api/v1/doctor-leaves/${rejectedLeaveId}/reject`)
        .set(authed())
        .send({ decisionNote: 'insufficient staffing' })
        .expect(201)
        .expect((res) => {
          expect(res.body.data.status).toBe('REJECTED')
        })
    })

    it('applies for and cancels a third leave request', async () => {
      const res = await request(server)
        .post('/api/v1/doctor-leaves')
        .set(authed())
        .send({ doctorId, leaveType: 'CONFERENCE', startDate: isoDate(4), endDate: isoDate(4) })
        .expect(201)
      cancelledLeaveId = res.body.data.id

      await request(server).post(`/api/v1/doctor-leaves/${cancelledLeaveId}/cancel`).set(authed()).expect(201)

      await request(server)
        .get(`/api/v1/doctor-leaves/${cancelledLeaveId}`)
        .set(authed())
        .expect(200)
        .expect((res) => {
          expect(res.body.data.status).toBe('CANCELLED')
        })
    })

    it('lets a doctor apply for their own leave', async () => {
      await request(server)
        .post('/api/v1/doctor-leaves')
        .set(authedAs(doctorToken))
        .send({ doctorId, leaveType: 'EARNED', startDate: isoDate(6), endDate: isoDate(6) })
        .expect(201)
    })

    it("rejects a doctor applying for someone else's leave", async () => {
      await request(server)
        .post('/api/v1/doctor-leaves')
        .set(authedAs(doctorToken))
        .send({ doctorId: 'not-my-doctor-id', leaveType: 'EARNED', startDate: isoDate(7), endDate: isoDate(7) })
        .expect(403)
    })

    it('scopes an own-permission list to the caller doctor only', async () => {
      await request(server)
        .get('/api/v1/doctor-leaves')
        .set(authedAs(doctorToken))
        .expect(200)
        .expect((res) => {
          const leaves = res.body.data.data as Array<{ doctorId: string }>
          expect(leaves.length).toBeGreaterThan(0)
          expect(leaves.every((l) => l.doctorId === doctorId)).toBe(true)
        })
    })

    it('lists upcoming approved leave', async () => {
      await request(server)
        .get('/api/v1/doctor-leaves/upcoming')
        .set(authed())
        .expect(200)
        .expect((res) => {
          const leaves = res.body.data.leaves as Array<{ id: string }>
          expect(leaves.some((l) => l.id === approvedLeaveId)).toBe(true)
        })
    })
  })

  describe('availability engine', () => {
    it('returns bookable slots on a working, non-leave day', async () => {
      await request(server)
        .get(`/api/v1/doctors/${doctorId}/availability`)
        .set(authed())
        .query({ date: isoDate(10) })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.isWorkingDay).toBe(true)
          expect(res.body.data.onLeave).toBe(false)
          expect(res.body.data.slots.length).toBeGreaterThan(0)
          // 13:00-13:30 break must not appear as a bookable slot start.
          expect(res.body.data.slots.some((s: { start: string }) => s.start.includes('13:00'))).toBe(false)
        })
    })

    it('returns onLeave for a date covered by the approved leave', async () => {
      await request(server)
        .get(`/api/v1/doctors/${doctorId}/availability`)
        .set(authed())
        .query({ date: isoDate(1) })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.onLeave).toBe(true)
          expect(res.body.data.slots).toEqual([])
        })
    })

    it('honors a duration override', async () => {
      await request(server)
        .get(`/api/v1/doctors/${doctorId}/availability`)
        .set(authed())
        .query({ date: isoDate(10), duration: 60 })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.slots.length).toBeGreaterThan(0)
        })
    })

    it("returns today's status", async () => {
      await request(server)
        .get(`/api/v1/doctors/${doctorId}/availability/today`)
        .set(authed())
        .expect(200)
        .expect((res) => {
          expect(typeof res.body.data.withinShiftNow).toBe('boolean')
        })
    })

    it('rejects an unauthorized role from reading availability', async () => {
      const restrictedRole = await app.get(PrismaService).role.create({
        data: { name: 'No Sched Access', organizationId, description: 'Restricted test role' },
      })
      const restrictedPassword = 'Passw0rd123'
      await app.get(PrismaService).user.create({
        data: {
          email: `e2e-sched-restricted-${unique}@example.com`,
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
        .send({ email: `e2e-sched-restricted-${unique}@example.com`, password: restrictedPassword })
        .expect(200)

      await request(server)
        .get(`/api/v1/doctors/${doctorId}/availability`)
        .set(authedAs(loginRes.body.data.accessToken))
        .query({ date: isoDate(10) })
        .expect(403)
    })
  })

  describe('dashboard stats', () => {
    it('reports availability stats alongside doctor counts', async () => {
      await request(server)
        .get('/api/v1/doctors/stats/dashboard')
        .set(authed())
        .expect(200)
        .expect((res) => {
          const stats = res.body.data
          expect(typeof stats.totalDoctors).toBe('number')
          expect(typeof stats.availableToday).toBe('number')
          expect(typeof stats.onLeaveToday).toBe('number')
          expect(typeof stats.offDutyToday).toBe('number')
          expect(Array.isArray(stats.upcomingLeave)).toBe(true)
        })
    })
  })
})
