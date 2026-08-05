import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { FastifyReply, FastifyRequest } from 'fastify'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'

import { MetricsService } from './metrics.service'

/** Fastify 4 renamed `routerPath`; both spellings exist depending on version. */
type RoutedRequest = FastifyRequest & {
  routerPath?: string
  routeOptions?: { url?: string }
}

/**
 * Records latency and outcome for every HTTP request (Milestone 19.4).
 *
 * The `route` label is the matched **route pattern**, never `request.url`.
 * Labelling by URL would mint one Prometheus time series per patient id — an
 * unbounded cardinality explosion, and a slow leak of record identifiers into
 * the monitoring system. A request that matches no route is labelled
 * `unmatched` for the same reason.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle()

    const http = context.switchToHttp()
    const request = http.getRequest<RoutedRequest>()
    const reply = http.getResponse<FastifyReply>()

    const method = request.method ?? 'UNKNOWN'
    const startedAt = process.hrtime.bigint()
    this.metrics.startRequest(method)

    const record = (status: number) => {
      const route = request.routeOptions?.url ?? request.routerPath ?? 'unmatched'
      const seconds = Number(process.hrtime.bigint() - startedAt) / 1e9
      this.metrics.recordRequest(method, route, status, seconds)
    }

    return next.handle().pipe(
      tap({
        next: () => record(reply.statusCode),
        // The exception filter has not run yet, so `reply.statusCode` is still
        // 200 here; read the status the thrown error carries instead.
        error: (error: { status?: number; statusCode?: number }) =>
          record(error?.status ?? error?.statusCode ?? 500),
      }),
    )
  }
}
