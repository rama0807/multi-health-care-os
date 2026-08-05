import { NotificationChannel, NotificationDeliveryStatus } from '@medicore/types'

import { NotificationQueueService } from './notification-queue.service'

function makeConfig(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    'notifications.maxAttempts': 4,
    'notifications.retryBaseDelaySeconds': 60,
    'notifications.retryMaxDelaySeconds': 3600,
    'notifications.workerEnabled': true,
    ...overrides,
  }
  return { get: (key: string) => values[key] } as never
}

function makePrisma() {
  return {
    notificationDelivery: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    notification: { count: jest.fn().mockResolvedValue(0) },
  }
}

const NOW = new Date('2026-08-06T10:00:00.000Z')

describe('NotificationQueueService.backoffMs', () => {
  const service = new NotificationQueueService({} as never, makeConfig())

  it('doubles each attempt from the base delay', () => {
    expect(service.backoffMs(1)).toBe(60_000)
    expect(service.backoffMs(2)).toBe(120_000)
    expect(service.backoffMs(3)).toBe(240_000)
    expect(service.backoffMs(4)).toBe(480_000)
  })

  it('caps at the configured maximum', () => {
    // 60 * 2^9 = 30720s, far past the 3600s cap.
    expect(service.backoffMs(10)).toBe(3_600_000)
  })
})

describe('NotificationQueueService.recordAttempt', () => {
  const delivery = { id: 'del-1', attempts: 0, channel: NotificationChannel.EMAIL }

  it('marks a successful send SENT and clears the retry schedule', async () => {
    const prisma = makePrisma()
    const service = new NotificationQueueService(prisma as never, makeConfig())

    const status = await service.recordAttempt(
      delivery,
      { ok: true, providerName: 'resend', providerMessageId: 'msg-7', retryable: false },
      NOW,
    )

    expect(status).toBe(NotificationDeliveryStatus.SENT)
    const data = prisma.notificationDelivery.update.mock.calls[0][0].data
    expect(data).toMatchObject({
      status: NotificationDeliveryStatus.SENT,
      attempts: 1,
      nextAttemptAt: null,
      failureReason: null,
      providerMessageId: 'msg-7',
    })
  })

  it('schedules a backoff retry for a retryable failure', async () => {
    const prisma = makePrisma()
    const service = new NotificationQueueService(prisma as never, makeConfig())

    const status = await service.recordAttempt(
      delivery,
      { ok: false, providerName: 'resend', failureReason: 'upstream 503', retryable: true },
      NOW,
    )

    expect(status).toBe(NotificationDeliveryStatus.QUEUED)
    const data = prisma.notificationDelivery.update.mock.calls[0][0].data
    expect(data.status).toBe(NotificationDeliveryStatus.QUEUED)
    expect(data.nextAttemptAt).toEqual(new Date(NOW.getTime() + 60_000))
    // The reason is kept while retries remain, so the console can explain
    // *why* something is still retrying.
    expect(data.failureReason).toBe('upstream 503')
    expect(data.failedAt).toBeNull()
  })

  it('fails a non-retryable failure immediately, without burning attempts', async () => {
    const prisma = makePrisma()
    const service = new NotificationQueueService(prisma as never, makeConfig())

    const status = await service.recordAttempt(
      delivery,
      { ok: false, providerName: 'fcm', failureReason: 'FCM is not configured', retryable: false },
      NOW,
    )

    expect(status).toBe(NotificationDeliveryStatus.FAILED)
    const data = prisma.notificationDelivery.update.mock.calls[0][0].data
    expect(data.attempts).toBe(1)
    expect(data.nextAttemptAt).toBeNull()
    expect(data.failedAt).toEqual(NOW)
  })

  it('fails once the attempt budget is spent, even when retryable', async () => {
    const prisma = makePrisma()
    const service = new NotificationQueueService(prisma as never, makeConfig({ 'notifications.maxAttempts': 3 }))

    const status = await service.recordAttempt(
      { ...delivery, attempts: 2 },
      { ok: false, providerName: 'resend', failureReason: 'still down', retryable: true },
      NOW,
    )

    expect(status).toBe(NotificationDeliveryStatus.FAILED)
    expect(prisma.notificationDelivery.update.mock.calls[0][0].data.nextAttemptAt).toBeNull()
  })
})

describe('NotificationQueueService.claimDue', () => {
  it('claims a row exactly once when two workers race for it', async () => {
    const prisma = makePrisma()
    prisma.notificationDelivery.findMany.mockResolvedValue([
      { id: 'del-1', status: NotificationDeliveryStatus.PENDING },
    ])
    // The compare-and-set update matched no row: another worker got there
    // first, so this worker must not receive the delivery.
    prisma.notificationDelivery.updateMany.mockResolvedValue({ count: 0 })

    const service = new NotificationQueueService(prisma as never, makeConfig())
    const claimed = await service.claimDue(10, NOW)

    expect(claimed).toEqual([])
    expect(prisma.notificationDelivery.findUnique).not.toHaveBeenCalled()
  })

  it('returns the row when the compare-and-set wins', async () => {
    const prisma = makePrisma()
    prisma.notificationDelivery.findMany.mockResolvedValue([
      { id: 'del-1', status: NotificationDeliveryStatus.QUEUED },
    ])
    prisma.notificationDelivery.updateMany.mockResolvedValue({ count: 1 })
    prisma.notificationDelivery.findUnique.mockResolvedValue({ id: 'del-1', attempts: 1 })

    const service = new NotificationQueueService(prisma as never, makeConfig())
    const claimed = await service.claimDue(10, NOW)

    expect(claimed).toHaveLength(1)
    // Claiming moves the row to SENDING so no second worker can see it.
    expect(prisma.notificationDelivery.updateMany.mock.calls[0][0].data.status).toBe(
      NotificationDeliveryStatus.SENDING,
    )
  })
})

describe('NotificationQueueService.retryFailed', () => {
  it('re-queues without resetting the attempt counter', async () => {
    const prisma = makePrisma()
    prisma.notificationDelivery.updateMany.mockResolvedValue({ count: 3 })
    const service = new NotificationQueueService(prisma as never, makeConfig())

    const count = await service.retryFailed('org-1', ['del-1', 'del-2', 'del-3'])

    expect(count).toBe(3)
    const call = prisma.notificationDelivery.updateMany.mock.calls[0][0]
    expect(call.where).toMatchObject({ organizationId: 'org-1', status: NotificationDeliveryStatus.FAILED })
    // Deliberately absent: an operator needs to see a message has now been
    // tried seven times, and resetting would let a broken destination loop.
    expect(call.data.attempts).toBeUndefined()
    expect(call.data.status).toBe(NotificationDeliveryStatus.QUEUED)
  })
})

describe('NotificationQueueService.status', () => {
  it('names the reason when the worker is switched off', async () => {
    const prisma = makePrisma()
    const service = new NotificationQueueService(
      prisma as never,
      makeConfig({ 'notifications.workerEnabled': false }),
    )

    const status = await service.status('org-1', NOW)

    expect(status.workerEnabled).toBe(false)
    expect(status.workerDisabledReason).toContain('NOTIFICATIONS_WORKER_ENABLED')
  })
})
