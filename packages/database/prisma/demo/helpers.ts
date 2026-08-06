/**
 * Shared helpers for the demo-data seed (`prisma/seed-demo.ts`).
 *
 * Randomness is deterministic (a fixed-seed LCG) so re-running the seed
 * produces the same dataset - demo screenshots, e2e expectations and manual
 * walkthroughs stay stable across runs rather than shifting every time.
 */

const SEED = 20260805

let state = SEED

/** Reset the PRNG - called at the start of every seed run for determinism. */
export function resetRandom(): void {
  state = SEED
}

/** Linear congruential generator - deterministic, adequate for demo data. */
export function rnd(): number {
  state = (state * 1664525 + 1013904223) % 4294967296
  return state / 4294967296
}

export function int(min: number, max: number): number {
  return min + Math.floor(rnd() * (max - min + 1))
}

export function pick<T>(items: readonly T[]): T {
  return items[Math.floor(rnd() * items.length)]
}

/** Pick `count` distinct items (or all of them, if the pool is smaller). */
export function pickMany<T>(items: readonly T[], count: number): T[] {
  const pool = [...items]
  const out: T[] = []
  const n = Math.min(count, pool.length)
  for (let i = 0; i < n; i += 1) out.push(...pool.splice(Math.floor(rnd() * pool.length), 1))
  return out
}

export function chance(probability: number): boolean {
  return rnd() < probability
}

/** Round to 2 decimal places - every money value in this seed goes through this. */
export function money(value: number): number {
  return Math.round(value * 100) / 100
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10
}

// ─── Dates ─────────────────────────────────────────────────────────────────
// Every date is relative to the moment the seed runs, so dashboards that
// filter on "today"/"this week" always have data regardless of when the
// database was seeded.

export const NOW = new Date()
export const YEAR = NOW.getFullYear()

export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/** `dayOffset` is relative to today: -3 = three days ago, +2 = in two days. */
export function at(dayOffset: number, hour: number, minute = 0): Date {
  const d = startOfDay(NOW)
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hour, minute, 0, 0)
  return d
}

export function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 86_400_000)
}

export function daysFromNow(days: number): Date {
  return new Date(NOW.getTime() + days * 86_400_000)
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3_600_000)
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

export function yearsAgo(years: number, monthOffset = 0): Date {
  const d = new Date(NOW)
  d.setFullYear(d.getFullYear() - years)
  d.setMonth(d.getMonth() - monthOffset)
  return d
}

// ─── Document numbering ────────────────────────────────────────────────────
// Formats mirror the API's own generators exactly (see
// `appointments.service.ts#generateAppointmentNumber` and siblings) so demo
// rows are indistinguishable in shape from ones the running app creates:
// `APT-MED-2026-000001` for org-prefixed series, `PO-2026-000001` for the
// inventory series (which the API generates without the org prefix).

// The counters are module-level rather than per-seeder: several series are
// shared across seeders (both the clinical and IPD seeders issue `RX-`
// prescription numbers, for instance), and a per-seeder counter would
// restart at 1 and collide on the `(number, organizationId)` unique index.
const counters = new Map<string, number>()

export function resetCounters(): void {
  counters.clear()
}

export function docNumber(prefix: string, orgPrefix?: string): string {
  const key = `${prefix}|${orgPrefix ?? ''}`
  const next = (counters.get(key) ?? 0) + 1
  counters.set(key, next)
  const middle = orgPrefix ? `${orgPrefix}-${YEAR}` : `${YEAR}`
  return `${prefix}-${middle}-${String(next).padStart(6, '0')}`
}

// ─── Clinical computations ─────────────────────────────────────────────────
// These mirror the server-side computations the real services perform, so
// seeded rows are internally consistent rather than holding arbitrary values.

/** Mirrors the API's BMI computation for `Vital.bmi`. */
export function computeBmi(heightCm: number, weightKg: number): number {
  const heightM = heightCm / 100
  return round1(weightKg / (heightM * heightM))
}

/** Morse-scale fall-risk banding used by the nursing assessment service. */
export function fallRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (score >= 45) return 'HIGH'
  if (score >= 25) return 'MEDIUM'
  return 'LOW'
}

/** Braden pressure-ulcer risk banding (lower score = higher risk). */
export function bradenRiskLevel(score: number): 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE' {
  if (score <= 9) return 'SEVERE'
  if (score <= 12) return 'HIGH'
  if (score <= 14) return 'MODERATE'
  return 'LOW'
}

/**
 * Charge Engine line maths (ADR-0015): discount applies to the line subtotal,
 * tax applies to the discounted amount.
 */
export function computeChargeTotals(params: {
  unitPrice: number
  quantity: number
  discountPercent?: number
  taxPercent?: number
}): { discountAmount: number; taxAmount: number; totalAmount: number } {
  const subtotal = params.unitPrice * params.quantity
  const discountAmount = money((subtotal * (params.discountPercent ?? 0)) / 100)
  const taxable = subtotal - discountAmount
  const taxAmount = money((taxable * (params.taxPercent ?? 0)) / 100)
  return { discountAmount, taxAmount, totalAmount: money(taxable + taxAmount) }
}

/** Abnormal flagging, mirroring the lab module's `abnormal-flagging.ts`. */
export function flagAbnormal(
  value: number,
  low?: number | null,
  high?: number | null,
  criticalLow?: number | null,
  criticalHigh?: number | null,
): { isAbnormal: boolean; abnormalType: 'HIGH' | 'LOW' | 'CRITICAL_HIGH' | 'CRITICAL_LOW' | null } {
  if (criticalHigh != null && value >= criticalHigh) return { isAbnormal: true, abnormalType: 'CRITICAL_HIGH' }
  if (criticalLow != null && value <= criticalLow) return { isAbnormal: true, abnormalType: 'CRITICAL_LOW' }
  if (high != null && value > high) return { isAbnormal: true, abnormalType: 'HIGH' }
  if (low != null && value < low) return { isAbnormal: true, abnormalType: 'LOW' }
  return { isAbnormal: false, abnormalType: null }
}
