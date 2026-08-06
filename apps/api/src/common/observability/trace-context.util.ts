import { randomBytes } from 'node:crypto'

/**
 * W3C Trace Context (https://www.w3.org/TR/trace-context/) - the wire format
 * OpenTelemetry, Jaeger, Datadog, Honeycomb and every other tracing backend
 * agree on.
 *
 * This is deliberately the *propagation* half only, with no SDK behind it
 * (ADR-0029). Parsing an inbound `traceparent`, minting one when it is
 * absent, stamping `traceId`/`spanId` onto every log line and echoing the
 * header back is what makes MediCore's logs joinable with an upstream
 * gateway's traces. Installing the OpenTelemetry SDK - spans, exporters, a
 * collector - is a deployment decision, and is recorded as deferred work
 * (TD-0069) rather than half-built here.
 */

const TRACEPARENT_PATTERN = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/

/** All-zero ids are explicitly invalid in the spec, not merely unlikely. */
const INVALID_TRACE_ID = '0'.repeat(32)
const INVALID_SPAN_ID = '0'.repeat(16)

export interface TraceContext {
  /** 32 lowercase hex characters. Shared by every span in one trace. */
  traceId: string
  /** 16 lowercase hex characters. This service's span. */
  spanId: string
  /** The caller's span id, when this request continued an existing trace. */
  parentSpanId?: string
  /** True when the upstream sampled flag was set, or when there was none. */
  sampled: boolean
  /** Whether a valid inbound `traceparent` was found. */
  continued: boolean
}

export function newTraceId(): string {
  return randomBytes(16).toString('hex')
}

export function newSpanId(): string {
  return randomBytes(8).toString('hex')
}

/**
 * Derives this request's trace context from an inbound header.
 *
 * A malformed or all-zero `traceparent` starts a fresh trace rather than
 * being rejected - the spec requires exactly that, and a broken header from
 * one caller must never turn into a failed request.
 */
export function parseTraceparent(header: string | string[] | undefined): TraceContext {
  const value = Array.isArray(header) ? header[0] : header
  const match = value ? TRACEPARENT_PATTERN.exec(value.trim().toLowerCase()) : null

  if (!match || match[2] === INVALID_TRACE_ID || match[3] === INVALID_SPAN_ID) {
    return { traceId: newTraceId(), spanId: newSpanId(), sampled: true, continued: false }
  }

  const [, , traceId, parentSpanId, flags] = match
  return {
    traceId,
    spanId: newSpanId(),
    parentSpanId,
    sampled: (Number.parseInt(flags, 16) & 0x01) === 0x01,
    continued: true,
  }
}

/** The header value to pass to anything this request calls downstream. */
export function formatTraceparent(context: TraceContext): string {
  return `00-${context.traceId}-${context.spanId}-${context.sampled ? '01' : '00'}`
}
