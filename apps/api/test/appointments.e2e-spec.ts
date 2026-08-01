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

// A Monday, several weeks out, so the doctor's Mon-Fri 09:00-17:00 schedule
// (created below) is guaranteed to be in effect and not colliding with
// anything else this suite creates.
const APPOINTMENT_DATE = '2026-08-31'

const ALL_WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']

function fullWeekSchedulePayload(effectiveFrom: string) {
  return {
    effectiveFrom,
    days: ALL_WEEKDAYS.map((dayOfWeek) => ({
      dayOfWeek,
      isWorkingDay: !['SUNDAY', 'SATURDAY'].includes(dayOfWeek),
      shifts: ['SUNDAY', 'SATURDAY'].includes(dayOfWeek)
        ? []
        : [{ startTime: '09:00', endTime: '17:00', slotDurationMinutes: 15, breaks: [] }],
    })),
  }
}

describe('Appointments (e2e)', () => {
  let app: NestFastifyApplication
  let server: Parameters<typeof request>[0]
  let adminToken: string
  let doctorId: string
  let doctorToken: string
  let secondDoctorId: string
  let patientId: string

  const unique = Date.now()
  const adminEmail = `e2e-appts-admin-${unique}@example.com`
  const orgSlug = `e2e-appts-org-${unique}`
  const doctorEmail = `e2e-appts-doctor-${unique}@example.com`
  const secondDoctorEmail = `e2e-appts-doctor2-${unique}@example.com`
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
      { resource: 'doctors.schedule', action: 'update', scope: 'all' },
      { resource: 'patients', action: 'create', scope: 'all' },
      { resource: 'appointments', action: 'read', scope: 'all' },
      { resource: 'appointments', action: 'create', scope: 'all' },
      { resource: 'appointments', action: 'update', scope: 'all' },
      { resource: 'appointments', action: 'read', scope: 'own' },
      { resource: 'appointments', action: 'update', scope: 'own' },
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
        organizationName: 'E2E Appointments Org',
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
          { resource: 'appointments', action: 'read' },
          { resource: 'appointments', action: 'update' },
        ],
      },
    })
    await prisma.rolePermission.createMany({
      data: ownPerms.map((p) => ({ roleId: doctorRole.id, permissionId: p.id })),
    })

    const hospitalRes = await request(server)
      .post('/api/v1/hospitals')
      .set(authed())
      .send({ name: 'E2E Appointments Hospital', code: 'E2EAPT' })
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
        email: doctorEmail,
        firstName: 'Priya',
        lastName: 'Sharma',
        registrationNumber: `MCI-APPT-${unique}`,
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
        registrationNumber: `MCI-APPT2-${unique}`,
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

    await request(server)
      .post(`/api/v1/doctors/${doctorId}/schedule`)
      .set(authed())
      .send(fullWeekSchedulePayload('2020-01-01'))
      .expect(201)
    await request(server)
      .post(`/api/v1/doctors/${secondDoctorId}/schedule`)
      .set(authed())
      .send(fullWeekSchedulePayload('2020-01-01'))
      .expect(201)

    const patientRes = await request(server)
      .post('/api/v1/patients')
      .set(authed())
      .send({
        firstName: 'Vikram',
        lastName: 'Nair',
        phone: '9900112233',
        dateOfBirth: '1988-11-20',
        gender: 'MALE',
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

  describe('available slots', () => {
    it('returns bookable slots for a working day', async () => {
      const res = await request(server)
        .get(`/api/v1/appointments/available-slots?doctorId=${doctorId}&date=${APPOINTMENT_DATE}&duration=15`)
        .set(authed())
        .expect(200)

      expect(res.body.data.slots.length).toBeGreaterThan(0)
      expect(res.body.data.slots[0]).toEqual(
        expect.objectContaining({ start: expect.any(String), end: expect.any(String) }),
      )
    })

    it('requires doctorId and date query params', async () => {
      await request(server).get('/api/v1/appointments/available-slots').set(authed()).expect(400)
    })
  })

  describe('booking + conflict detection', () => {
    let firstAppointmentId: string
    let firstSlotStart: string

    it('books the first available slot', async () => {
      const slotsRes = await request(server)
        .get(`/api/v1/appointments/available-slots?doctorId=${doctorId}&date=${APPOINTMENT_DATE}&duration=15`)
        .set(authed())
        .expect(200)
      firstSlotStart = slotsRes.body.data.slots[0].start

      const res = await request(server)
        .post('/api/v1/appointments')
        .set(authed())
        .send({
          patientId,
          doctorId,
          scheduledAt: new Date(firstSlotStart).toISOString(),
          durationMinutes: 15,
          type: 'OPD',
          chiefComplaint: 'Chest pain',
        })
        .expect(201)

      firstAppointmentId = res.body.data.id
      expect(res.body.data.status).toBe('SCHEDULED')
      expect(res.body.data.appointmentNumber).toMatch(/^APT-/)
    })

    it('rejects double-booking the same slot', async () => {
      await request(server)
        .post('/api/v1/appointments')
        .set(authed())
        .send({
          patientId,
          doctorId,
          scheduledAt: new Date(firstSlotStart).toISOString(),
          durationMinutes: 15,
          type: 'OPD',
        })
        .expect(409)
    })

    it('rejects booking outside the schedule (e.g. 3am)', async () => {
      const outsideHours = new Date(`${APPOINTMENT_DATE}T03:00:00`)
      await request(server)
        .post('/api/v1/appointments')
        .set(authed())
        .send({ patientId, doctorId, scheduledAt: outsideHours.toISOString(), durationMinutes: 15, type: 'OPD' })
        .expect(409)
    })

    it('no longer offers the booked slot as available', async () => {
      const res = await request(server)
        .get(`/api/v1/appointments/available-slots?doctorId=${doctorId}&date=${APPOINTMENT_DATE}&duration=15`)
        .set(authed())
        .expect(200)

      expect(res.body.data.slots.map((s: { start: string }) => s.start)).not.toContain(firstSlotStart)
    })

    it('reads the appointment back with patient/doctor details', async () => {
      const res = await request(server)
        .get(`/api/v1/appointments/${firstAppointmentId}`)
        .set(authed())
        .expect(200)

      expect(res.body.data.patient.fullName).toBe('Vikram Nair')
      expect(res.body.data.doctor.fullName).toBe('Priya Sharma')
    })

    describe('status transitions', () => {
      it('walks the full state machine to completion', async () => {
        await request(server)
          .patch(`/api/v1/appointments/${firstAppointmentId}/status`)
          .set(authed())
          .send({ status: 'CONFIRMED' })
          .expect(200)
          .expect((res) => expect(res.body.data.status).toBe('CONFIRMED'))

        await request(server)
          .patch(`/api/v1/appointments/${firstAppointmentId}/status`)
          .set(authed())
          .send({ status: 'ARRIVED' })
          .expect(200)

        await request(server)
          .patch(`/api/v1/appointments/${firstAppointmentId}/status`)
          .set(authed())
          .send({ status: 'IN_CONSULTATION' })
          .expect(200)

        await request(server)
          .patch(`/api/v1/appointments/${firstAppointmentId}/status`)
          .set(authed())
          .send({ status: 'COMPLETED' })
          .expect(200)
          .expect((res) => expect(res.body.data.status).toBe('COMPLETED'))
      })

      it('rejects any further transition once completed', async () => {
        await request(server)
          .patch(`/api/v1/appointments/${firstAppointmentId}/status`)
          .set(authed())
          .send({ status: 'CANCELLED' })
          .expect(400)
      })

      it('rejects an invalid jump (SCHEDULED -> IN_CONSULTATION)', async () => {
        const slotsRes = await request(server)
          .get(`/api/v1/appointments/available-slots?doctorId=${doctorId}&date=${APPOINTMENT_DATE}&duration=15`)
          .set(authed())
          .expect(200)
        const bookRes = await request(server)
          .post('/api/v1/appointments')
          .set(authed())
          .send({
            patientId,
            doctorId,
            scheduledAt: new Date(slotsRes.body.data.slots[0].start).toISOString(),
            durationMinutes: 15,
            type: 'OPD',
          })
          .expect(201)

        await request(server)
          .patch(`/api/v1/appointments/${bookRes.body.data.id}/status`)
          .set(authed())
          .send({ status: 'IN_CONSULTATION' })
          .expect(400)
      })
    })
  })

  describe('own-scope enforcement for doctors', () => {
    let ownAppointmentId: string
    let otherDoctorAppointmentId: string

    beforeAll(async () => {
      const ownSlots = await request(server)
        .get(`/api/v1/appointments/available-slots?doctorId=${doctorId}&date=2026-09-01&duration=15`)
        .set(authed())
        .expect(200)
      const ownRes = await request(server)
        .post('/api/v1/appointments')
        .set(authed())
        .send({
          patientId,
          doctorId,
          scheduledAt: new Date(ownSlots.body.data.slots[0].start).toISOString(),
          durationMinutes: 15,
          type: 'OPD',
        })
        .expect(201)
      ownAppointmentId = ownRes.body.data.id

      const otherSlots = await request(server)
        .get(`/api/v1/appointments/available-slots?doctorId=${secondDoctorId}&date=2026-09-01&duration=15`)
        .set(authed())
        .expect(200)
      const otherRes = await request(server)
        .post('/api/v1/appointments')
        .set(authed())
        .send({
          patientId,
          doctorId: secondDoctorId,
          scheduledAt: new Date(otherSlots.body.data.slots[0].start).toISOString(),
          durationMinutes: 15,
          type: 'OPD',
        })
        .expect(201)
      otherDoctorAppointmentId = otherRes.body.data.id
    })

    it('lets a doctor transition their own appointment', async () => {
      await request(server)
        .patch(`/api/v1/appointments/${ownAppointmentId}/status`)
        .set(authedAs(doctorToken))
        .send({ status: 'CONFIRMED' })
        .expect(200)
    })

    it("rejects a doctor transitioning another doctor's appointment", async () => {
      await request(server)
        .patch(`/api/v1/appointments/${otherDoctorAppointmentId}/status`)
        .set(authedAs(doctorToken))
        .send({ status: 'CONFIRMED' })
        .expect(403)
    })
  })

  describe('walk-in booking', () => {
    let allHoursDoctorId: string
    let walkInHospitalId: string

    beforeAll(async () => {
      const hospitalRes = await request(server)
        .post('/api/v1/hospitals')
        .set(authed())
        .send({ name: 'E2E Walk-in Hospital', code: `E2EWI${unique}`.slice(0, 10) })
        .expect(201)
      walkInHospitalId = hospitalRes.body.data.id

      // A schedule covering the entire day, every day, so "now" (whatever
      // real wall-clock time this suite happens to run at) always falls
      // within a bookable shift — deterministic without needing to mock
      // `Date` across a full Nest DI graph in an e2e context.
      const doctorRes = await request(server)
        .post('/api/v1/doctors')
        .set(authed())
        .send({
          email: `e2e-appts-walkin-doctor-${unique}@example.com`,
          firstName: 'Ravi',
          lastName: 'Kumar',
          registrationNumber: `MCI-APPT-WALKIN-${unique}`,
          specialization: 'General Medicine',
          qualification: 'MBBS',
          experienceYears: 5,
          languagesSpoken: ['English'],
          consultationFee: 300,
          joiningDate: '2020-01-01',
          hospitalId: walkInHospitalId,
        })
        .expect(201)
      allHoursDoctorId = doctorRes.body.data.id

      await request(server)
        .post(`/api/v1/doctors/${allHoursDoctorId}/schedule`)
        .set(authed())
        .send({
          effectiveFrom: '2020-01-01',
          days: ALL_WEEKDAYS.map((dayOfWeek) => ({
            dayOfWeek,
            isWorkingDay: true,
            shifts: [{ startTime: '00:00', endTime: '23:45', slotDurationMinutes: 15, breaks: [] }],
          })),
        })
        .expect(201)
    })

    it('books the next available slot today, marked as a walk-in', async () => {
      const res = await request(server)
        .post('/api/v1/appointments/walk-in')
        .set(authed())
        .send({ patientId, doctorId: allHoursDoctorId, type: 'OPD', chiefComplaint: 'Fever' })
        .expect(201)

      expect(res.body.data.isWalkIn).toBe(true)
      expect(new Date(res.body.data.scheduledAt).getTime()).toBeGreaterThanOrEqual(Date.now() - 15 * 60_000)
    })

    it('rejects a walk-in for a doctor with no schedule at all', async () => {
      const noScheduleDoctorRes = await request(server)
        .post('/api/v1/doctors')
        .set(authed())
        .send({
          email: `e2e-appts-noschedule-doctor-${unique}@example.com`,
          firstName: 'No',
          lastName: 'Schedule',
          registrationNumber: `MCI-APPT-NOSCHED-${unique}`,
          specialization: 'General Medicine',
          qualification: 'MBBS',
          experienceYears: 5,
          languagesSpoken: ['English'],
          consultationFee: 300,
          joiningDate: '2020-01-01',
          hospitalId: walkInHospitalId,
        })
        .expect(201)

      await request(server)
        .post('/api/v1/appointments/walk-in')
        .set(authed())
        .send({ patientId, doctorId: noScheduleDoctorRes.body.data.id, type: 'OPD' })
        .expect(409)
    })
  })

  describe('recurring booking', () => {
    it('books every occurrence and reports none failed when nothing conflicts', async () => {
      const res = await request(server)
        .post('/api/v1/appointments/recurring')
        .set(authed())
        .send({
          patientId,
          doctorId,
          startDate: '2026-10-06', // a Tuesday, well clear of this suite's other bookings
          time: '10:00',
          frequency: 'WEEKLY',
          occurrences: 3,
          durationMinutes: 15,
          type: 'OPD',
        })
        .expect(201)

      expect(res.body.data.booked).toHaveLength(3)
      expect(res.body.data.failed).toHaveLength(0)
      const groupIds = new Set(res.body.data.booked.map((a: { recurrenceGroupId: string }) => a.recurrenceGroupId))
      expect(groupIds.size).toBe(1)
    })

    it('reports a conflicting occurrence as failed without aborting the rest', async () => {
      // Book a single appointment that collides with the 2nd of 3 weekly occurrences.
      await request(server)
        .post('/api/v1/appointments')
        .set(authed())
        .send({ patientId, doctorId, scheduledAt: new Date('2026-11-10T11:00:00').toISOString(), durationMinutes: 15, type: 'OPD' })
        .expect(201)

      const res = await request(server)
        .post('/api/v1/appointments/recurring')
        .set(authed())
        .send({
          patientId,
          doctorId,
          startDate: '2026-11-03', // Tuesday; +7d = 2026-11-10 (the collision above)
          time: '11:00',
          frequency: 'WEEKLY',
          occurrences: 3,
          durationMinutes: 15,
          type: 'OPD',
        })
        .expect(201)

      expect(res.body.data.booked).toHaveLength(2)
      expect(res.body.data.failed).toHaveLength(1)
      expect(res.body.data.failed[0].scheduledAt).toContain('2026-11-10')
    })
  })

  it('rejects appointment routes without a bearer token', async () => {
    await request(server).get('/api/v1/appointments').expect(401)
  })
})
