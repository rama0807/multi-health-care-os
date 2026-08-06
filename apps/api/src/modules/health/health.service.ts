import { Injectable, Logger } from '@nestjs/common'

import { MetricsService } from '../../common/observability/metrics.service'
import { RedisService } from '../../common/redis/redis.service'
import { PrismaService } from '../../prisma/prisma.service'

export interface DependencyStatus {
  status: 'up' | 'down'
  latencyMs: number
  error?: string
}

export interface ReadinessResult {
  ready: boolean
  shuttingDown: boolean
  dependencies: Record<string, DependencyStatus>
}

/**
 * Liveness and readiness are answered separately on purpose (Milestone 19.4).
 *
 * **Liveness** asks "is this process wedged?" - the only correct response to a
 * failure is to kill and restart the container. It therefore checks nothing
 * external: a Postgres outage must not make an orchestrator restart every API
 * pod, which removes the capacity that would have served traffic the moment
 * the database returns.
 *
 * **Readiness** asks "should traffic be routed here?" - the correct response
 * to a failure is to take this instance out of rotation and leave it running.
 * It is the probe that checks dependencies, and the one that flips first
 * during a graceful shutdown.
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name)
  private shuttingDown = false
  private readonly startedAt = Date.now()

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly metrics: MetricsService,
  ) {}

  /**
   * Called at the top of a graceful shutdown, before the HTTP server stops
   * accepting connections, so a load balancer sees an unready instance while
   * it is still able to finish in-flight requests.
   */
  beginShutdown(): void {
    if (this.shuttingDown) return
    this.shuttingDown = true
    this.logger.log('Readiness turned off - draining before shutdown')
  }

  get isShuttingDown(): boolean {
    return this.shuttingDown
  }

  get uptimeSeconds(): number {
    return Math.round((Date.now() - this.startedAt) / 1000)
  }

  private async timed(name: string, probe: () => Promise<boolean>): Promise<DependencyStatus> {
    const startedAt = process.hrtime.bigint()
    try {
      const up = await probe()
      const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1e6
      this.metrics.recordDependency(name, up)
      return { status: up ? 'up' : 'down', latencyMs: Math.round(latencyMs) }
    } catch (error) {
      const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1e6
      this.metrics.recordDependency(name, false)
      return { status: 'down', latencyMs: Math.round(latencyMs), error: (error as Error).message }
    }
  }

  async checkDependencies(): Promise<Record<string, DependencyStatus>> {
    const [database, redis] = await Promise.all([
      this.timed('database', () => this.prisma.healthCheck()),
      this.timed('redis', async () => {
        await this.redis.set('health:ping', 'ok', 5)
        return true
      }),
    ])

    return { database, redis }
  }

  async readiness(): Promise<ReadinessResult> {
    const dependencies = await this.checkDependencies()
    const allUp = Object.values(dependencies).every((dependency) => dependency.status === 'up')

    return { ready: allUp && !this.shuttingDown, shuttingDown: this.shuttingDown, dependencies }
  }
}
