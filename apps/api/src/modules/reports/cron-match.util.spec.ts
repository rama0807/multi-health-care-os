import { isDueBetween, matchesCron, parseCron } from './cron-match.util'

/** Local-time helper — the matcher evaluates in the server's zone by design. */
function at(iso: string): Date {
  return new Date(iso)
}

describe('parseCron', () => {
  it('accepts the supported syntax', () => {
    expect(parseCron('0 9 * * *')).not.toBeNull()
    expect(parseCron('*/15 * * * *')).not.toBeNull()
    expect(parseCron('0 0-6/2 * * *')).not.toBeNull()
    expect(parseCron('0 9 1,15 * *')).not.toBeNull()
    expect(parseCron('30 8 * * 1-5')).not.toBeNull()
  })

  it('rejects anything outside it rather than guessing', () => {
    expect(parseCron('0 9 * *')).toBeNull() // too few fields
    expect(parseCron('0 9 * * * *')).toBeNull() // too many
    expect(parseCron('0 24 * * *')).toBeNull() // hour out of range
    expect(parseCron('60 9 * * *')).toBeNull() // minute out of range
    expect(parseCron('0 9 * * MON')).toBeNull() // names unsupported
    expect(parseCron('0 9/0 * * *')).toBeNull() // zero step
    expect(parseCron('0 9-5 * * *')).toBeNull() // inverted range
    expect(parseCron('')).toBeNull()
  })

  it('treats day-of-week 7 as Sunday', () => {
    const parsed = parseCron('0 9 * * 7')
    expect(parsed?.dayOfWeek.values.has(0)).toBe(true)
  })

  it('expands a step over a range', () => {
    const parsed = parseCron('0 0-6/2 * * *')
    expect([...(parsed?.hour.values ?? [])].sort((a, b) => a - b)).toEqual([0, 2, 4, 6])
  })
})

describe('matchesCron', () => {
  it('matches a daily time', () => {
    const parsed = parseCron('0 9 * * *')!
    expect(matchesCron(parsed, at('2026-08-06T09:00:00'))).toBe(true)
    expect(matchesCron(parsed, at('2026-08-06T09:01:00'))).toBe(false)
    expect(matchesCron(parsed, at('2026-08-06T10:00:00'))).toBe(false)
  })

  it('matches every 15 minutes', () => {
    const parsed = parseCron('*/15 * * * *')!
    expect(matchesCron(parsed, at('2026-08-06T09:00:00'))).toBe(true)
    expect(matchesCron(parsed, at('2026-08-06T09:15:00'))).toBe(true)
    expect(matchesCron(parsed, at('2026-08-06T09:16:00'))).toBe(false)
  })

  it('ORs the two day fields when both are restricted, as crontab does', () => {
    // "09:00 on the 1st of the month, or on a Monday" — not "both".
    const parsed = parseCron('0 9 1 * 1')!
    // 2026-08-03 is a Monday and not the 1st.
    expect(matchesCron(parsed, at('2026-08-03T09:00:00'))).toBe(true)
    // 2026-08-01 is a Saturday and is the 1st.
    expect(matchesCron(parsed, at('2026-08-01T09:00:00'))).toBe(true)
    // 2026-08-04 is a Tuesday and not the 1st.
    expect(matchesCron(parsed, at('2026-08-04T09:00:00'))).toBe(false)
  })

  it('ANDs the day fields when only one is restricted', () => {
    const weekdays = parseCron('0 9 * * 1-5')!
    expect(matchesCron(weekdays, at('2026-08-03T09:00:00'))).toBe(true) // Monday
    expect(matchesCron(weekdays, at('2026-08-08T09:00:00'))).toBe(false) // Saturday
  })
})

describe('isDueBetween', () => {
  it('fires for a schedule that came due since the last run', () => {
    // Worker ticked at 08:59 and again at 09:05; the 09:00 slot is inside.
    expect(isDueBetween('0 9 * * *', at('2026-08-06T08:59:00'), at('2026-08-06T09:05:00'))).toBe(true)
  })

  it('does not fire twice for the same slot', () => {
    // Already ran at 09:00; the next tick at 09:05 must not re-fire it.
    expect(isDueBetween('0 9 * * *', at('2026-08-06T09:00:00'), at('2026-08-06T09:05:00'))).toBe(false)
  })

  it('does not fire when the slot has not arrived', () => {
    expect(isDueBetween('0 9 * * *', at('2026-08-06T08:00:00'), at('2026-08-06T08:30:00'))).toBe(false)
  })

  it('catches up a schedule missed while the worker was down', () => {
    // Down from 08:00 to 12:00 — the 09:00 slot is still delivered.
    expect(isDueBetween('0 9 * * *', at('2026-08-06T08:00:00'), at('2026-08-06T12:00:00'))).toBe(true)
  })

  it('bounds the catch-up window instead of replaying a month of runs', () => {
    // Last run 40 days ago, lookback 60 minutes: only the last hour is walked,
    // so a long outage delivers at most one recent slot, not forty.
    expect(isDueBetween('0 9 * * *', at('2026-06-27T09:00:00'), at('2026-08-06T12:00:00'), 60)).toBe(false)
    expect(isDueBetween('0 12 * * *', at('2026-06-27T09:00:00'), at('2026-08-06T12:00:00'), 60)).toBe(true)
  })

  it('treats a never-run schedule as due if a slot falls in the lookback window', () => {
    expect(isDueBetween('0 9 * * *', null, at('2026-08-06T09:30:00'))).toBe(true)
  })

  it('never fires for an expression it cannot parse', () => {
    expect(isDueBetween('not a cron', null, at('2026-08-06T09:30:00'))).toBe(false)
  })
})
