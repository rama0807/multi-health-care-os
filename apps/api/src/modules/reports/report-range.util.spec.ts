import { BadRequestException } from '@nestjs/common'

import {
  MAX_RANGE_DAYS,
  ageInYears,
  amountSeries,
  bucketKeys,
  changePercent,
  countSeries,
  daysBetween,
  percentOf,
  resolveRange,
  toDateKey,
  toPeriod,
} from './report-range.util'

describe('report-range.util', () => {
  describe('resolveRange', () => {
    const now = new Date(2026, 7, 5, 14, 30) // 2026-08-05, mid-afternoon

    it('defaults to the last 30 days ending at the end of today', () => {
      const range = resolveRange({}, now)

      expect(range.days).toBe(30)
      // `to` is exclusive, so it must be the start of tomorrow for today to
      // be fully included — the single most common off-by-one in reporting.
      expect(toDateKey(range.to)).toBe('2026-08-06')
      expect(toDateKey(range.from)).toBe('2026-07-07')
    })

    it('echoes the inclusive last day back to the caller', () => {
      const period = toPeriod(resolveRange({ from: '2026-08-01', to: '2026-08-05' }, now))

      expect(period.from).toBe('2026-08-01')
      expect(period.to).toBe('2026-08-05')
      expect(period.days).toBe(5)
    })

    it('includes a row timestamped late on the last requested day', () => {
      const range = resolveRange({ from: '2026-08-01', to: '2026-08-05' }, now)
      const lateOnLastDay = new Date(2026, 7, 5, 23, 59, 59)

      expect(lateOnLastDay >= range.from && lateOnLastDay < range.to).toBe(true)
    })

    it('derives a previous window of equal length immediately before the range', () => {
      const range = resolveRange({ from: '2026-08-01', to: '2026-08-05' }, now)

      expect(toDateKey(range.previousFrom)).toBe('2026-07-27')
      expect(toDateKey(range.previousTo)).toBe('2026-08-01')
    })

    it('rejects an inverted range', () => {
      expect(() => resolveRange({ from: '2026-08-05', to: '2026-08-01' }, now)).toThrow(BadRequestException)
    })

    it('rejects an unparseable boundary rather than silently defaulting', () => {
      expect(() => resolveRange({ from: 'last-tuesday' }, now)).toThrow(BadRequestException)
    })

    it(`rejects a range longer than ${MAX_RANGE_DAYS} days`, () => {
      expect(() => resolveRange({ from: '2020-01-01', to: '2026-08-05' }, now)).toThrow(BadRequestException)
    })
  })

  describe('bucketKeys', () => {
    it('emits one key per day, including days with no data', () => {
      const range = resolveRange({ from: '2026-08-01', to: '2026-08-05', groupBy: 'day' })

      expect(bucketKeys(range)).toEqual([
        '2026-08-01',
        '2026-08-02',
        '2026-08-03',
        '2026-08-04',
        '2026-08-05',
      ])
    })

    it('buckets weeks from Monday', () => {
      // 2026-08-05 is a Wednesday; its week starts Monday 2026-08-03.
      const range = resolveRange({ from: '2026-08-05', to: '2026-08-11', groupBy: 'week' })

      expect(bucketKeys(range)).toEqual(['2026-08-03', '2026-08-10'])
    })

    it('buckets months from the first of the month', () => {
      const range = resolveRange({ from: '2026-06-15', to: '2026-08-05', groupBy: 'month' })

      expect(bucketKeys(range)).toEqual(['2026-06-01', '2026-07-01', '2026-08-01'])
    })
  })

  describe('countSeries', () => {
    it('zero-fills empty buckets so a gap is visible rather than closed over', () => {
      const range = resolveRange({ from: '2026-08-01', to: '2026-08-03', groupBy: 'day' })
      const rows = [{ at: new Date(2026, 7, 1, 9) }, { at: new Date(2026, 7, 3, 9) }]

      expect(countSeries(rows, range, (r) => r.at)).toEqual([
        { bucket: '2026-08-01', value: 1 },
        { bucket: '2026-08-02', value: 0 },
        { bucket: '2026-08-03', value: 1 },
      ])
    })

    it('skips rows with a null date instead of counting them in the first bucket', () => {
      const range = resolveRange({ from: '2026-08-01', to: '2026-08-02', groupBy: 'day' })
      const rows: Array<{ at: Date | null }> = [{ at: null }, { at: new Date(2026, 7, 1, 9) }]

      expect(countSeries(rows, range, (r) => r.at)).toEqual([
        { bucket: '2026-08-01', value: 1 },
        { bucket: '2026-08-02', value: 0 },
      ])
    })
  })

  describe('amountSeries', () => {
    it('sums amounts per bucket as fixed-2 strings', () => {
      const range = resolveRange({ from: '2026-08-01', to: '2026-08-02', groupBy: 'day' })
      const rows = [
        { at: new Date(2026, 7, 1), amount: 100.5 },
        { at: new Date(2026, 7, 1), amount: 49.5 },
      ]

      expect(
        amountSeries(
          rows,
          range,
          (r) => r.at,
          (r) => r.amount,
        ),
      ).toEqual([
        { bucket: '2026-08-01', amount: '150.00' },
        { bucket: '2026-08-02', amount: '0.00' },
      ])
    })
  })

  describe('changePercent', () => {
    it('reports growth from zero as null rather than 0 or 100', () => {
      expect(changePercent(50, 0)).toBeNull()
    })

    it('rounds to one decimal', () => {
      expect(changePercent(110, 100)).toBe(10)
      expect(changePercent(1, 3)).toBe(-66.7)
    })
  })

  describe('percentOf', () => {
    it('returns 0 rather than NaN when the denominator is zero', () => {
      expect(percentOf(5, 0)).toBe(0)
    })
  })

  describe('ageInYears', () => {
    it('does not count a birthday that has not happened yet this year', () => {
      expect(ageInYears(new Date(2000, 11, 25), new Date(2026, 7, 5))).toBe(25)
      expect(ageInYears(new Date(2000, 0, 1), new Date(2026, 7, 5))).toBe(26)
    })

    it('never reports a negative age for a future date of birth', () => {
      expect(ageInYears(new Date(2030, 0, 1), new Date(2026, 7, 5))).toBe(0)
    })
  })

  describe('daysBetween', () => {
    it('measures elapsed days to one decimal', () => {
      expect(daysBetween(new Date(2026, 7, 1), new Date(2026, 7, 4))).toBe(3)
    })
  })
})
