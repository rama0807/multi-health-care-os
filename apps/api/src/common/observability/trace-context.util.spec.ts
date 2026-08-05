import { formatTraceparent, newSpanId, newTraceId, parseTraceparent } from './trace-context.util'

const TRACE_ID = '4bf92f3577b34da6a3ce929d0e0e4736'
const PARENT_SPAN_ID = '00f067aa0ba902b7'

describe('parseTraceparent', () => {
  it('continues an upstream trace, keeping its trace id and recording the caller as parent', () => {
    const context = parseTraceparent(`00-${TRACE_ID}-${PARENT_SPAN_ID}-01`)

    expect(context).toMatchObject({
      traceId: TRACE_ID,
      parentSpanId: PARENT_SPAN_ID,
      sampled: true,
      continued: true,
    })
    // This service gets its own span — it never reuses the caller's.
    expect(context.spanId).not.toBe(PARENT_SPAN_ID)
    expect(context.spanId).toMatch(/^[0-9a-f]{16}$/)
  })

  it('honours an unsampled upstream decision', () => {
    expect(parseTraceparent(`00-${TRACE_ID}-${PARENT_SPAN_ID}-00`).sampled).toBe(false)
  })

  it('accepts an uppercase header, since hex case is not significant', () => {
    const context = parseTraceparent(`00-${TRACE_ID.toUpperCase()}-${PARENT_SPAN_ID}-01`)
    expect(context.traceId).toBe(TRACE_ID)
    expect(context.continued).toBe(true)
  })

  it('takes the first value when the header is duplicated', () => {
    const context = parseTraceparent([`00-${TRACE_ID}-${PARENT_SPAN_ID}-01`, 'garbage'])
    expect(context.traceId).toBe(TRACE_ID)
  })

  describe('starts a fresh trace rather than failing the request', () => {
    it.each([
      ['no header at all', undefined],
      ['an empty string', ''],
      ['a truncated header', '00-abc-def-01'],
      ['a non-hex trace id', `00-zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz-${PARENT_SPAN_ID}-01`],
      ['an all-zero trace id (invalid per the spec)', `00-${'0'.repeat(32)}-${PARENT_SPAN_ID}-01`],
      ['an all-zero span id (invalid per the spec)', `00-${TRACE_ID}-${'0'.repeat(16)}-01`],
    ])('%s', (_case, header) => {
      const context = parseTraceparent(header)

      expect(context.continued).toBe(false)
      expect(context.parentSpanId).toBeUndefined()
      expect(context.traceId).toMatch(/^[0-9a-f]{32}$/)
      // A caller who cannot speak trace context must not lose its own trace.
      expect(context.sampled).toBe(true)
    })
  })
})

describe('formatTraceparent', () => {
  it('round-trips through parse, preserving the trace and this service ⇒ next hop parent', () => {
    const context = parseTraceparent(`00-${TRACE_ID}-${PARENT_SPAN_ID}-01`)
    const downstream = parseTraceparent(formatTraceparent(context))

    expect(downstream.traceId).toBe(TRACE_ID)
    expect(downstream.parentSpanId).toBe(context.spanId)
  })

  it('encodes the sampled flag', () => {
    const base = { traceId: TRACE_ID, spanId: PARENT_SPAN_ID, continued: true }
    expect(formatTraceparent({ ...base, sampled: true })).toBe(`00-${TRACE_ID}-${PARENT_SPAN_ID}-01`)
    expect(formatTraceparent({ ...base, sampled: false })).toBe(`00-${TRACE_ID}-${PARENT_SPAN_ID}-00`)
  })
})

describe('id generation', () => {
  it('produces spec-shaped, non-repeating ids', () => {
    const traceIds = new Set(Array.from({ length: 50 }, newTraceId))
    const spanIds = new Set(Array.from({ length: 50 }, newSpanId))

    expect(traceIds.size).toBe(50)
    expect(spanIds.size).toBe(50)
    expect([...traceIds].every((id) => /^[0-9a-f]{32}$/.test(id))).toBe(true)
    expect([...spanIds].every((id) => /^[0-9a-f]{16}$/.test(id))).toBe(true)
  })
})
