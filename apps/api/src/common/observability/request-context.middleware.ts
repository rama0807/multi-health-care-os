import { randomUUID } from 'node:crypto'
import { IncomingMessage, ServerResponse } from 'node:http'

import { Injectable, NestMiddleware } from '@nestjs/common'

import { RequestContextService } from './request-context.service'
import { formatTraceparent, parseTraceparent } from './trace-context.util'

export const REQUEST_ID_HEADER = 'x-request-id'
export const CORRELATION_ID_HEADER = 'x-correlation-id'
export const TRACEPARENT_HEADER = 'traceparent'

/** Bounded and character-restricted: an id from the network reaches the logs. */
const SAFE_ID = /^[A-Za-z0-9._-]{1,128}$/

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/**
 * The single rule for "what is this request's id", shared by this middleware
 * and pino's `genReqId` so the id in the HTTP access log, the id in every
 * service log line and the id in the `x-request-id` response header are always
 * the same string. Deriving it twice independently would produce three ids for
 * one request whenever the caller supplied none.
 */
export function deriveRequestId(headers: IncomingMessage['headers']): string {
  const supplied = firstHeader(headers[REQUEST_ID_HEADER]) ?? firstHeader(headers[CORRELATION_ID_HEADER])
  return supplied && SAFE_ID.test(supplied) ? supplied : randomUUID()
}

/**
 * Seeds the per-request correlation context (Milestone 19.4 / ADR-0029).
 *
 * Runs ahead of every guard, so an id exists even for a request that is about
 * to be rejected - a 401 with no correlation id is exactly the log line an
 * operator most needs to find.
 *
 * The inbound id is honoured when a caller supplies one (`x-request-id`, or
 * `x-correlation-id` for clients that use that spelling), which is what lets a
 * front end, a gateway and this API all report the same id for one user
 * action. It is validated first: an id from the network ends up in log lines
 * and in a response header, so an unbounded or newline-bearing value would be
 * a log-injection vector rather than a convenience.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly requestContext: RequestContextService) {}

  use(req: IncomingMessage & { id?: string }, res: ServerResponse, next: () => void): void {
    // `req.id` may already have been set by pino-http, depending on which
    // middleware Nest ran first; either way both sides end up on one id.
    const requestId = req.id ?? deriveRequestId(req.headers)
    req.id = requestId

    const trace = parseTraceparent(req.headers[TRACEPARENT_HEADER])

    // Echoed back on every response - success or failure - so a client can
    // quote the id from a failed call without reading the server's logs.
    res.setHeader(REQUEST_ID_HEADER, requestId)
    res.setHeader(TRACEPARENT_HEADER, formatTraceparent(trace))

    this.requestContext.run(
      { requestId, trace, method: req.method ?? 'UNKNOWN', url: req.url ?? '/' },
      next,
    )
  }
}
