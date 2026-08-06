import { formatRelativeTime, humanizeRole, initials, parseUserAgent } from './format'

describe('initials', () => {
  it('takes the first letter of each name and uppercases it', () => {
    expect(initials('Aarav', 'Sharma')).toBe('AS')
    expect(initials('priya', 'mehta')).toBe('PM')
  })

  it('tolerates a missing name half', () => {
    expect(initials('', 'Sharma')).toBe('S')
    expect(initials('Aarav', '')).toBe('A')
  })
})

describe('humanizeRole', () => {
  it('turns a SCREAMING_SNAKE_CASE role into title case', () => {
    expect(humanizeRole('ORG_ADMIN')).toBe('Org Admin')
    expect(humanizeRole('LAB_TECHNICIAN')).toBe('Lab Technician')
    expect(humanizeRole('DOCTOR')).toBe('Doctor')
  })
})

describe('formatRelativeTime', () => {
  it('reports "Never" for a missing value', () => {
    expect(formatRelativeTime(null)).toBe('Never')
    expect(formatRelativeTime(undefined)).toBe('Never')
  })

  it('reports minutes, hours and days for recent timestamps', () => {
    const now = Date.now()
    expect(formatRelativeTime(new Date(now - 30_000))).toBe('Just now')
    expect(formatRelativeTime(new Date(now - 5 * 60_000))).toBe('5m ago')
    expect(formatRelativeTime(new Date(now - 3 * 3_600_000))).toBe('3h ago')
    expect(formatRelativeTime(new Date(now - 2 * 86_400_000))).toBe('2d ago')
  })
})

describe('parseUserAgent', () => {
  it('recognises common browser/OS combinations', () => {
    expect(
      parseUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ),
    ).toEqual({ browser: 'Chrome', os: 'Windows' })

    expect(
      parseUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      ),
    ).toEqual({ browser: 'Safari', os: 'macOS' })

    expect(
      parseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/120.0.0.0 Mobile'),
    ).toEqual({ browser: 'Chrome', os: 'iOS' })
  })

  it('falls back to unknown for a missing or unrecognised user agent', () => {
    expect(parseUserAgent(null)).toEqual({ browser: 'Unknown browser', os: 'Unknown OS' })
    expect(parseUserAgent('')).toEqual({ browser: 'Unknown browser', os: 'Unknown OS' })
  })
})
