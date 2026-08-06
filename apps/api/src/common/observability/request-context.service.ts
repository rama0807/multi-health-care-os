import { AsyncLocalStorage } from 'node:async_hooks'

import { Injectable } from '@nestjs/common'

import { TraceContext } from './trace-context.util'

/**
 * The per-request correlation record (Milestone 19.4 / ADR-0029).
 *
 * `requestId` is what an operator quotes from a support ticket; `traceId` is
 * what a tracing backend joins on. They are kept separate on purpose - the
 * request id survives even when nothing upstream speaks trace context.
 */
export interface RequestContext {
  requestId: string
  trace: TraceContext
  method: string
  url: string
  /** Populated once authentication has resolved a caller. */
  userId?: string
  organizationId?: string
}

const storage = new AsyncLocalStorage<RequestContext>()

/**
 * Makes the current request's correlation ids reachable from any service,
 * without threading a context argument through thirty modules' method
 * signatures.
 *
 * `AsyncLocalStorage` is the right tool precisely because the alternative -
 * a request-scoped provider - would force every consumer up the injection
 * chain to become request-scoped too, which in NestJS means rebuilding that
 * subtree on every request.
 *
 * Anything running outside a request (the notification worker, the scheduled
 * report dispatcher, a module's `onModuleInit`) simply has no store, and
 * every accessor returns `undefined` rather than throwing.
 */
@Injectable()
export class RequestContextService {
  /** Runs `fn` with `context` visible to everything it awaits. */
  run<T>(context: RequestContext, fn: () => T): T {
    return storage.run(context, fn)
  }

  get(): RequestContext | undefined {
    return storage.getStore()
  }

  get requestId(): string | undefined {
    return storage.getStore()?.requestId
  }

  get traceId(): string | undefined {
    return storage.getStore()?.trace.traceId
  }

  /**
   * Attaches the caller once a guard has authenticated them. Mutating the
   * existing store (rather than re-running it) is what lets a log line
   * written *after* authentication carry the tenant, while one written
   * before it honestly carries nothing.
   */
  setPrincipal(principal: { userId?: string; organizationId?: string }): void {
    const context = storage.getStore()
    if (!context) return
    if (principal.userId) context.userId = principal.userId
    if (principal.organizationId) context.organizationId = principal.organizationId
  }

  /** The fields merged into every structured log line and error response. */
  logFields(): Record<string, string> {
    const context = storage.getStore()
    if (!context) return {}
    return {
      requestId: context.requestId,
      traceId: context.trace.traceId,
      spanId: context.trace.spanId,
      ...(context.userId ? { userId: context.userId } : {}),
      ...(context.organizationId ? { organizationId: context.organizationId } : {}),
    }
  }
}

/** Module-level accessor for code that cannot take an injection (pino hooks). */
export function currentRequestContext(): RequestContext | undefined {
  return storage.getStore()
}
