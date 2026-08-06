import { timingSafeEqual } from 'node:crypto'

import { Controller, ForbiddenException, Get, Header, Headers, NotFoundException, VERSION_NEUTRAL } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'

import { Public } from '../../common/decorators/public.decorator'
import { MetricsService } from '../../common/observability/metrics.service'

/** Length-independent, constant-time comparison of two secrets. */
function secretsMatch(presented: string, expected: string): boolean {
  const a = Buffer.from(presented)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Prometheus scrape endpoint (Milestone 19.4).
 *
 * Version-neutral (`/api/metrics`) because a scrape config outlives an API
 * version, and throttle-exempt because a 15-second scrape interval is exactly
 * the traffic the global limiter exists to stop - losing metrics during an
 * incident is the opposite of what this endpoint is for.
 *
 * Access follows `security.config.ts`: a `METRICS_TOKEN` makes it a bearer
 * endpoint, and its absence in production makes it a 404 rather than an open
 * description of the deployment.
 */
@ApiTags('health')
@Controller({ path: 'metrics', version: VERSION_NEUTRAL })
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @SkipThrottle()
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Prometheus exposition format (bearer-authenticated when METRICS_TOKEN is set)' })
  async scrape(@Headers('authorization') authorization?: string): Promise<string> {
    const token = this.config.get<string>('security.metricsToken')

    if (!token) {
      if (this.config.get<boolean>('app.isProduction')) {
        // Deliberately a 404, not a 403: an unauthenticated scrape target on a
        // production interface should not even confirm it exists.
        throw new NotFoundException()
      }
    } else {
      const presented = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
      if (!presented || !secretsMatch(presented, token)) {
        throw new ForbiddenException('Invalid metrics token')
      }
    }

    return this.metrics.scrape()
  }
}
