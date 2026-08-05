import {
  EmailDigestFrequency,
  NotificationCategory,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationPriority,
  NotificationStatus,
} from '@medicore/types'

import { NotificationChannelProvider } from './channels/channel-provider.interface'
import { NotificationDispatcherService } from './notification-dispatcher.service'

const NOW = new Date('2026-08-06T10:00:00.000Z')

function makeProvider(
  channel: NotificationChannel,
  send = jest.fn().mockResolvedValue({ ok: true, providerName: 'test', retryable: false }),
): NotificationChannelProvider & { send: jest.Mock } {
  return {
    channel,
    providerName: 'test',
    isConfigured: () => true,
    unconfiguredReason: () => null,
    send,
  } as NotificationChannelProvider & { send: jest.Mock }
}

function makeNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: 'notif-1',
    organizationId: 'org-1',
    recipientId: 'user-1',
    category: NotificationCategory.LABORATORY,
    priority: NotificationPriority.NORMAL,
    title: 'Lab report ready',
    body: 'CBC is ready',
    deepLink: '/dashboard/laboratory/orders/lab-1',
    imageUrl: null,
    icon: 'FlaskConical',
    payload: {},
    recipient: {
      id: 'user-1',
      email: 'doctor@example.com',
      phone: '+911234567890',
      firstName: 'Asha',
      lastName: 'Rao',
    },
    patient: null,
    ...overrides,
  }
}

function makeHarness(options: {
  notification?: Record<string, unknown>
  preference?: Record<string, unknown>
  providers?: NotificationChannelProvider[]
  enabled?: boolean
} = {}) {
  const prisma = {
    notification: {
      findUnique: jest.fn().mockResolvedValue(makeNotification(options.notification)),
      update: jest.fn().mockResolvedValue({}),
    },
    notificationDelivery: {
      update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
  }

  const queue = {
    skip: jest.fn().mockResolvedValue(undefined),
    recordAttempt: jest.fn().mockResolvedValue(NotificationDeliveryStatus.SENT),
  }

  const preferences = {
    get: jest.fn().mockResolvedValue({
      userId: 'user-1',
      inAppEnabled: true,
      emailEnabled: true,
      pushEnabled: true,
      smsEnabled: false,
      whatsappEnabled: false,
      emailFrequency: EmailDigestFrequency.IMMEDIATE,
      quietHoursStart: null,
      quietHoursEnd: null,
      timezone: 'Asia/Kolkata',
      categoryPreferences: {},
      updatedAt: null,
      ...options.preference,
    }),
    decide: jest.fn().mockReturnValue({ allowed: true }),
  }

  const devices = {
    activeTokens: jest.fn().mockResolvedValue(['token-a', 'token-b']),
    markTokensInvalid: jest.fn().mockResolvedValue(undefined),
  }

  const config = { get: (key: string) => (key === 'notifications.enabled' ? options.enabled ?? true : undefined) }

  const providers = options.providers ?? [makeProvider(NotificationChannel.EMAIL)]

  const service = new NotificationDispatcherService(
    prisma as never,
    config as never,
    queue as never,
    preferences as never,
    devices as never,
    providers,
  )

  return { service, prisma, queue, preferences, devices, providers }
}

const emailDelivery = {
  id: 'del-1',
  notificationId: 'notif-1',
  organizationId: 'org-1',
  channel: NotificationChannel.EMAIL,
  attempts: 0,
}

/** The dispatcher only reads these five fields off a delivery row. */
const asDelivery = (overrides: Partial<typeof emailDelivery> = {}) =>
  ({ ...emailDelivery, ...overrides }) as never

describe('NotificationDispatcherService.dispatchOne', () => {
  it('resolves the recipient’s email and sends', async () => {
    const send = jest.fn().mockResolvedValue({ ok: true, providerName: 'resend', retryable: false })
    const { service, queue } = makeHarness({ providers: [makeProvider(NotificationChannel.EMAIL, send)] })

    await service.dispatchOne(asDelivery(), NOW)

    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0]).toMatchObject({
      destination: 'doctor@example.com',
      title: 'Lab report ready',
      deepLink: '/dashboard/laboratory/orders/lab-1',
      recipientName: 'Asha Rao',
    })
    expect(queue.recordAttempt).toHaveBeenCalled()
  })

  it('SKIPs — never FAILs — a channel the user’s preferences suppress', async () => {
    const send = jest.fn()
    const { service, queue, preferences } = makeHarness({
      providers: [makeProvider(NotificationChannel.EMAIL, send)],
    })
    preferences.decide.mockReturnValue({ allowed: false, reason: 'Quiet hours (22:00–07:00 Asia/Kolkata)' })

    await service.dispatchOne(asDelivery(), NOW)

    expect(send).not.toHaveBeenCalled()
    // A suppressed channel counted as a failure would corrupt the success rate.
    expect(queue.recordAttempt).not.toHaveBeenCalled()
    expect(queue.skip).toHaveBeenCalledWith('del-1', 'Quiet hours (22:00–07:00 Asia/Kolkata)')
  })

  it('skips everything when notifications are globally disabled', async () => {
    const send = jest.fn()
    const { service, queue } = makeHarness({
      enabled: false,
      providers: [makeProvider(NotificationChannel.EMAIL, send)],
    })

    await service.dispatchOne(asDelivery(), NOW)

    expect(send).not.toHaveBeenCalled()
    expect(queue.skip.mock.calls[0][1]).toContain('NOTIFICATIONS_ENABLED')
  })

  it('fans push out over every registered device and deactivates dead tokens', async () => {
    const send = jest.fn().mockResolvedValue({
      ok: true,
      providerName: 'fcm',
      retryable: false,
      invalidTokens: ['token-b'],
    })
    const { service, devices } = makeHarness({ providers: [makeProvider(NotificationChannel.PUSH, send)] })

    await service.dispatchOne(asDelivery({ channel: NotificationChannel.PUSH }), NOW)

    expect(send.mock.calls[0][0].pushTokens).toEqual(['token-a', 'token-b'])
    expect(devices.markTokensInvalid).toHaveBeenCalledWith(['token-b'])
  })

  it('does not consult preferences for a patient-addressed notification', async () => {
    const { service, preferences } = makeHarness({
      notification: {
        recipientId: null,
        recipient: null,
        patient: { email: 'patient@example.com', phone: null, firstName: 'Ravi', lastName: 'Kumar' },
      },
    })

    await service.dispatchOne(asDelivery(), NOW)

    // A patient has no user account and therefore no preferences row.
    expect(preferences.decide).not.toHaveBeenCalled()
  })

  it('skips when no provider is registered for the channel', async () => {
    const { service, queue } = makeHarness({ providers: [makeProvider(NotificationChannel.EMAIL)] })

    await service.dispatchOne(asDelivery({ channel: NotificationChannel.WHATSAPP }), NOW)

    expect(queue.skip.mock.calls[0][1]).toContain('WHATSAPP')
  })
})

describe('NotificationDispatcherService.dispatchMany', () => {
  it('records a dispatcher crash as a retryable attempt and keeps going', async () => {
    const failing = makeProvider(NotificationChannel.EMAIL)
    failing.send = jest.fn().mockRejectedValue(new Error('provider exploded'))
    const { service, queue } = makeHarness({ providers: [failing] })

    await service.dispatchMany([asDelivery(), asDelivery()], NOW)

    // Both deliveries were attempted — one throwing must not wedge the queue.
    expect(queue.recordAttempt).toHaveBeenCalledTimes(2)
    expect(queue.recordAttempt.mock.calls[0][1]).toMatchObject({
      ok: false,
      retryable: true,
      failureReason: expect.stringContaining('provider exploded'),
    })
  })
})

describe('NotificationDispatcherService.refreshNotificationStatus', () => {
  const cases: Array<[string, Array<Partial<{ status: string; attempts: number }>>, NotificationStatus]> = [
    ['all sent', [{ status: 'SENT' }, { status: 'SENT' }], NotificationStatus.SENT],
    ['some sent, some failed', [{ status: 'SENT' }, { status: 'FAILED' }], NotificationStatus.PARTIALLY_SENT],
    ['all failed', [{ status: 'FAILED' }], NotificationStatus.FAILED],
    ['still in flight', [{ status: 'SENT' }, { status: 'QUEUED' }], NotificationStatus.QUEUED],
    ['every channel suppressed', [{ status: 'SKIPPED' }, { status: 'SKIPPED' }], NotificationStatus.CANCELLED],
  ]

  it.each(cases)('derives %s', async (_label, deliveries, expected) => {
    const { service, prisma } = makeHarness()
    prisma.notification.findUnique.mockResolvedValue({ isRead: false, deliveryStatus: 'PENDING' })
    prisma.notificationDelivery.findMany.mockResolvedValue(
      deliveries.map((d) => ({ sentAt: null, failureReason: null, attempts: 0, ...d })),
    )

    await service.refreshNotificationStatus('notif-1')

    expect(prisma.notification.update.mock.calls[0][0].data.deliveryStatus).toBe(expected)
  })

  it('keeps READ sticky so a later retry cannot mark it unread again', async () => {
    const { service, prisma } = makeHarness()
    prisma.notification.findUnique.mockResolvedValue({ isRead: true, deliveryStatus: 'READ' })
    prisma.notificationDelivery.findMany.mockResolvedValue([
      { status: 'SENT', sentAt: null, failureReason: null, attempts: 2 },
    ])

    await service.refreshNotificationStatus('notif-1')

    const data = prisma.notification.update.mock.calls[0][0].data
    expect(data.deliveryStatus).toBe(NotificationStatus.READ)
    expect(data.retryCount).toBe(2)
  })
})
