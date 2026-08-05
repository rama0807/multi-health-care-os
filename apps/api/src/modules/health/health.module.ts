import { Module } from '@nestjs/common'

import { HealthController } from './health.controller'
import { HealthService } from './health.service'
import { MetricsController } from './metrics.controller'

@Module({
  controllers: [HealthController, MetricsController],
  providers: [HealthService],
  // `main.ts` resolves this to flip readiness off at the start of a graceful
  // shutdown, before the HTTP server stops accepting connections.
  exports: [HealthService],
})
export class HealthModule {}
