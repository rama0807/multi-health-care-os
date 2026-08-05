import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common'

import { MetricsService } from './metrics.service'
import { RequestContextMiddleware } from './request-context.middleware'
import { RequestContextService } from './request-context.service'

/**
 * Cross-cutting observability (Milestone 19.4 / ADR-0029).
 *
 * Global because correlation ids and metrics are not a domain concern — a
 * service in any module may log, and forcing thirty modules to import this one
 * would be noise. It follows the precedent already set by `RedisModule` and
 * `PermissionsModule`.
 *
 * The middleware is applied to `*` here rather than being registered in
 * `main.ts`, so it runs inside Nest's pipeline (ahead of every guard) and can
 * be injected with the same `RequestContextService` instance the rest of the
 * application resolves.
 */
@Global()
@Module({
  providers: [RequestContextService, MetricsService],
  exports: [RequestContextService, MetricsService],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*')
  }
}
