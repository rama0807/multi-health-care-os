import { Weekday } from '@medicore/types'

import {
  combineDateAndMinutes,
  isNowWithinShift,
  overlapsAnyBreak,
  parseDateOnly,
  toMinutes,
  weekdayOf,
} from './availability.util'

describe('availability.util', () => {
  describe('toMinutes', () => {
    it('converts HH:mm to minutes since midnight', () => {
      expect(toMinutes('00:00')).toBe(0)
      expect(toMinutes('09:30')).toBe(570)
      expect(toMinutes('23:59')).toBe(1439)
    })
  })

  describe('weekdayOf', () => {
    it('maps a date to the correct Weekday', () => {
      expect(weekdayOf(parseDateOnly('2026-08-03'))).toBe(Weekday.MONDAY)
      expect(weekdayOf(parseDateOnly('2026-08-02'))).toBe(Weekday.SUNDAY)
      expect(weekdayOf(parseDateOnly('2026-08-08'))).toBe(Weekday.SATURDAY)
    })
  })

  describe('combineDateAndMinutes', () => {
    it('produces a Date at the given minute offset on the given day', () => {
      const date = parseDateOnly('2026-08-03')
      const combined = combineDateAndMinutes(date, 9 * 60 + 30)
      expect(combined.getHours()).toBe(9)
      expect(combined.getMinutes()).toBe(30)
      expect(combined.getDate()).toBe(3)
    })
  })

  describe('overlapsAnyBreak', () => {
    const shift = {
      startTime: '09:00',
      endTime: '13:00',
      slotDurationMinutes: 15,
      breaks: [{ startTime: '11:00', endTime: '11:15' }],
    }

    it('detects a slot that overlaps a break', () => {
      expect(overlapsAnyBreak(shift, toMinutes('11:00'), toMinutes('11:15'))).toBe(true)
      expect(overlapsAnyBreak(shift, toMinutes('10:50'), toMinutes('11:05'))).toBe(true)
    })

    it('allows a slot that does not touch the break', () => {
      expect(overlapsAnyBreak(shift, toMinutes('09:00'), toMinutes('09:15'))).toBe(false)
      expect(overlapsAnyBreak(shift, toMinutes('11:15'), toMinutes('11:30'))).toBe(false)
    })
  })

  describe('isNowWithinShift', () => {
    const shift = {
      startTime: '09:00',
      endTime: '13:00',
      slotDurationMinutes: 15,
      breaks: [{ startTime: '11:00', endTime: '11:15' }],
    }

    it('is true inside the shift and outside any break', () => {
      expect(isNowWithinShift(shift, toMinutes('10:00'))).toBe(true)
    })

    it('is false during a break', () => {
      expect(isNowWithinShift(shift, toMinutes('11:05'))).toBe(false)
    })

    it('is false outside the shift window', () => {
      expect(isNowWithinShift(shift, toMinutes('08:00'))).toBe(false)
      expect(isNowWithinShift(shift, toMinutes('13:00'))).toBe(false)
    })
  })
})
