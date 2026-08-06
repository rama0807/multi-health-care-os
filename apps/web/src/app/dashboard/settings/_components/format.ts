/** Display helpers for the personal Account Settings workspace. */

export { humanizeRole, initials } from '@/lib/format'

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

export interface ParsedUserAgent {
  browser: string
  os: string
}

/**
 * A deliberately small heuristic parser, not a fake "device fingerprint"
 * library - it reads the same `navigator.userAgent` / `SessionInfo.userAgent`
 * string a browser already sends, and only recognises the common cases. Good
 * enough to label "Chrome on macOS"; it will fall back to "Unknown" rather
 * than guess on anything exotic.
 */
export function parseUserAgent(userAgent: string | null | undefined): ParsedUserAgent {
  if (!userAgent) return { browser: 'Unknown browser', os: 'Unknown OS' }

  const ua = userAgent

  let browser = 'Unknown browser'
  if (/Edg\//.test(ua)) browser = 'Edge'
  else if (/OPR\//.test(ua)) browser = 'Opera'
  else if (/Firefox\//.test(ua)) browser = 'Firefox'
  else if (/CriOS\//.test(ua)) browser = 'Chrome'
  else if (/Chrome\//.test(ua)) browser = 'Chrome'
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = 'Safari'

  let os = 'Unknown OS'
  if (/Windows/.test(ua)) os = 'Windows'
  else if (/Mac OS X/.test(ua) && !/iPhone|iPad/.test(ua)) os = 'macOS'
  else if (/iPhone|iPad|iOS/.test(ua)) os = 'iOS'
  else if (/Android/.test(ua)) os = 'Android'
  else if (/Linux/.test(ua)) os = 'Linux'

  return { browser, os }
}
