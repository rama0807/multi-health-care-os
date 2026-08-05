/** Shared display helpers for the Organization Dashboard and Platform console. */

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'

  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  // Whole bytes never need a decimal; larger units read better with one.
  return `${unitIndex === 0 ? value : value.toFixed(1)} ${BYTE_UNITS[unitIndex]}`
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}

/** "organization.settings_updated" → "organization settings updated" */
export function humanizeAction(action: string): string {
  return action.replace(/[._]/g, ' ')
}

/**
 * Renders a usage figure against its plan limit. A null limit means the plan
 * negotiated no cap — shown as "unlimited" rather than as an unbounded bar, so
 * an unlimited plan is never mistaken for a plan sitting at 0% usage.
 */
export function formatAgainstLimit(used: number, limit: number | null): string {
  return limit === null ? `${used} (unlimited)` : `${used} of ${limit}`
}

export function percentOf(used: number, limit: number | null): number | null {
  if (limit === null || limit <= 0) return null
  return Math.min(100, Math.round((used / limit) * 100))
}
