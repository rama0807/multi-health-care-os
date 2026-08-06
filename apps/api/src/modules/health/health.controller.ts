import { Controller, Get, ServiceUnavailableException, VERSION_NEUTRAL } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { Public } from '../../common/decorators/public.decorator'

import { HealthService } from './health.service'

/**
 * Probes are registered at **both** `/api/health` and `/api/v1/health`
 * (Milestone 19.4).
 *
 * The version-neutral path is what infrastructure uses - the container
 * `HEALTHCHECK`, nginx, and any orchestrator probe - none of which should have
 * to be re-pointed the day the API publishes a `/v2`. The versioned path is
 * what the dashboard already calls, and stays working unchanged.
 */
@ApiTags('health')
@Controller({ path: 'health', version: [VERSION_NEUTRAL, '1'] })
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /**
   * The pre-existing detailed check, unchanged in shape: 200 with every
   * dependency's state, or 503 when one is down. The dashboard renders it.
   */
  @Public()
  @Get()
  @ApiOperation({ summary: 'Detailed health - dependencies included, 503 when one is down' })
  async check() {
    const dependencies = await this.health.checkDependencies()
    const databaseUp = dependencies.database.status === 'up'
    const redisUp = dependencies.redis.status === 'up'

    if (!databaseUp || !redisUp) {
      throw new ServiceUnavailableException({ database: databaseUp, redis: redisUp })
    }

    return {
      status: 'ok',
      database: databaseUp,
      redis: redisUp,
      uptimeSeconds: this.health.uptimeSeconds,
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Liveness - checks nothing external by design. A failure here means the
   * process is wedged and should be restarted; a database outage is not that.
   */
  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe - process-local only, never touches a dependency' })
  live() {
    return { status: 'ok', uptimeSeconds: this.health.uptimeSeconds }
  }

  /**
   * Readiness - 503 while a dependency is down *or* while the process is
   * draining, which is what takes an instance out of rotation without killing
   * it mid-request.
   */
  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe - 503 when a dependency is down or the process is draining' })
  async ready() {
    const result = await this.health.readiness()

    if (!result.ready) {
      throw new ServiceUnavailableException({
        status: result.shuttingDown ? 'draining' : 'not_ready',
        dependencies: result.dependencies,
      })
    }

    return { status: 'ready', dependencies: result.dependencies }
  }
}
