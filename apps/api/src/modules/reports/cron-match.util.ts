/**
 * A minimal 5-field cron matcher (Milestone 18, closing TD-0053).
 *
 * Written rather than pulled from a package for the same reason `xlsx.util.ts`
 * was: the requirement is "did this schedule become due between the last tick
 * and now?", which is a match, not a full scheduler. A cron library brings a
 * scheduler, its own timers and its own notion of a job — all of which would
 * duplicate the queue this repo already has.
 *
 * Supported syntax, deliberately the subset `SavedReport.scheduleCron` is
 * already validated against:
 *
 *   `*`            every value
 *   `5`            an exact value
 *   `1,15`         a list
 *   `1-5`          a range
 *   `*\/15`         a step over the whole field
 *   `0-30/10`      a step over a range
 *
 * Fields are `minute hour day-of-month month day-of-week`, with day-of-week
 * `0` and `7` both meaning Sunday. Names (`MON`, `JAN`) are **not** supported;
 * `parseCron` returns null for them rather than guessing.
 *
 * Times are evaluated in the **server's local zone**, which is what every
 * other date bucket in this repo already uses (ADR-0026).
 */

export interface CronField {
  /** Every value this field matches, sorted ascending. */
  values: Set<number>
}

export interface ParsedCron {
  minute: CronField
  hour: CronField
  dayOfMonth: CronField
  month: CronField
  dayOfWeek: CronField
  /** True when both day fields are restricted — see `matchesCron`. */
  bothDaysRestricted: boolean
}

const RANGES: Array<[number, number]> = [
  [0, 59], // minute
  [0, 23], // hour
  [1, 31], // day of month
  [1, 12], // month
  [0, 6], // day of week
]

/** Returns null for anything this subset cannot express — never a guess. */
export function parseCron(expression: string): ParsedCron | null {
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) return null

  const fields: CronField[] = []
  for (let i = 0; i < 5; i += 1) {
    const field = parseField(parts[i], RANGES[i][0], RANGES[i][1], i === 4)
    if (!field) return null
    fields.push(field)
  }

  return {
    minute: fields[0],
    hour: fields[1],
    dayOfMonth: fields[2],
    month: fields[3],
    dayOfWeek: fields[4],
    bothDaysRestricted: parts[2] !== '*' && parts[4] !== '*',
  }
}

function parseField(raw: string, min: number, max: number, isDayOfWeek: boolean): CronField | null {
  const values = new Set<number>()

  for (const segment of raw.split(',')) {
    if (segment === '') return null

    const [rangePart, stepPart] = segment.split('/')
    if (segment.split('/').length > 2) return null

    let step = 1
    if (stepPart !== undefined) {
      step = Number(stepPart)
      if (!Number.isInteger(step) || step < 1) return null
    }

    let start: number
    let end: number
    if (rangePart === '*') {
      start = min
      end = max
    } else if (rangePart.includes('-')) {
      const [from, to] = rangePart.split('-')
      start = Number(from)
      end = Number(to)
      if (!Number.isInteger(start) || !Number.isInteger(end)) return null
    } else {
      start = Number(rangePart)
      // A bare value with a step means "from here to the end of the field",
      // matching the common crontab reading of `5/10`.
      end = stepPart === undefined ? start : max
      if (!Number.isInteger(start)) return null
    }

    if (start < min || end > max || start > end) {
      // Sunday is both 0 and 7 in day-of-week; normalise rather than reject.
      if (isDayOfWeek && (start === 7 || end === 7)) {
        start = start === 7 ? 0 : start
        end = end === 7 ? 0 : end
        if (start > end) return null
      } else {
        return null
      }
    }

    for (let value = start; value <= end; value += step) values.add(value)
  }

  return values.size > 0 ? { values } : null
}

/**
 * Whether `at` (to the minute) matches the expression.
 *
 * Follows crontab's day rule: when *both* day-of-month and day-of-week are
 * restricted, the schedule fires when **either** matches, not both. Getting
 * that backwards is the classic cron bug, so it is stated here rather than
 * left implicit.
 */
export function matchesCron(parsed: ParsedCron, at: Date): boolean {
  if (!parsed.minute.values.has(at.getMinutes())) return false
  if (!parsed.hour.values.has(at.getHours())) return false
  if (!parsed.month.values.has(at.getMonth() + 1)) return false

  const domMatch = parsed.dayOfMonth.values.has(at.getDate())
  const dowMatch = parsed.dayOfWeek.values.has(at.getDay())

  return parsed.bothDaysRestricted ? domMatch || dowMatch : domMatch && dowMatch
}

/**
 * Whether the schedule came due in `(after, upTo]`.
 *
 * The worker ticks on an interval, not on the minute, so "is it due right
 * now?" would miss almost every schedule. This walks the minutes since the
 * last run instead, which also means a schedule survives a worker restart:
 * the window is bounded by `maxLookbackMinutes` so a long outage replays at
 * most that much rather than firing a month of missed runs at once.
 */
export function isDueBetween(
  expression: string,
  after: Date | null,
  upTo: Date,
  maxLookbackMinutes = 24 * 60,
): boolean {
  const parsed = parseCron(expression)
  if (!parsed) return false

  const end = startOfMinute(upTo)
  const earliest = new Date(end.getTime() - maxLookbackMinutes * 60_000)
  const start = after && after > earliest ? startOfMinute(after) : earliest

  for (let cursor = new Date(start.getTime() + 60_000); cursor <= end; cursor = new Date(cursor.getTime() + 60_000)) {
    if (matchesCron(parsed, cursor)) return true
  }
  return false
}

function startOfMinute(date: Date): Date {
  const copy = new Date(date)
  copy.setSeconds(0, 0)
  return copy
}
