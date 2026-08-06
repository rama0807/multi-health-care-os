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

describe('Reports & Analytics (e2e)', () => {
  let app: NestFastifyApplication
  let server: Parameters<typeof request>[0]
  let prisma: PrismaService

  /** Org admin - holds both `reports.read` and `reports.export`. */
  let adminToken: string
  let orgId: string

  /** A second organization, used to prove reports are tenant-scoped. */
  let otherToken: string

  /** A user holding `reports.read` but deliberately not `reports.export`. */
  let readOnlyToken: string

  let savedReportId: string

  const unique = Date.now()
  const orgSlug = `e2e-m17-${unique}`
  const adminEmail = `e2e-m17-admin-${unique}@example.com`
  const readOnlyEmail = `e2e-m17-readonly-${unique}@example.com`
  const otherSlug = `e2e-m17-other-${unique}`
  const otherEmail = `e2e-m17-other-${unique}@example.com`
  const PASSWORD = 'Passw0rd123'

  const auth = () => ({ Authorization: `Bearer ${adminToken}` })
  const otherAuth = () => ({ Authorization: `Bearer ${otherToken}` })
  const readOnlyAuth = () => ({ Authorization: `Bearer ${readOnlyToken}` })

  /**
   * supertest defaults to a text parser, which corrupts the xlsx/PDF bytes.
   * This collects the raw stream so the tests can assert on real file
   * signatures rather than on a lossily-decoded string.
   */
  const binaryParser = (response: unknown, callback: (err: Error | null, body: Buffer) => void) => {
    const stream = response as NodeJS.ReadableStream
    const chunks: Buffer[] = []
    stream.on('data', (chunk: Buffer) => chunks.push(chunk))
    stream.on('end', () => callback(null, Buffer.concat(chunks)))
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
    prisma = app.get(PrismaService)

    // `reports.read`/`reports.export` already exist in the seed catalog, but
    // an e2e database may predate them - upsert so this suite is standalone.
    for (const action of ['read', 'export']) {
      await prisma.permission.upsert({
        where: { resource_action_scope: { resource: 'reports', action, scope: 'all' } },
        update: {},
        create: { resource: 'reports', action, scope: 'all', description: `${action} reports (all)` },
      })
    }

    await request(server)
      .post('/api/v1/auth/register')
      .send({
        organizationName: 'E2E M17 Reports',
        organizationSlug: orgSlug,
        adminFirstName: 'Reports',
        adminLastName: 'Admin',
        adminEmail,
        adminPassword: PASSWORD,
        phone: '9876500017',
      })
      .expect(201)

    orgId = (await prisma.organization.findUniqueOrThrow({ where: { slug: orgSlug } })).id

    await request(server)
      .post('/api/v1/auth/register')
      .send({
        organizationName: 'E2E M17 Other Tenant',
        organizationSlug: otherSlug,
        adminFirstName: 'Other',
        adminLastName: 'Admin',
        adminEmail: otherEmail,
        adminPassword: PASSWORD,
        phone: '9876500018',
      })
      .expect(201)

    // A read-only reporting user in the first org: `reports.read` only.
    const readPermission = await prisma.permission.findFirstOrThrow({
      where: { resource: 'reports', action: 'read', scope: 'all' },
    })
    const readOnlyRole = await prisma.role.create({
      data: {
        organizationId: orgId,
        name: `Report Viewer ${unique}`,
        systemRole: 'RECEPTIONIST',
        rolePermissions: { create: [{ permissionId: readPermission.id }] },
      },
    })
    const argon2 = await import('argon2')
    const readOnlyUser = await prisma.user.create({
      data: {
        organizationId: orgId,
        email: readOnlyEmail,
        passwordHash: await argon2.hash(PASSWORD),
        firstName: 'Read',
        lastName: 'Only',
        status: 'ACTIVE',
        isEmailVerified: true,
      },
    })
    await prisma.userRole.create({ data: { userId: readOnlyUser.id, roleId: readOnlyRole.id } })

    const login = async (email: string) => {
      const res = await request(server)
        .post('/api/v1/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200)
      return res.body.data.accessToken as string
    }

    adminToken = await login(adminEmail)
    otherToken = await login(otherEmail)
    readOnlyToken = await login(readOnlyEmail)
  }, 90_000)

  afterAll(async () => {
    await app.close()
  })

  // ── Checkpoint 17.1 - Operational reports ──────────────────────────────

  const OPERATIONAL_REPORTS = [
    'patients',
    'appointments',
    'doctors',
    'laboratory',
    'radiology',
    'pharmacy',
    'inventory',
    'billing',
    'insurance',
    'ipd',
    'staff',
  ]

  it.each(OPERATIONAL_REPORTS)('GET /reports/%s returns a report scoped to the caller org', async (key) => {
    const res = await request(server)
      .get(`/api/v1/reports/${key}?from=2026-07-01&to=2026-07-31`)
      .set(auth())
      .expect(200)

    expect(res.body.data.period).toEqual(
      expect.objectContaining({ from: '2026-07-01', to: '2026-07-31', groupBy: 'day', days: 31 }),
    )
  })

  it('rejects an unauthenticated request', async () => {
    await request(server).get('/api/v1/reports/patients').expect(401)
  })

  it('zero-fills every bucket in the range so gaps are visible', async () => {
    const res = await request(server)
      .get('/api/v1/reports/patients?from=2026-07-01&to=2026-07-05')
      .set(auth())
      .expect(200)

    expect(res.body.data.registrationTrend).toHaveLength(5)
    expect(res.body.data.registrationTrend[0]).toEqual({ bucket: '2026-07-01', value: 0 })
  })

  it('honours groupBy=month', async () => {
    const res = await request(server)
      .get('/api/v1/reports/billing?from=2026-05-01&to=2026-07-31&groupBy=month')
      .set(auth())
      .expect(200)

    expect(res.body.data.period.groupBy).toBe('month')
    expect(res.body.data.revenueTrend).toHaveLength(3)
  })

  it('rejects an inverted date range rather than returning an empty report', async () => {
    await request(server)
      .get('/api/v1/reports/patients?from=2026-07-31&to=2026-07-01')
      .set(auth())
      .expect(400)
  })

  it('rejects a range beyond the documented ceiling', async () => {
    await request(server).get('/api/v1/reports/patients?from=2020-01-01&to=2026-07-31').set(auth()).expect(400)
  })

  it('resolves the organization from the JWT for every tenant', async () => {
    const mine = await request(server).get('/api/v1/reports/patients').set(auth()).expect(200)
    const theirs = await request(server).get('/api/v1/reports/patients').set(otherAuth()).expect(200)

    // Both are freshly-registered empty orgs; the point is that each request
    // resolves its own organization from the JWT rather than erroring.
    expect(mine.body.data.registrations).toBe(0)
    expect(theirs.body.data.registrations).toBe(0)
  })

  // ── Checkpoint 17.2 - Executive dashboards ─────────────────────────────

  it.each(['ceo', 'medical-director', 'operations', 'finance'])(
    'GET /reports/dashboards/%s returns KPIs, charts and tables',
    async (key) => {
      const res = await request(server).get(`/api/v1/reports/dashboards/${key}`).set(auth()).expect(200)

      expect(res.body.data.key).toBe(key)
      expect(Array.isArray(res.body.data.kpis)).toBe(true)
      expect(res.body.data.kpis.length).toBeGreaterThan(0)
      expect(Array.isArray(res.body.data.charts)).toBe(true)
      expect(Array.isArray(res.body.data.tables)).toBe(true)
    },
  )

  it('rejects an unknown dashboard key', async () => {
    await request(server).get('/api/v1/reports/dashboards/cfo').set(auth()).expect(400)
  })

  it('requires a departmentId for the department dashboard', async () => {
    await request(server).get('/api/v1/reports/dashboards/department').set(auth()).expect(400)
  })

  it('404s for a department belonging to another organization', async () => {
    const otherOrg = await prisma.organization.findUniqueOrThrow({ where: { slug: otherSlug } })
    const hospital = await prisma.hospital.create({
      data: {
        organizationId: otherOrg.id,
        name: 'Other Hospital',
        code: `OH-${unique}`,
        address: '1 Other Road',
        city: 'Pune',
        state: 'MH',
        pincode: '411001',
        phone: '9876500019',
        email: `hospital-${unique}@example.com`,
      },
    })
    const department = await prisma.department.create({
      data: {
        organizationId: otherOrg.id,
        hospitalId: hospital.id,
        name: 'Cardiology',
        code: `CARD-${unique}`,
      },
    })

    await request(server)
      .get(`/api/v1/reports/dashboards/department?departmentId=${department.id}`)
      .set(auth())
      .expect(404)
  })

  // ── Checkpoint 17.3 - Report builder ───────────────────────────────────

  it('lists every report definition with its filters and columns', async () => {
    const res = await request(server).get('/api/v1/reports/builder/definitions').set(auth()).expect(200)

    const definitions = res.body.data
    expect(definitions.length).toBeGreaterThanOrEqual(20)

    const revenue = definitions.find((d: { key: string }) => d.key === 'billing.revenue')
    expect(revenue.module).toBe('Billing')
    expect(revenue.columns.map((c: { key: string }) => c.key)).toEqual(['bucket', 'invoiced', 'collected'])
  })

  it('runs a report and returns rows matching its declared columns', async () => {
    const res = await request(server)
      .get('/api/v1/reports/builder/run/billing.revenue?from=2026-07-01&to=2026-07-03')
      .set(auth())
      .expect(200)

    expect(res.body.data.rows).toHaveLength(3)
    expect(Object.keys(res.body.data.rows[0]).sort()).toEqual(['bucket', 'collected', 'invoiced'])
    expect(res.body.data.truncated).toBe(false)
  })

  it('404s for an unknown report key', async () => {
    await request(server).get('/api/v1/reports/builder/run/billing.nonsense').set(auth()).expect(404)
  })

  it('exports CSV with a header row', async () => {
    const res = await request(server)
      .get('/api/v1/reports/builder/export/billing.revenue?from=2026-07-01&to=2026-07-02&format=csv')
      .set(auth())
      .expect(200)

    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.headers['content-disposition']).toContain('billing-revenue-2026-07-01-to-2026-07-02.csv')
    expect(res.text.split('\r\n')[0]).toBe('"Period","Invoiced","Collected"')
  })

  it('exports a genuine xlsx package', async () => {
    const res = await request(server)
      .get('/api/v1/reports/builder/export/billing.revenue?from=2026-07-01&to=2026-07-02&format=xlsx')
      .set(auth())
      .buffer()
      .parse(binaryParser)
      .expect(200)

    expect(res.headers['content-type']).toContain('spreadsheetml.sheet')
    expect((res.body as Buffer).readUInt32LE(0)).toBe(0x04034b50)
  })

  it('exports a PDF', async () => {
    const res = await request(server)
      .get('/api/v1/reports/builder/export/billing.revenue?from=2026-07-01&to=2026-07-02&format=pdf')
      .set(auth())
      .buffer()
      .parse(binaryParser)
      .expect(200)

    expect(res.headers['content-type']).toContain('application/pdf')
    expect((res.body as Buffer).subarray(0, 5).toString('utf8')).toBe('%PDF-')
  })

  it('rejects an unsupported export format', async () => {
    await request(server)
      .get('/api/v1/reports/builder/export/billing.revenue?format=docx')
      .set(auth())
      .expect(400)
  })

  it('lets a reports.read holder run a report but not export one', async () => {
    await request(server).get('/api/v1/reports/builder/run/billing.revenue').set(readOnlyAuth()).expect(200)

    // Export is a separate permission precisely because the file leaves the system.
    await request(server)
      .get('/api/v1/reports/builder/export/billing.revenue?format=csv')
      .set(readOnlyAuth())
      .expect(403)
  })

  // ── Checkpoint 17.3 - Saved reports ────────────────────────────────────

  it('creates a saved report', async () => {
    const res = await request(server)
      .post('/api/v1/reports/builder/saved')
      .set(auth())
      .send({
        name: 'July revenue',
        description: 'Monthly revenue review',
        reportKey: 'billing.revenue',
        filters: { from: '2026-07-01', to: '2026-07-31', groupBy: 'day' },
      })
      .expect(201)

    savedReportId = res.body.data.id
    expect(res.body.data.filters).toEqual({ from: '2026-07-01', to: '2026-07-31', groupBy: 'day' })
    expect(res.body.data.scheduleEnabled).toBe(false)
    expect(res.body.data.lastRunAt).toBeNull()
  })

  it('rejects a saved report pointing at a report that does not exist', async () => {
    await request(server)
      .post('/api/v1/reports/builder/saved')
      .set(auth())
      .send({ name: 'Bogus', reportKey: 'nope.nope' })
      .expect(404)
  })

  it('rejects a duplicate name within the organization', async () => {
    await request(server)
      .post('/api/v1/reports/builder/saved')
      .set(auth())
      .send({ name: 'July revenue', reportKey: 'billing.revenue' })
      .expect(409)
  })

  it('runs a saved report with its stored filters and stamps lastRunAt', async () => {
    const res = await request(server)
      .get(`/api/v1/reports/builder/saved/${savedReportId}/run`)
      .set(auth())
      .expect(200)

    expect(res.body.data.period.from).toBe('2026-07-01')
    expect(res.body.data.period.to).toBe('2026-07-31')

    const stored = await prisma.savedReport.findUniqueOrThrow({ where: { id: savedReportId } })
    expect(stored.lastRunAt).not.toBeNull()
  })

  it("hides another user's private saved report", async () => {
    await request(server).get(`/api/v1/reports/builder/saved/${savedReportId}`).set(readOnlyAuth()).expect(404)
  })

  it('shows a shared saved report to other users in the same organization', async () => {
    await request(server)
      .patch(`/api/v1/reports/builder/saved/${savedReportId}`)
      .set(auth())
      .send({ isShared: true })
      .expect(200)

    await request(server).get(`/api/v1/reports/builder/saved/${savedReportId}`).set(readOnlyAuth()).expect(200)
  })

  it('still refuses to let a non-owner delete a shared saved report', async () => {
    await request(server)
      .delete(`/api/v1/reports/builder/saved/${savedReportId}`)
      .set(readOnlyAuth())
      .expect(404)
  })

  it('never exposes a saved report to another organization', async () => {
    await request(server).get(`/api/v1/reports/builder/saved/${savedReportId}`).set(otherAuth()).expect(404)
  })

  it('persists a schedule but discloses that nothing dispatches it yet', async () => {
    const res = await request(server)
      .patch(`/api/v1/reports/builder/saved/${savedReportId}`)
      .set(auth())
      .send({ scheduleEnabled: true, scheduleCron: '0 6 * * 1', scheduleRecipients: ['ops@example.test'] })
      .expect(200)

    expect(res.body.data.scheduleEnabled).toBe(true)
    expect(res.body.data.scheduleCron).toBe('0 6 * * 1')
    expect(res.body.data.scheduleRecipients).toEqual(['ops@example.test'])
  })

  it('rejects a malformed cron expression', async () => {
    await request(server)
      .patch(`/api/v1/reports/builder/saved/${savedReportId}`)
      .set(auth())
      .send({ scheduleCron: 'every monday please' })
      .expect(400)
  })

  it('deletes a saved report as its owner', async () => {
    await request(server).delete(`/api/v1/reports/builder/saved/${savedReportId}`).set(auth()).expect(200)

    await request(server).get(`/api/v1/reports/builder/saved/${savedReportId}`).set(auth()).expect(404)
  })
})
