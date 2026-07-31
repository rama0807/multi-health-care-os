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

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<FastifyReply>()
    const request = ctx.getRequest<FastifyRequest>()

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

      this.logger.error(
        `Unhandled exception: ${exception instanceof Error ? exception.message : String(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      )
    }

    const requestId = (request.headers['x-request-id'] as string) ?? nanoid(10)

    void response.status(status).send({
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
      meta: {
        requestId,
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
