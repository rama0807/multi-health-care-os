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
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString()
}

/** "organization.settings_updated" → "organization settings updated" */
export function humanizeAction(action: string): string {
  return action.replace(/[._]/g, ' ')
}

/** "DIAGNOSTIC_CENTER" → "Diagnostic center" */
export function humanizeEnum(value: string): string {
  const words = value.replace(/_/g, ' ').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** "2026-08-06T10:00:00Z" → "2h ago" / "3d ago" / a plain date once it's old. */
export function formatRelativeTime(value: string | Date | null | undefined): string {
  if (!value) return 'Never'
  const date = new Date(value)
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return date.toLocaleDateString()
}

/**
 * Renders a usage figure against its plan limit. A null limit means the plan
 * negotiated no cap - shown as "unlimited" rather than as an unbounded bar, so
 * an unlimited plan is never mistaken for a plan sitting at 0% usage.
 */
export function formatAgainstLimit(used: number, limit: number | null): string {
  return limit === null ? `${used} (unlimited)` : `${used} of ${limit}`
}

export function percentOf(used: number, limit: number | null): number | null {
  if (limit === null || limit <= 0) return null
  return Math.min(100, Math.round((used / limit) * 100))
}
