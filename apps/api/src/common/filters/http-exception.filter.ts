import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { FastifyReply, FastifyRequest } from 'fastify'
import { nanoid } from 'nanoid'

import { currentRequestContext } from '../observability/request-context.service'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<FastifyReply>()
    const request = ctx.getRequest<FastifyRequest>()

    // The id the middleware already put in the logs and the `x-request-id`
    // response header (Milestone 19.4). Previously this filter echoed the raw
    // inbound header, or minted a *fresh* id when there was none - so the id a
    // user quoted from a failed request matched nothing in the logs. The
    // fallbacks below only matter for a request that failed before the
    // middleware ran.
    const correlation = currentRequestContext()
    const requestId =
      correlation?.requestId ?? (request.headers['x-request-id'] as string) ?? nanoid(10)

    let status: number
    let code: string
    let message: string
    let details: unknown

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const exceptionResponse = exception.getResponse()

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>
        code = (resp.code as string) ?? this.statusToCode(status)
        message = (resp.message as string) ?? exception.message
        details = resp.errors ?? resp.details
      } else {
        code = this.statusToCode(status)
        message = exceptionResponse
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR
      code = 'INTERNAL_SERVER_ERROR'
      message = 'An unexpected error occurred'

      // The correlation ids are repeated in the message because this logger
      // writes through Nest's default context, not the request-scoped pino
      // child - without them a 500 in the log cannot be tied to the id the
      // caller was handed.
      this.logger.error(
        `Unhandled exception [requestId=${requestId} traceId=${correlation?.trace.traceId ?? '-'}] ` +
          `${request.method} ${request.url}: ` +
          `${exception instanceof Error ? exception.message : String(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      )
    }

    void response.status(status).send({
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
      meta: {
        requestId,
        ...(correlation ? { traceId: correlation.trace.traceId } : {}),
        timestamp: new Date().toISOString(),
      },
    })
  }

  private statusToCode(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
    }
    return map[status] ?? 'ERROR'
  }
}
