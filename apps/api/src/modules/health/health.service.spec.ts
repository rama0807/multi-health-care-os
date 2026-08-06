import { HealthService } from './health.service'

describe('HealthService', () => {
  let prisma: { healthCheck: jest.Mock }
  let redis: { set: jest.Mock }
  let metrics: { recordDependency: jest.Mock }
  let service: HealthService

  beforeEach(() => {
    prisma = { healthCheck: jest.fn().mockResolvedValue(true) }
    redis = { set: jest.fn().mockResolvedValue(undefined) }
    metrics = { recordDependency: jest.fn() }
    service = new HealthService(prisma as never, redis as never, metrics as never)
  })

  describe('checkDependencies', () => {
    it('reports both dependencies up, with a measured latency', async () => {
      const dependencies = await service.checkDependencies()

      expect(dependencies.database.status).toBe('up')
      expect(dependencies.redis.status).toBe('up')
      expect(dependencies.database.latencyMs).toBeGreaterThanOrEqual(0)
    })

    it('reports a dependency down without throwing', async () => {
      prisma.healthCheck.mockResolvedValue(false)

      const dependencies = await service.checkDependencies()

      expect(dependencies.database.status).toBe('down')
      expect(dependencies.redis.status).toBe('up')
    })

    it('captures a thrown failure as "down" and keeps its message', async () => {
      redis.set.mockRejectedValue(new Error('ECONNREFUSED'))

      const dependencies = await service.checkDependencies()

      expect(dependencies.redis).toMatchObject({ status: 'down', error: 'ECONNREFUSED' })
    })

    it('feeds each result into the metrics gauge, so a scrape reflects the last real check', async () => {
      prisma.healthCheck.mockResolvedValue(false)

      await service.checkDependencies()

      expect(metrics.recordDependency).toHaveBeenCalledWith('database', false)
      expect(metrics.recordDependency).toHaveBeenCalledWith('redis', true)
    })

    it('checks dependencies concurrently rather than serially', async () => {
      const order: string[] = []
      prisma.healthCheck.mockImplementation(async () => {
        order.push('db:start')
        await new Promise((resolve) => setImmediate(resolve))
        order.push('db:end')
        return true
      })
      redis.set.mockImplementation(() => {
        order.push('redis:start')
        return Promise.resolve()
      })

      await service.checkDependencies()

      // Redis started before the database finished - they overlap.
      expect(order.indexOf('redis:start')).toBeLessThan(order.indexOf('db:end'))
    })
  })

  describe('readiness', () => {
    it('is ready when everything is up', async () => {
      await expect(service.readiness()).resolves.toMatchObject({ ready: true, shuttingDown: false })
    })

    it('is not ready when a dependency is down', async () => {
      prisma.healthCheck.mockResolvedValue(false)

      await expect(service.readiness()).resolves.toMatchObject({ ready: false, shuttingDown: false })
    })

    it('is not ready while draining, even with every dependency healthy', async () => {
      service.beginShutdown()

      const result = await service.readiness()

      expect(result).toMatchObject({ ready: false, shuttingDown: true })
      expect(result.dependencies.database.status).toBe('up')
    })
  })

  describe('beginShutdown', () => {
    it('is idempotent - a second signal does not reset anything', () => {
      service.beginShutdown()
      service.beginShutdown()

      expect(service.isShuttingDown).toBe(true)
    })
  })

  it('reports an uptime, which liveness returns without touching a dependency', () => {
    expect(service.uptimeSeconds).toBeGreaterThanOrEqual(0)
  })
})
