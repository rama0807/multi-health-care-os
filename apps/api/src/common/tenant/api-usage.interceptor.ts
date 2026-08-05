import { JwtPayload } from '@medicore/types'
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { FastifyRequest } from 'fastify'
import { Observable } from 'rxjs'

import { ApiUsageService } from './api-usage.service'

/**
 * Meters one API request per authenticated organization (Checkpoint 16.2).
 *
 * Unauthenticated requests (login, health, refresh) are not counted — they
 * belong to no tenant yet. The increment is fire-and-forget: it is not
 * awaited, so metering adds no latency to the response, and
 * `ApiUsageService.increment` already swallows its own failures.
 */
@Injectable()
export class ApiUsageInterceptor implements NestInterceptor {
  constructor(private readonly apiUsage: ApiUsageService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle()

    const request = context.switchToHttp().getRequest<FastifyRequest & { user?: JwtPayload }>()
    const orgId = request.user?.orgId

    if (orgId) {
      void this.apiUsage.increment(orgId)
    }

    return next.handle()
  }
}
