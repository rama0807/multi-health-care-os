import { ScheduleShift, Weekday } from '@medicore/types'

const WEEKDAY_BY_JS_DAY: Weekday[] = [
  Weekday.SUNDAY,
  Weekday.MONDAY,
  Weekday.TUESDAY,
  Weekday.WEDNESDAY,
  Weekday.THURSDAY,
  Weekday.FRIDAY,
  Weekday.SATURDAY,
]

export function weekdayOf(date: Date): Weekday {
  return WEEKDAY_BY_JS_DAY[date.getDay()]
}

export function parseDateOnly(dateStr: string): Date {
  const date = new Date(`${dateStr}T00:00:00`)
  date.setHours(0, 0, 0, 0)
  return date
}

export function toMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number)
  return hours * 60 + minutes
}

export function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

export function combineDateAndMinutes(date: Date, minutesFromMidnight: number): Date {
  const result = new Date(date)
  result.setHours(0, minutesFromMidnight, 0, 0)
  return result
}

/**
 * Formats a Date as a naive local-wall-clock ISO-like string (no UTC
 * conversion, no timezone offset). `.toISOString()` would convert through
 * UTC and shift the displayed clock time by the server's offset from the
 * organization's timezone — since nothing else in this codebase does
 * per-org timezone-aware conversion yet (see TECH_DEBT), this keeps
 * schedule/availability timestamps showing the intended wall-clock time
 * regardless of where the API process happens to run.
 */
export function toLocalIsoString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
}

/**
 * Local calendar date as YYYY-MM-DD. `date.toISOString().slice(0, 10)` is
 * NOT equivalent — it goes through UTC and can land on the wrong calendar
 * day for any local time within one UTC-offset of midnight (e.g. 00:30 IST
 * is still 2026-08-02T19:00Z the previous UTC day).
 */
export function toLocalDateString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Converts a local-calendar-day Date (e.g. from `parseDateOnly`) to the
 * UTC-midnight Date Prisma reads/writes for `@db.Date` columns, so
 * `where` comparisons against `effectiveFrom`/`startDate`/`endDate` land on
 * the intended calendar day instead of being off by the server's UTC
 * offset. Read the *local* date components, then re-anchor at UTC midnight
 * — this is the bridge between "the hospital's calendar day" (local
 * getters) and "what Postgres DATE actually stores" (UTC midnight).
 */
export function toDbDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
}

export function overlapsAnyBreak(shift: ScheduleShift, slotStart: number, slotEnd: number): boolean {
  return (shift.breaks ?? []).some(
    (b) => slotStart < toMinutes(b.endTime) && slotEnd > toMinutes(b.startTime),
  )
}

export function isNowWithinShift(shift: ScheduleShift, nowMinutes: number): boolean {
  const start = toMinutes(shift.startTime)
  const end = toMinutes(shift.endTime)
  if (nowMinutes < start || nowMinutes >= end) return false
  return !(shift.breaks ?? []).some(
    (b) => nowMinutes >= toMinutes(b.startTime) && nowMinutes < toMinutes(b.endTime),
  )
}
