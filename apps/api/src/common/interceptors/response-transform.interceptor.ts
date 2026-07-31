import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { FastifyRequest } from 'fastify'
import { nanoid } from 'nanoid'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

export interface Response<T> {
  success: boolean
  data: T
  meta: {
    requestId: string
    timestamp: string
  }
}

@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<Response<T>> {
    const request = context.switchToHttp().getRequest<FastifyRequest>()
    const requestId = (request.headers['x-request-id'] as string) ?? nanoid(10)

    return next.handle().pipe(
      map((data) => {
        // If already wrapped (e.g., paginated response), pass through
        if (data && typeof data === 'object' && 'success' in data) {
          return data as unknown as Response<T>
        }

        return {
          success: true,
          data,
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
          },
        }
      }),
    )
  }
}
