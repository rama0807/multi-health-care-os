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
// The worker stays off so the suite drives `tick()` explicitly — a timer
// firing between a request and its assertion is the classic flaky-suite bug.
process.env.NOTIFICATIONS_WORKER_ENABLED = 'false'

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
import { NotificationSchedulerService } from '../src/modules/notifications/notification-scheduler.service'
// eslint-disable-next-line import/order
import { PrismaService } from '../src/prisma/prisma.service'

describe('Communication & Notification Platform (e2e)', () => {
  let app: NestFastifyApplication
  let server: Parameters<typeof request>[0]
  let prisma: PrismaService
  let scheduler: NotificationSchedulerService

  /** Org admin — holds every `notifications.*` permission. */
  let adminToken: string
  let orgId: string

  /** A second organization, proving notifications are tenant-scoped. */
  let otherToken: string

  /** A user in the first org holding no `notifications.*` permission at all. */
  let plainToken: string
  let plainUserId: string

  const unique = Date.now()
  const orgSlug = `e2e-m18-${unique}`
  const adminEmail = `e2e-m18-admin-${unique}@example.com`
  const plainEmail = `e2e-m18-plain-${unique}@example.com`
  const otherSlug = `e2e-m18-other-${unique}`
  const otherEmail = `e2e-m18-other-${unique}@example.com`
  const PASSWORD = 'Passw0rd123'

  /**
   * Ticks until the queue stops producing work.
   *
   * One tick is **not** enough: `claimDue` drains oldest-first across every
   * tenant, bounded by `NOTIFICATIONS_WORKER_BATCH`, which is correct in
   * production but means a shared e2e database with deliveries left by
   * earlier runs can fill an entire batch before reaching this suite's rows.
   * Looping exercises the real worker rather than special-casing around it.
   */
  const drainQueue = async (maxTicks = 40): Promise<void> => {
    for (let i = 0; i < maxTicks; i += 1) {
      const { dispatched, released } = await scheduler.tick()
      if (dispatched === 0 && released === 0) return
    }
    throw new Error(`Queue still had work after ${maxTicks} ticks`)
  }

  const auth = () => ({ Authorization: `Bearer ${adminToken}` })
  const otherAuth = () => ({ Authorization: `Bearer ${otherToken}` })
  const plainAuth = () => ({ Authorization: `Bearer ${plainToken}` })

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
    scheduler = app.get(NotificationSchedulerService)

    // An e2e database may predate this milestone's permissions — upsert so the
    // suite stands alone, mirroring what `reports.e2e-spec.ts` already does.
    for (const action of ['read', 'send', 'manage']) {
      await prisma.permission.upsert({
        where: { resource_action_scope: { resource: 'notifications', action, scope: 'all' } },
        update: {},
        create: { resource: 'notifications', action, scope: 'all', description: `${action} notifications` },
      })
    }
    for (const action of ['read', 'manage']) {
      await prisma.permission.upsert({
        where: { resource_action_scope: { resource: 'platform.notifications', action, scope: 'all' } },
        update: {},
        create: {
          resource: 'platform.notifications',
          action,
          scope: 'all',
          description: `${action} platform notifications`,
        },
      })
    }

    const register = async (name: string, slug: string, email: string, phone: string) =>
      request(server)
        .post('/api/v1/auth/register')
        .send({
          organizationName: name,
          organizationSlug: slug,
          adminFirstName: 'Notify',
          adminLastName: 'Admin',
          adminEmail: email,
          adminPassword: PASSWORD,
          phone,
        })
        .expect(201)

    await register('E2E M18 Notifications', orgSlug, adminEmail, '9876500018')
    await register('E2E M18 Other Tenant', otherSlug, otherEmail, '9876500019')

    orgId = (await prisma.organization.findUniqueOrThrow({ where: { slug: orgSlug } })).id

    // The org admin role was created before these permissions existed in this
    // database, so top it up — `syncRolePermissions` does the same in the seed.
    const notificationPermissions = await prisma.permission.findMany({
      where: { resource: { in: ['notifications'] } },
    })
    const adminRole = await prisma.role.findFirstOrThrow({
      where: { organizationId: orgId, systemRole: 'ORG_ADMIN' },
    })
    for (const permission of notificationPermissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id } },
        update: {},
        create: { roleId: adminRole.id, permissionId: permission.id },
      })
    }

    // A user with a role that grants nothing — used to prove the inbox needs
    // no permission while the admin console does.
    const argon2 = await import('argon2')
    const plainRole = await prisma.role.create({
      data: { organizationId: orgId, name: `Plain ${unique}`, systemRole: 'NURSE' },
    })
    const plainUser = await prisma.user.create({
      data: {
        organizationId: orgId,
        email: plainEmail,
        passwordHash: await argon2.hash(PASSWORD),
        firstName: 'Plain',
        lastName: 'User',
        status: 'ACTIVE',
        isEmailVerified: true,
      },
    })
    plainUserId = plainUser.id
    await prisma.userRole.create({ data: { userId: plainUser.id, roleId: plainRole.id } })

    const login = async (email: string) => {
      const res = await request(server)
        .post('/api/v1/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200)
      return res.body.data.accessToken as string
    }

    adminToken = await login(adminEmail)
    otherToken = await login(otherEmail)
    plainToken = await login(plainEmail)
  }, 120_000)

  afterAll(async () => {
    await app.close()
  })

  // ── Checkpoint 18.1 — sending & the queue ────────────────────────────────

  let sentNotificationId: string

  it('sends a notification to a role and writes one delivery per channel', async () => {
    const res = await request(server)
      .post('/api/v1/notifications/admin/send')
      .set(auth())
      .send({
        title: 'Ward meeting at 16:00',
        body: 'All nursing staff to the third-floor conference room.',
        category: 'SYSTEM',
        priority: 'NORMAL',
        roleSlugs: ['NURSE'],
      })
      .expect(201)

    expect(res.body.data.created).toBe(1)

    const notification = await prisma.notification.findFirstOrThrow({
      where: { organizationId: orgId, recipientId: plainUserId },
      include: { deliveries: true },
    })
    sentNotificationId = notification.id

    // NORMAL priority defaults to in-app plus push; the in-app record is
    // never optional, since it is what the centre reads.
    expect(notification.deliveries.map((d) => d.channel).sort()).toEqual(['IN_APP', 'PUSH'])
    expect(notification.deliveryStatus).toBe('PENDING')
  })

  it('rejects a send that resolves to nobody rather than silently succeeding', async () => {
    await request(server)
      .post('/api/v1/notifications/admin/send')
      .set(auth())
      .send({ title: 'Nobody', body: 'Nobody', roleSlugs: ['NO_SUCH_ROLE'] })
      .expect(400)
  })

  it('dispatches the queue on a scheduler tick and records per-channel outcomes', async () => {
    await drainQueue()

    const deliveries = await prisma.notificationDelivery.findMany({
      where: { notificationId: sentNotificationId },
    })

    const inApp = deliveries.find((d) => d.channel === 'IN_APP')
    expect(inApp?.status).toBe('SENT')

    // Push has no FCM credential in this environment, so it must record an
    // explicit failure — never a fabricated success.
    const push = deliveries.find((d) => d.channel === 'PUSH')
    expect(push?.status).toBe('FAILED')
    expect(push?.failureReason).toMatch(/not configured|no registered push device/i)

    const notification = await prisma.notification.findUniqueOrThrow({ where: { id: sentNotificationId } })
    expect(notification.deliveryStatus).toBe('PARTIALLY_SENT')
    // Generous timeout: this is the first drain of the run, so on a shared e2e
    // database it also clears whatever earlier runs left queued.
  }, 60_000)

  // ── Checkpoint 18.3 — the notification centre ────────────────────────────

  it('lets any authenticated user read their own centre with no permission', async () => {
    const res = await request(server).get('/api/v1/notifications').set(plainAuth()).expect(200)

    expect(res.body.data.data.length).toBeGreaterThan(0)
    expect(res.body.data.data[0].title).toBe('Ward meeting at 16:00')
  })

  it('never shows one user another user’s notifications', async () => {
    const res = await request(server).get('/api/v1/notifications').set(auth()).expect(200)
    expect(res.body.data.data.every((n: { recipientId: string }) => n.recipientId !== plainUserId)).toBe(true)
  })

  it('reports an unread summary', async () => {
    const res = await request(server).get('/api/v1/notifications/summary').set(plainAuth()).expect(200)
    expect(res.body.data.unread).toBeGreaterThan(0)
    expect(res.body.data.byCategory.length).toBeGreaterThan(0)
  })

  it('marks read, pins, archives and filters', async () => {
    const id = sentNotificationId

    await request(server).post(`/api/v1/notifications/${id}/pin`).set(plainAuth()).expect(201)
    await request(server)
      .post('/api/v1/notifications/read')
      .set(plainAuth())
      .send({ ids: [id] })
      .expect(201)

    const read = await request(server)
      .get('/api/v1/notifications?filter=read')
      .set(plainAuth())
      .expect(200)
    expect(read.body.data.data.map((n: { id: string }) => n.id)).toContain(id)

    const unread = await request(server)
      .get('/api/v1/notifications?filter=unread')
      .set(plainAuth())
      .expect(200)
    expect(unread.body.data.data.map((n: { id: string }) => n.id)).not.toContain(id)

    await request(server).post(`/api/v1/notifications/${id}/archive`).set(plainAuth()).expect(201)

    // "All" is the active inbox: archiving removes it from the default view.
    const all = await request(server).get('/api/v1/notifications').set(plainAuth()).expect(200)
    expect(all.body.data.data.map((n: { id: string }) => n.id)).not.toContain(id)

    const archived = await request(server)
      .get('/api/v1/notifications?filter=archived')
      .set(plainAuth())
      .expect(200)
    expect(archived.body.data.data.map((n: { id: string }) => n.id)).toContain(id)

    await request(server).post(`/api/v1/notifications/${id}/unarchive`).set(plainAuth()).expect(201)
  })

  it('refuses to act on a notification addressed to somebody else', async () => {
    await request(server).post(`/api/v1/notifications/${sentNotificationId}/pin`).set(auth()).expect(404)
  })

  it('searches by title', async () => {
    const res = await request(server)
      .get('/api/v1/notifications?search=Ward%20meeting')
      .set(plainAuth())
      .expect(200)
    expect(res.body.data.data.length).toBeGreaterThan(0)
  })

  // ── Checkpoint 18.5 — preferences ────────────────────────────────────────

  it('returns working defaults for a user who has never set preferences', async () => {
    const res = await request(server).get('/api/v1/notifications/preferences').set(plainAuth()).expect(200)

    // Absence must mean "notifications work", never "notifications are off".
    expect(res.body.data).toMatchObject({
      inAppEnabled: true,
      emailEnabled: true,
      pushEnabled: true,
      quietHoursStart: null,
      updatedAt: null,
    })
  })

  it('saves preferences and applies them at dispatch time', async () => {
    await request(server)
      .patch('/api/v1/notifications/preferences')
      .set(plainAuth())
      .send({
        pushEnabled: false,
        categoryPreferences: { BILLING: { enabled: false } },
      })
      .expect(200)

    await request(server)
      .post('/api/v1/notifications/admin/send')
      .set(auth())
      .send({
        title: 'Invoice run complete',
        body: 'Nightly invoicing finished.',
        category: 'BILLING',
        priority: 'NORMAL',
        roleSlugs: ['NURSE'],
      })
      .expect(201)

    await drainQueue()

    const notification = await prisma.notification.findFirstOrThrow({
      where: { recipientId: plainUserId, title: 'Invoice run complete' },
      include: { deliveries: true },
    })

    // A muted category is SKIPPED, not FAILED — nothing was attempted, so it
    // must not depress the delivery success rate.
    for (const delivery of notification.deliveries) {
      expect(delivery.status).toBe('SKIPPED')
      expect(delivery.failureReason).toMatch(/muted|disabled|preferences/i)
    }
    expect(notification.deliveryStatus).toBe('CANCELLED')
  })

  it('delivers CRITICAL priority despite a muted category and a disabled channel', async () => {
    await request(server)
      .post('/api/v1/notifications/admin/send')
      .set(auth())
      .send({
        title: 'Critical billing alert',
        body: 'Payment gateway reconciliation failed.',
        category: 'BILLING',
        priority: 'CRITICAL',
        roleSlugs: ['NURSE'],
      })
      .expect(201)

    await drainQueue()

    const notification = await prisma.notification.findFirstOrThrow({
      where: { recipientId: plainUserId, title: 'Critical billing alert' },
      include: { deliveries: true },
    })

    const inApp = notification.deliveries.find((d) => d.channel === 'IN_APP')
    expect(inApp?.status).toBe('SENT')
  })

  it('rejects a malformed quiet-hours value', async () => {
    await request(server)
      .patch('/api/v1/notifications/preferences')
      .set(plainAuth())
      .send({ quietHoursStart: '25:99' })
      .expect(400)
  })

  // ── Checkpoint 18.2 — devices ────────────────────────────────────────────

  it('reports honestly that browser push is not configured', async () => {
    const res = await request(server)
      .get('/api/v1/notifications/devices/push-config')
      .set(plainAuth())
      .expect(200)

    expect(res.body.data.configured).toBe(false)
    expect(res.body.data.reason).toMatch(/FCM_/)
    expect(res.body.data.vapidPublicKey).toBeNull()
  })

  it('registers several devices per user and never returns a token', async () => {
    const register = (token: string, deviceName: string) =>
      request(server)
        .post('/api/v1/notifications/devices')
        .set(plainAuth())
        .send({ token, platform: 'WEB', deviceName })
        .expect(201)

    await register(`token-ward-workstation-${unique}`, 'Chrome on Windows')
    await register(`token-personal-laptop-${unique}`, 'Safari on macOS')

    const res = await request(server).get('/api/v1/notifications/devices').set(plainAuth()).expect(200)

    expect(res.body.data).toHaveLength(2)
    for (const device of res.body.data) {
      // A push token is a credential; only its last 8 characters come back.
      expect(device.token).toBeUndefined()
      expect(device.tokenSuffix).toHaveLength(8)
    }
  })

  it('re-points an existing token instead of duplicating the device', async () => {
    const token = `token-ward-workstation-${unique}`
    await request(server)
      .post('/api/v1/notifications/devices')
      .set(plainAuth())
      .send({ token, platform: 'WEB', deviceName: 'Chrome on Windows (renamed)' })
      .expect(201)

    const devices = await prisma.userDevice.findMany({ where: { token } })
    expect(devices).toHaveLength(1)
    expect(devices[0].deviceName).toBe('Chrome on Windows (renamed)')
  })

  it('deactivates a device without deleting its delivery history', async () => {
    const list = await request(server).get('/api/v1/notifications/devices').set(plainAuth()).expect(200)
    const device = list.body.data[0]

    await request(server).delete(`/api/v1/notifications/devices/${device.id}`).set(plainAuth()).expect(200)

    const row = await prisma.userDevice.findUniqueOrThrow({ where: { id: device.id } })
    expect(row.isActive).toBe(false)
    expect(row.deactivatedAt).not.toBeNull()
  })

  // ── Checkpoint 18.6 — admin console ──────────────────────────────────────

  it('denies the org-wide console to a user without notifications.read', async () => {
    await request(server).get('/api/v1/notifications/admin/history').set(plainAuth()).expect(403)
    await request(server).get('/api/v1/notifications/admin/stats').set(plainAuth()).expect(403)
    await request(server)
      .post('/api/v1/notifications/admin/send')
      .set(plainAuth())
      .send({ title: 'x', body: 'y', roleSlugs: ['NURSE'] })
      .expect(403)
  })

  it('returns org-scoped history and never another tenant’s', async () => {
    const mine = await request(server)
      .get('/api/v1/notifications/admin/history')
      .set(auth())
      .expect(200)
    expect(mine.body.data.data.length).toBeGreaterThan(0)

    const theirs = await request(server)
      .get('/api/v1/notifications/admin/history')
      .set(otherAuth())
      .expect(200)
    expect(theirs.body.data.data).toHaveLength(0)
  })

  it('reports delivery statistics, treating a rate over zero attempts as not measured', async () => {
    const res = await request(server).get('/api/v1/notifications/admin/stats').set(auth()).expect(200)

    expect(res.body.data.total).toBeGreaterThan(0)
    expect(res.body.data.byChannel.length).toBe(5)

    const whatsapp = res.body.data.byChannel.find(
      (row: { channel: string }) => row.channel === 'WHATSAPP',
    )
    expect(whatsapp.attempted).toBe(0)
    // Never a misleading `0.00` — nothing was attempted on this channel.
    expect(whatsapp.successRate).toBeNull()
  })

  it('reports queue status including that the worker is switched off', async () => {
    const res = await request(server).get('/api/v1/notifications/admin/queue').set(auth()).expect(200)
    expect(res.body.data.workerEnabled).toBe(false)
    expect(res.body.data.workerDisabledReason).toContain('NOTIFICATIONS_WORKER_ENABLED')
  })

  it('lists failed deliveries and re-queues them without resetting attempts', async () => {
    const failed = await request(server)
      .get('/api/v1/notifications/admin/history?failedOnly=true')
      .set(auth())
      .expect(200)
    expect(failed.body.data.data.length).toBeGreaterThan(0)

    const before = await prisma.notificationDelivery.findMany({
      where: { organizationId: orgId, status: 'FAILED' },
    })
    expect(before.length).toBeGreaterThan(0)

    const res = await request(server)
      .post('/api/v1/notifications/admin/retry')
      .set(auth())
      .send({})
      .expect(201)
    expect(res.body.data.requeued).toBe(before.length)

    const after = await prisma.notificationDelivery.findMany({
      where: { id: { in: before.map((d) => d.id) } },
    })
    for (const delivery of after) {
      expect(delivery.status).toBe('QUEUED')
      const original = before.find((d) => d.id === delivery.id)
      // Attempts survive a retry so a permanently broken destination cannot
      // loop forever, and an operator can see it has been tried repeatedly.
      expect(delivery.attempts).toBe(original?.attempts)
    }
  })

  it('lists every bundled template even before an organization overrides one', async () => {
    const res = await request(server).get('/api/v1/notifications/admin/templates').set(auth()).expect(200)

    expect(res.body.data.length).toBeGreaterThan(0)
    expect(res.body.data.every((t: { isDefault: boolean }) => t.isDefault)).toBe(true)
  })

  it('versions a template override append-only and can roll back to the default', async () => {
    const create = () =>
      request(server)
        .post('/api/v1/notifications/admin/templates')
        .set(auth())
        .send({
          key: 'LAB_RESULT_READY',
          channel: 'IN_APP',
          name: 'Lab report ready',
          category: 'LABORATORY',
          priority: 'HIGH',
          subjectTemplate: 'Results for {{patientName}}',
          bodyTemplate: 'The {{testName}} report is ready.',
          isActive: true,
        })
        .expect(201)

    const first = await create()
    expect(first.body.data.version).toBe(1)

    const second = await create()
    // Editing never overwrites — the previous wording stays recoverable.
    expect(second.body.data.version).toBe(2)

    const versions = await request(server)
      .get('/api/v1/notifications/admin/templates/LAB_RESULT_READY/IN_APP/versions')
      .set(auth())
      .expect(200)
    expect(versions.body.data).toHaveLength(2)

    const preview = await request(server)
      .post('/api/v1/notifications/admin/templates/preview')
      .set(auth())
      .send({
        key: 'LAB_RESULT_READY',
        channel: 'IN_APP',
        variables: { patientName: 'Asha Rao', testName: 'CBC' },
      })
      .expect(201)
    expect(preview.body.data.subject).toBe('Results for Asha Rao')

    // Deactivating every override reverts to the bundled default.
    await request(server)
      .post(`/api/v1/notifications/admin/templates/${second.body.data.id}/deactivate`)
      .set(auth())
      .expect(201)
    await request(server)
      .post(`/api/v1/notifications/admin/templates/${first.body.data.id}/deactivate`)
      .set(auth())
      .expect(201)

    const reverted = await request(server)
      .post('/api/v1/notifications/admin/templates/preview')
      .set(auth())
      .send({
        key: 'LAB_RESULT_READY',
        channel: 'IN_APP',
        variables: { patientName: 'Asha Rao', testName: 'CBC' },
      })
      .expect(201)
    expect(reverted.body.data.subject).toBe('Lab report ready — CBC')
  })

  it('renders a missing template variable as a gap, never as raw braces', async () => {
    const res = await request(server)
      .post('/api/v1/notifications/admin/templates/preview')
      .set(auth())
      .send({ key: 'LAB_RESULT_READY', channel: 'IN_APP', variables: { testName: 'CBC' } })
      .expect(201)

    expect(res.body.data.body).not.toContain('{{')
    expect(res.body.data.missingVariables).toContain('patientName')
  })

  // ── Scheduling ───────────────────────────────────────────────────────────

  it('holds a scheduled notification out of the recipient’s centre until due', async () => {
    const scheduleAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

    await request(server)
      .post('/api/v1/notifications/admin/send')
      .set(auth())
      .send({
        title: 'Scheduled staff briefing',
        body: 'Briefing tomorrow morning.',
        category: 'STAFF',
        priority: 'LOW',
        roleSlugs: ['NURSE'],
        scheduleAt,
      })
      .expect(201)

    const inbox = await request(server).get('/api/v1/notifications').set(plainAuth()).expect(200)
    expect(inbox.body.data.data.map((n: { title: string }) => n.title)).not.toContain(
      'Scheduled staff briefing',
    )

    const scheduled = await request(server)
      .get('/api/v1/notifications/admin/history?scheduledOnly=true')
      .set(auth())
      .expect(200)
    expect(scheduled.body.data.data.map((n: { title: string }) => n.title)).toContain(
      'Scheduled staff briefing',
    )
  })

  it('cancels a scheduled notification', async () => {
    const scheduled = await prisma.notification.findFirstOrThrow({
      where: { organizationId: orgId, title: 'Scheduled staff briefing' },
    })

    await request(server)
      .delete(`/api/v1/notifications/admin/scheduled/${scheduled.id}`)
      .set(auth())
      .expect(200)

    const after = await prisma.notification.findUniqueOrThrow({
      where: { id: scheduled.id },
      include: { deliveries: true },
    })
    expect(after.deliveryStatus).toBe('CANCELLED')
    expect(after.deliveries.every((d) => d.status === 'CANCELLED')).toBe(true)
  })

  it('rejects a schedule in the past', async () => {
    await request(server)
      .post('/api/v1/notifications/admin/send')
      .set(auth())
      .send({
        title: 'Too late',
        body: 'x',
        roleSlugs: ['NURSE'],
        scheduleAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      })
      .expect(400)
  })

  // ── Checkpoint 18.4 — event integration ──────────────────────────────────

  it('notifies the treating doctor when an appointment is booked, and schedules a reminder', async () => {
    // Built through the real modules so the notification comes from the event
    // the appointments module already emits, not from a test-only shortcut.
    const doctorEmail = `e2e-m18-doctor-${unique}@example.com`
    const argon2 = await import('argon2')
    const doctorUser = await prisma.user.create({
      data: {
        organizationId: orgId,
        email: doctorEmail,
        passwordHash: await argon2.hash(PASSWORD),
        firstName: 'Dev',
        lastName: 'Doctor',
        status: 'ACTIVE',
        isEmailVerified: true,
      },
    })
    const hospital = await prisma.hospital.create({
      data: { organizationId: orgId, name: 'E2E Hospital', code: `H${unique}`.slice(0, 10) },
    })
    const department = await prisma.department.create({
      data: {
        organizationId: orgId,
        hospitalId: hospital.id,
        name: 'General Medicine',
        code: `D${unique}`.slice(0, 10),
      },
    })
    const doctor = await prisma.doctor.create({
      data: {
        organizationId: orgId,
        userId: doctorUser.id,
        hospitalId: hospital.id,
        departmentId: department.id,
        registrationNumber: `REG${unique}`,
        qualification: 'MBBS',
        specialization: 'General Medicine',
        experienceYears: 5,
        consultationFee: 500,
        joiningDate: new Date('2020-01-01'),
      },
    })
    const patient = await prisma.patient.create({
      data: {
        organizationId: orgId,
        uhid: `UH${unique}`.slice(0, 20),
        firstName: 'Ravi',
        lastName: 'Kumar',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'MALE',
        phone: '9876543210',
      },
    })

    const scheduledAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const appointment = await prisma.appointment.create({
      data: {
        organizationId: orgId,
        appointmentNumber: `APT-${unique}`,
        patientId: patient.id,
        doctorId: doctor.id,
        departmentId: department.id,
        scheduledAt,
        durationMinutes: 15,
        type: 'OPD',
        status: 'SCHEDULED',
      },
    })

    const { EventEmitter2 } = await import('@nestjs/event-emitter')
    const emitter = app.get(EventEmitter2)
    emitter.emit('appointment.created', {
      appointmentId: appointment.id,
      doctorId: doctor.id,
      patientId: patient.id,
      organizationId: orgId,
    })

    // Listeners are async; give the event loop a turn to settle them.
    await new Promise((resolve) => setTimeout(resolve, 500))

    const notifications = await prisma.notification.findMany({
      where: { recipientId: doctorUser.id },
    })
    const booked = notifications.find((n) => n.type === 'APPOINTMENT_BOOKED')
    const reminder = notifications.find((n) => n.type === 'APPOINTMENT_REMINDER')

    expect(booked).toBeDefined()
    expect(booked?.body).toContain('Ravi Kumar')
    // The deep link is what a push click opens.
    expect(booked?.deepLink).toBe(`/dashboard/appointments/${appointment.id}`)

    expect(reminder).toBeDefined()
    expect(reminder?.deliveryStatus).toBe('SCHEDULED')
    // Scheduled 24h before the appointment by default.
    expect(reminder?.scheduleAt?.getTime()).toBeCloseTo(scheduledAt.getTime() - 24 * 3600_000, -4)

    // Re-emitting the same event must not double-notify.
    emitter.emit('appointment.created', {
      appointmentId: appointment.id,
      doctorId: doctor.id,
      patientId: patient.id,
      organizationId: orgId,
    })
    await new Promise((resolve) => setTimeout(resolve, 500))

    const afterReplay = await prisma.notification.count({
      where: { recipientId: doctorUser.id, type: 'APPOINTMENT_BOOKED' },
    })
    expect(afterReplay).toBe(1)

    // Cancelling the appointment must also cancel its pending reminder.
    emitter.emit('appointment.status_changed', {
      appointmentId: appointment.id,
      doctorId: doctor.id,
      patientId: patient.id,
      organizationId: orgId,
      toStatus: 'CANCELLED',
    })
    await new Promise((resolve) => setTimeout(resolve, 500))

    const cancelledReminder = await prisma.notification.findFirstOrThrow({
      where: { recipientId: doctorUser.id, type: 'APPOINTMENT_REMINDER' },
    })
    expect(cancelledReminder.deliveryStatus).toBe('CANCELLED')
  }, 60_000)

  // ── Platform isolation (mirrors Checkpoint 16.2's guarantee) ─────────────

  it('denies platform notification analytics to a tenant admin holding the permission', async () => {
    const permissions = await prisma.permission.findMany({
      where: { resource: 'platform.notifications' },
    })
    const adminRole = await prisma.role.findFirstOrThrow({
      where: { organizationId: orgId, systemRole: 'ORG_ADMIN' },
    })
    for (const permission of permissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id } },
        update: {},
        create: { roleId: adminRole.id, permissionId: permission.id },
      })
    }

    const relogin = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: PASSWORD })
      .expect(200)
    const elevated = relogin.body.data.accessToken as string

    // `PlatformGuard` additionally requires the platform tenant, so holding
    // every `platform.notifications.*` grant inside a customer org is useless.
    await request(server)
      .get('/api/v1/platform/notifications/analytics')
      .set({ Authorization: `Bearer ${elevated}` })
      .expect(403)
  })
})
