import {
  ReportAmountSeriesPoint,
  ReportAmountComparison,
  ReportBreakdown,
  ReportComparison,
  ReportFilterQuery,
  ReportGroupBy,
  ReportPeriod,
  ReportSeriesPoint,
} from '@medicore/types'
import { BadRequestException } from '@nestjs/common'

/** Default window when the caller supplies neither `from` nor `to`. */
export const DEFAULT_RANGE_DAYS = 30

/**
 * Hard ceiling on a report window. Every report buckets in JS over rows it
 * fetched (the same approach `BillingDashboardService.collectionTrend`
 * already uses), so an unbounded range is a real memory risk rather than
 * just a slow query - see TECH_DEBT TD-0054.
 */
export const MAX_RANGE_DAYS = 400

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * A resolved reporting window. `to` is **exclusive** - every query in this
 * module uses `{ gte: from, lt: to }` so a row timestamped at 23:59:59 on
 * the last requested day is counted exactly once and never twice.
 */
export interface ResolvedRange {
  from: Date
  to: Date
  groupBy: ReportGroupBy
  /** The equal-length window immediately before `from`, for comparisons. */
  previousFrom: Date
  previousTo: Date
  days: number
}

/** Local-midnight start of the day containing `date`. */
export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** Monday-based week start, matching the ISO week convention. */
export function startOfWeek(date: Date): Date {
  const d = startOfDay(date)
  // getDay(): 0 = Sunday. Shift so Monday is the first day of the week.
  const offset = (d.getDay() + 6) % 7
  return addDays(d, -offset)
}

export function startOfMonth(date: Date): Date {
  const d = startOfDay(date)
  d.setDate(1)
  return d
}

/** `YYYY-MM-DD` in local time - never `toISOString()`, which would shift the day in +05:30. */
export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseBoundary(value: string, label: string): Date {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`"${label}" is not a valid date (expected YYYY-MM-DD)`)
  }
  return parsed
}

/**
 * Normalises a caller's filters into a concrete window. Defaults to the
 * last {@link DEFAULT_RANGE_DAYS} days ending at the end of today.
 */
export function resolveRange(query: ReportFilterQuery = {}, now: Date = new Date()): ResolvedRange {
  const groupBy: ReportGroupBy = query.groupBy ?? 'day'

  // `to` is exclusive, so the default end is the start of *tomorrow* -
  // that is what makes "today" fully included.
  const to = query.to ? addDays(startOfDay(parseBoundary(query.to, 'to')), 1) : addDays(startOfDay(now), 1)
  const from = query.from ? startOfDay(parseBoundary(query.from, 'from')) : addDays(to, -DEFAULT_RANGE_DAYS)

  if (from >= to) {
    throw new BadRequestException('"from" must be earlier than "to"')
  }

  const days = Math.round((to.getTime() - from.getTime()) / MS_PER_DAY)
  if (days > MAX_RANGE_DAYS) {
    throw new BadRequestException(`Reporting range is limited to ${MAX_RANGE_DAYS} days (requested ${days})`)
  }

  return {
    from,
    to,
    groupBy,
    previousFrom: addDays(from, -days),
    previousTo: from,
    days,
  }
}

export function toPeriod(range: ResolvedRange): ReportPeriod {
  return {
    from: toDateKey(range.from),
    // Echo the *inclusive* last day back to the caller - `to` is exclusive
    // internally, but "2026-08-05" is what the user asked for and expects.
    to: toDateKey(addDays(range.to, -1)),
    groupBy: range.groupBy,
    days: range.days,
  }
}

/** The bucket a timestamp belongs to, as a `YYYY-MM-DD` key. */
export function bucketKeyFor(date: Date, groupBy: ReportGroupBy): string {
  if (groupBy === 'month') return toDateKey(startOfMonth(date))
  if (groupBy === 'week') return toDateKey(startOfWeek(date))
  return toDateKey(startOfDay(date))
}

/**
 * Every bucket in the range, in order - including empty ones, so a chart
 * shows a real gap rather than silently closing over a day with no data.
 */
export function bucketKeys(range: ResolvedRange): string[] {
  const keys: string[] = []
  const seen = new Set<string>()
  let cursor =
    range.groupBy === 'month'
      ? startOfMonth(range.from)
      : range.groupBy === 'week'
        ? startOfWeek(range.from)
        : startOfDay(range.from)

  while (cursor < range.to) {
    const key = toDateKey(cursor)
    if (!seen.has(key)) {
      seen.add(key)
      keys.push(key)
    }
    cursor =
      range.groupBy === 'month'
        ? new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
        : addDays(cursor, range.groupBy === 'week' ? 7 : 1)
  }
  return keys
}

/** Counts rows into a zero-filled time series keyed by each row's date. */
export function countSeries<T>(
  rows: T[],
  range: ResolvedRange,
  dateOf: (row: T) => Date | null,
): ReportSeriesPoint[] {
  const totals = new Map<string, number>(bucketKeys(range).map((key) => [key, 0]))
  for (const row of rows) {
    const date = dateOf(row)
    if (!date) continue
    const key = bucketKeyFor(date, range.groupBy)
    if (totals.has(key)) totals.set(key, (totals.get(key) as number) + 1)
  }
  return [...totals.entries()].map(([bucket, value]) => ({ bucket, value }))
}

/** Sums a numeric field into a zero-filled monetary time series. */
export function amountSeries<T>(
  rows: T[],
  range: ResolvedRange,
  dateOf: (row: T) => Date | null,
  amountOf: (row: T) => number,
): ReportAmountSeriesPoint[] {
  const totals = new Map<string, number>(bucketKeys(range).map((key) => [key, 0]))
  for (const row of rows) {
    const date = dateOf(row)
    if (!date) continue
    const key = bucketKeyFor(date, range.groupBy)
    if (totals.has(key)) totals.set(key, (totals.get(key) as number) + amountOf(row))
  }
  return [...totals.entries()].map(([bucket, amount]) => ({ bucket, amount: amount.toFixed(2) }))
}

/**
 * Percentage change from `previous` to `current`, rounded to one decimal.
 * Null when `previous` is 0 - growth from nothing is undefined, and
 * reporting it as 0% or 100% would both be lies.
 */
export function changePercent(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

export function comparison(current: number, previous: number): ReportComparison {
  return { current, previous, changePercent: changePercent(current, previous) }
}

export function amountComparison(current: number, previous: number): ReportAmountComparison {
  return {
    current: current.toFixed(2),
    previous: previous.toFixed(2),
    changePercent: changePercent(current, previous),
  }
}

/** Percentage of `total`, rounded to one decimal; 0 when `total` is 0. */
export function percentOf(part: number, total: number): number {
  if (total === 0) return 0
  return Math.round((part / total) * 1000) / 10
}

/** Mean of a sample, rounded to one decimal; null for an empty sample. */
export function average(values: number[]): number | null {
  if (values.length === 0) return null
  const sum = values.reduce((total, value) => total + value, 0)
  return Math.round((sum / values.length) * 10) / 10
}

/** `Decimal | number | string | null` to number. Prisma `Decimal` stringifies exactly. */
export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function sumBy<T>(rows: T[], amountOf: (row: T) => number): number {
  return rows.reduce((total, row) => total + amountOf(row), 0)
}

/**
 * Turns Prisma `groupBy` output into label/count breakdowns, sorted
 * descending so the biggest slice leads every pie/bar chart.
 */
export function toBreakdown<T extends { _count: number | Record<string, number> }>(
  groups: T[],
  labelOf: (group: T) => string,
): ReportBreakdown[] {
  return groups
    .map((group) => ({
      label: labelOf(group),
      count: typeof group._count === 'number' ? group._count : Object.values(group._count)[0],
    }))
    .sort((a, b) => b.count - a.count)
}

/** Whole days between two instants, to one decimal. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round(((to.getTime() - from.getTime()) / MS_PER_DAY) * 10) / 10
}

/** Hours between two instants, to one decimal. */
export function hoursBetween(from: Date, to: Date): number {
  return Math.round(((to.getTime() - from.getTime()) / (60 * 60 * 1000)) * 10) / 10
}

/** Minutes between two instants, to one decimal. */
export function minutesBetween(from: Date, to: Date): number {
  return Math.round(((to.getTime() - from.getTime()) / 60000) * 10) / 10
}

/** Age in whole years at `on` - the same calculation the patient module uses. */
export function ageInYears(dateOfBirth: Date, on: Date): number {
  let age = on.getFullYear() - dateOfBirth.getFullYear()
  const monthDelta = on.getMonth() - dateOfBirth.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && on.getDate() < dateOfBirth.getDate())) age--
  return Math.max(0, age)
}
