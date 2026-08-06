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

const ALL_WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']

describe('Insurance (e2e)', () => {
  let app: NestFastifyApplication
  let server: Parameters<typeof request>[0]
  let adminToken: string
  let cashierToken: string
  let doctorId: string

  const unique = Date.now()
  const adminEmail = `e2e-insurance-admin-${unique}@example.com`
  const orgSlug = `e2e-insurance-org-${unique}`
  const doctorEmail = `e2e-insurance-doctor-${unique}@example.com`
  const cashierEmail = `e2e-insurance-cashier-${unique}@example.com`
  const cashierPassword = 'Passw0rd123'

  function authedAs(token: string) {
    return { Authorization: `Bearer ${token}` }
  }
  function authed() {
    return authedAs(adminToken)
  }

  let patientCounter = 0

  async function createPatient() {
    patientCounter += 1
    const res = await request(server)
      .post('/api/v1/patients')
      .set(authed())
      .send({
        firstName: 'Coverage',
        lastName: `Patient${patientCounter}`,
        phone: `9${String(Date.now()).slice(-9)}${patientCounter}`.slice(0, 10),
        dateOfBirth: '1990-05-15',
        gender: 'FEMALE',
      })
      .expect(201)
    return res.body.data.id as string
  }

  async function createEncounter(forPatientId: string) {
    const res = await request(server)
      .post('/api/v1/encounters')
      .set(authed())
      .send({ patientId: forPatientId, doctorId, type: 'OPD' })
      .expect(201)
    return res.body.data
  }

  async function createInvoice(forPatientId: string, encounterId: string) {
    const res = await request(server)
      .post('/api/v1/billing/invoices')
      .set(authed())
      .send({
        patientId: forPatientId,
        encounterId,
        type: 'OPD',
        items: [{ itemName: 'Consultation', category: 'Consultation', quantity: 1, unitPrice: 1000, discountPercent: 0, taxPercent: 0 }],
      })
      .expect(201)
    return res.body.data
  }

  async function createProvider() {
    const res = await request(server)
      .post('/api/v1/insurance/providers')
      .set(authed())
      .send({ name: 'Star Health', code: `STAR-${Date.now()}-${Math.floor(Math.random() * 100000)}`, type: 'INSURANCE_COMPANY' })
      .expect(201)
    return res.body.data
  }

  async function createPlan(providerId: string, overrides: Partial<Record<string, unknown>> = {}) {
    const res = await request(server)
      .post('/api/v1/insurance/plans')
      .set(authed())
      .send({
        providerId,
        name: 'Gold Plan',
        code: `GOLD-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        coveragePercent: 80,
        coPayPercent: 20,
        deductible: 500,
        networkType: 'CASHLESS',
        ...overrides,
      })
      .expect(201)
    return res.body.data
  }

  async function createCoverage(forPatientId: string, providerId: string, planId: string, token = adminToken) {
    const res = await request(server)
      .post(`/api/v1/insurance/patients/${forPatientId}/coverages`)
      .set(authedAs(token))
      .send({
        providerId,
        planId,
        type: 'PRIMARY',
        memberId: `MEM-${Date.now()}`,
        policyNumber: `POL-${Date.now()}`,
        effectiveDate: '2026-01-01',
      })
      .expect(201)
    return res.body.data
  }

  /** A fresh patient + provider + plan + coverage + encounter + invoice - every claim/pre-auth test gets its own patient so the "one active primary" rule never collides across tests. */
  async function createClaimFixture(token = adminToken) {
    const forPatientId = await createPatient()
    const provider = await createProvider()
    const plan = await createPlan(provider.id)
    const coverage = await createCoverage(forPatientId, provider.id, plan.id, token)
    const encounter = await createEncounter(forPatientId)
    const invoice = await createInvoice(forPatientId, encounter.id)
    return { patientId: forPatientId, coverage, encounter, invoice }
  }

  async function createClaim(overrides: Partial<Record<string, unknown>> = {}) {
    const { coverage, encounter, invoice } = await createClaimFixture()
    const res = await request(server)
      .post('/api/v1/insurance/claims')
      .set(authed())
      .send({ encounterId: encounter.id, invoiceId: invoice.id, patientInsuranceId: coverage.id, claimedAmount: 1000, ...overrides })
      .expect(201)
    return res.body.data
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
      { resource: 'medical_records', action: 'create', scope: 'all' },
      { resource: 'billing', action: 'read', scope: 'all' },
      { resource: 'billing', action: 'create', scope: 'all' },
      { resource: 'billing', action: 'update', scope: 'all' },
      { resource: 'insurance.providers', action: 'read', scope: 'all' },
      { resource: 'insurance.providers', action: 'create', scope: 'all' },
      { resource: 'insurance.providers', action: 'update', scope: 'all' },
      { resource: 'insurance.plans', action: 'read', scope: 'all' },
      { resource: 'insurance.plans', action: 'create', scope: 'all' },
      { resource: 'insurance.plans', action: 'update', scope: 'all' },
      { resource: 'insurance.claims', action: 'read', scope: 'all' },
      { resource: 'insurance.claims', action: 'create', scope: 'all' },
      { resource: 'insurance.claims', action: 'update', scope: 'all' },
      { resource: 'insurance.preauth', action: 'read', scope: 'all' },
      { resource: 'insurance.preauth', action: 'create', scope: 'all' },
      { resource: 'insurance.preauth', action: 'update', scope: 'all' },
      { resource: 'insurance.settlement', action: 'read', scope: 'all' },
      { resource: 'insurance.settlement', action: 'manage', scope: 'all' },
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
        organizationName: 'E2E Insurance Org',
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
      .send({ name: 'E2E Insurance Hospital', code: `E2EINS${unique}`.slice(0, 10) })
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
        registrationNumber: `MCI-INS-${unique}`,
        specialization: 'General Medicine',
        qualification: 'MBBS',
        experienceYears: 6,
        languagesSpoken: ['English'],
        consultationFee: 800,
        joiningDate: '2020-01-01',
        hospitalId,
        departmentId,
      })
      .expect(201)
    doctorId = doctorRes.body.data.id

    await request(server)
      .post(`/api/v1/doctors/${doctorId}/schedule`)
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

    // A cashier-like role with claims/preauth read+create+update and
    // settlement READ only (not manage) - mirrors the demo seed's Cashier
    // exactly, exercising the "requester can't approve settlement" split.
    const cashierRole = await prisma.role.create({
      data: { name: 'E2E Insurance Cashier', systemRole: 'CASHIER', organizationId: org.id, description: 'Cashier role' },
    })
    const cashierPerms = await prisma.permission.findMany({
      where: {
        scope: 'all',
        OR: [
          { resource: 'insurance.providers', action: 'read' },
          { resource: 'insurance.plans', action: 'read' },
          { resource: 'insurance.claims', action: 'read' },
          { resource: 'insurance.claims', action: 'create' },
          { resource: 'insurance.claims', action: 'update' },
          { resource: 'insurance.preauth', action: 'read' },
          { resource: 'insurance.preauth', action: 'create' },
          { resource: 'insurance.preauth', action: 'update' },
          { resource: 'insurance.settlement', action: 'read' },
        ],
      },
    })
    await prisma.rolePermission.createMany({
      data: cashierPerms.map((p) => ({ roleId: cashierRole.id, permissionId: p.id })),
    })
    const cashierPasswordHash = await argon2.hash(cashierPassword)
    await prisma.user.create({
      data: {
        email: cashierEmail,
        passwordHash: cashierPasswordHash,
        firstName: 'Sunita',
        lastName: 'Rao',
        status: 'ACTIVE',
        isEmailVerified: true,
        organizationId: org.id,
        userRoles: { create: [{ roleId: cashierRole.id }] },
      },
    })
    const cashierLoginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: cashierEmail, password: cashierPassword })
      .expect(200)
    cashierToken = cashierLoginRes.body.data.accessToken
  }, 30_000)

  afterAll(async () => {
    await app.close()
  })

  describe('providers', () => {
    it('creates, lists, and updates a provider', async () => {
      const provider = await createProvider()
      expect(provider.name).toBe('Star Health')

      const listRes = await request(server).get('/api/v1/insurance/providers').set(authed()).expect(200)
      expect(listRes.body.data.data.some((p: { id: string }) => p.id === provider.id)).toBe(true)

      const updateRes = await request(server)
        .patch(`/api/v1/insurance/providers/${provider.id}`)
        .set(authed())
        .send({ isActive: false })
        .expect(200)
      expect(updateRes.body.data.isActive).toBe(false)
    })

    it('rejects a duplicate provider code', async () => {
      const provider = await createProvider()
      await request(server)
        .post('/api/v1/insurance/providers')
        .set(authed())
        .send({ name: 'Dup', code: provider.code, type: 'INSURANCE_COMPANY' })
        .expect(409)
    })
  })

  describe('plans', () => {
    it('creates a plan under a provider with coverage terms', async () => {
      const provider = await createProvider()
      const plan = await createPlan(provider.id, { coveragePercent: 90, coPayPercent: 10, deductible: 0 })
      expect(plan.coveragePercent).toBe('90')
      expect(plan.provider.id).toBe(provider.id)
    })
  })

  describe('patient coverage', () => {
    it('adds a coverage record for a patient and rejects a second active primary', async () => {
      const forPatientId = await createPatient()
      const provider = await createProvider()
      const plan = await createPlan(provider.id)
      const coverage = await createCoverage(forPatientId, provider.id, plan.id)
      expect(coverage.status).toBe('ACTIVE')

      await request(server)
        .post(`/api/v1/insurance/patients/${forPatientId}/coverages`)
        .set(authed())
        .send({
          providerId: provider.id,
          planId: plan.id,
          type: 'PRIMARY',
          memberId: 'MEM-2',
          policyNumber: 'POL-2',
          effectiveDate: '2026-01-01',
        })
        .expect(409)
    })
  })

  describe('pre-authorization workflow', () => {
    it('walks Draft -> Submitted -> Under Review -> Approved', async () => {
      const { coverage, encounter } = await createClaimFixture()

      const createRes = await request(server)
        .post('/api/v1/insurance/preauth')
        .set(authed())
        .send({ encounterId: encounter.id, patientInsuranceId: coverage.id, requestedAmount: 5000 })
        .expect(201)
      const preAuthId = createRes.body.data.id
      expect(createRes.body.data.status).toBe('DRAFT')

      await request(server).post(`/api/v1/insurance/preauth/${preAuthId}/submit`).set(authed()).expect(201)
      await request(server).post(`/api/v1/insurance/preauth/${preAuthId}/review`).set(authed()).expect(201)

      const decideRes = await request(server)
        .post(`/api/v1/insurance/preauth/${preAuthId}/decide`)
        .set(authed())
        .send({ status: 'APPROVED', approvedAmount: 4500 })
        .expect(201)
      expect(decideRes.body.data.status).toBe('APPROVED')
      expect(decideRes.body.data.approvedAmount).toBe('4500')
    })
  })

  describe('claims workflow', () => {
    it('files a claim with auto-attached documents', async () => {
      const claim = await createClaim()
      expect(claim.status).toBe('DRAFT')
      expect(claim.claimNumber).toMatch(/^CLM-/)
      expect(claim.documents.some((d: { type: string; autoAttached: boolean }) => d.type === 'INVOICE' && d.autoAttached)).toBe(
        true,
      )
    })

    it('rejects filing a second claim against the same invoice', async () => {
      const { coverage, encounter, invoice } = await createClaimFixture()

      await request(server)
        .post('/api/v1/insurance/claims')
        .set(authed())
        .send({ encounterId: encounter.id, invoiceId: invoice.id, patientInsuranceId: coverage.id, claimedAmount: 1000 })
        .expect(201)

      await request(server)
        .post('/api/v1/insurance/claims')
        .set(authed())
        .send({ encounterId: encounter.id, invoiceId: invoice.id, patientInsuranceId: coverage.id, claimedAmount: 1000 })
        .expect(409)
    })

    it('walks Draft -> Submitted -> Under Review -> Approved -> Settled and records a payment', async () => {
      const claim = await createClaim()

      await request(server).post(`/api/v1/insurance/claims/${claim.id}/submit`).set(authed()).expect(201)
      await request(server).post(`/api/v1/insurance/claims/${claim.id}/review`).set(authed()).expect(201)

      const decideRes = await request(server)
        .post(`/api/v1/insurance/claims/${claim.id}/decide`)
        .set(authed())
        .send({ status: 'APPROVED', approvedAmount: 800 })
        .expect(201)
      expect(decideRes.body.data.status).toBe('APPROVED')

      // A payment (including the insurance-recorded settlement payment) can
      // only be posted against a finalized invoice - see PaymentsService.
      await request(server).patch(`/api/v1/billing/invoices/${claim.invoiceId}/finalize`).set(authed()).expect(200)

      const settleRes = await request(server)
        .post(`/api/v1/insurance/claims/${claim.id}/settle`)
        .set(authed())
        .send({ insuranceShare: 800, patientShare: 200, adjustmentAmount: 0, writeOffAmount: 0 })
        .expect(201)
      expect(settleRes.body.data.status).toBe('SETTLED')
      expect(settleRes.body.data.paymentStatus).toBe('PAID')

      const invoiceRes = await request(server).get(`/api/v1/billing/invoices/${claim.invoiceId}`).set(authed()).expect(200)
      expect(invoiceRes.body.data.payments.some((p: { paymentMode: string; amount: string }) => p.paymentMode === 'INSURANCE' && p.amount === '800')).toBe(
        true,
      )

      const closeRes = await request(server).post(`/api/v1/insurance/claims/${claim.id}/close`).set(authed()).send({}).expect(201)
      expect(closeRes.body.data.status).toBe('CLOSED')
    })

    it('rejects an out-of-order transition (settle before approval)', async () => {
      const claim = await createClaim()
      await request(server)
        .post(`/api/v1/insurance/claims/${claim.id}/settle`)
        .set(authed())
        .send({ insuranceShare: 800, patientShare: 200, adjustmentAmount: 0, writeOffAmount: 0 })
        .expect(409)
    })

    it("lets the cashier file and update a claim but not settle it (requires insurance.settlement.manage)", async () => {
      const forPatientId = await createPatient()
      const provider = await createProvider()
      const plan = await createPlan(provider.id)
      const coverage = await createCoverage(forPatientId, provider.id, plan.id, cashierToken)
      const encounter = await createEncounter(forPatientId)
      const invoice = await createInvoice(forPatientId, encounter.id)

      const createRes = await request(server)
        .post('/api/v1/insurance/claims')
        .set(authedAs(cashierToken))
        .send({ encounterId: encounter.id, invoiceId: invoice.id, patientInsuranceId: coverage.id, claimedAmount: 1000 })
        .expect(201)
      const claimId = createRes.body.data.id

      await request(server).post(`/api/v1/insurance/claims/${claimId}/submit`).set(authedAs(cashierToken)).expect(201)
      await request(server).post(`/api/v1/insurance/claims/${claimId}/review`).set(authedAs(cashierToken)).expect(201)
      await request(server)
        .post(`/api/v1/insurance/claims/${claimId}/decide`)
        .set(authedAs(cashierToken))
        .send({ status: 'APPROVED', approvedAmount: 800 })
        .expect(201)

      await request(server)
        .post(`/api/v1/insurance/claims/${claimId}/settle`)
        .set(authedAs(cashierToken))
        .send({ insuranceShare: 800, patientShare: 200, adjustmentAmount: 0, writeOffAmount: 0 })
        .expect(403)
    })
  })

  describe('dashboard', () => {
    it('returns aggregate insurance stats', async () => {
      await createClaim()
      const res = await request(server).get('/api/v1/insurance/dashboard-stats').set(authed()).expect(200)
      expect(res.body.data.todaysClaims).toBeGreaterThan(0)
    })
  })
})
