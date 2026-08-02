import { AbnormalType } from '@medicore/types'

import { computeAbnormalFlag } from './abnormal-flagging'

describe('computeAbnormalFlag', () => {
  it('does not flag a numeric result within the normal range', () => {
    const result = computeAbnormalFlag({
      result: '90',
      referenceRangeLow: 70,
      referenceRangeHigh: 110,
      criticalLow: null,
      criticalHigh: null,
    })
    expect(result).toEqual({ isAbnormal: false, abnormalType: null })
  })

  it('flags HIGH when above the normal range but below the derived critical threshold', () => {
    // range 70-110 (width 40), 20% => critical high = 118
    const result = computeAbnormalFlag({
      result: '115',
      referenceRangeLow: 70,
      referenceRangeHigh: 110,
      criticalLow: null,
      criticalHigh: null,
    })
    expect(result).toEqual({ isAbnormal: true, abnormalType: AbnormalType.HIGH })
  })

  it('flags LOW when below the normal range but above the derived critical threshold', () => {
    // 20% of 40 = 8, critical low = 62
    const result = computeAbnormalFlag({
      result: '65',
      referenceRangeLow: 70,
      referenceRangeHigh: 110,
      criticalLow: null,
      criticalHigh: null,
    })
    expect(result).toEqual({ isAbnormal: true, abnormalType: AbnormalType.LOW })
  })

  it('flags CRITICAL_HIGH beyond the derived critical threshold', () => {
    const result = computeAbnormalFlag({
      result: '130',
      referenceRangeLow: 70,
      referenceRangeHigh: 110,
      criticalLow: null,
      criticalHigh: null,
    })
    expect(result).toEqual({ isAbnormal: true, abnormalType: AbnormalType.CRITICAL_HIGH })
  })

  it('flags CRITICAL_LOW beyond the derived critical threshold', () => {
    const result = computeAbnormalFlag({
      result: '40',
      referenceRangeLow: 70,
      referenceRangeHigh: 110,
      criticalLow: null,
      criticalHigh: null,
    })
    expect(result).toEqual({ isAbnormal: true, abnormalType: AbnormalType.CRITICAL_LOW })
  })

  it('uses an explicit critical bound instead of the derived one when provided', () => {
    const result = computeAbnormalFlag({
      result: '116',
      referenceRangeLow: 70,
      referenceRangeHigh: 110,
      criticalLow: 40,
      criticalHigh: 115,
    })
    expect(result).toEqual({ isAbnormal: true, abnormalType: AbnormalType.CRITICAL_HIGH })
  })

  it('does not auto-flag a non-numeric (qualitative) result', () => {
    const result = computeAbnormalFlag({
      result: 'Non-reactive',
      referenceRangeLow: null,
      referenceRangeHigh: null,
      criticalLow: null,
      criticalHigh: null,
    })
    expect(result).toEqual({ isAbnormal: false, abnormalType: null })
  })

  it('does not flag when no numeric reference range exists at all', () => {
    const result = computeAbnormalFlag({
      result: '42',
      referenceRangeLow: null,
      referenceRangeHigh: null,
      criticalLow: null,
      criticalHigh: null,
    })
    expect(result).toEqual({ isAbnormal: false, abnormalType: null })
  })

  it('handles a one-sided range (only a lower bound)', () => {
    // low=10, no high; 20% of |10| = 2, critical low = 8
    expect(computeAbnormalFlag({ result: '9', referenceRangeLow: 10, referenceRangeHigh: null, criticalLow: null, criticalHigh: null })).toEqual({
      isAbnormal: true,
      abnormalType: AbnormalType.LOW,
    })
    expect(computeAbnormalFlag({ result: '7', referenceRangeLow: 10, referenceRangeHigh: null, criticalLow: null, criticalHigh: null })).toEqual({
      isAbnormal: true,
      abnormalType: AbnormalType.CRITICAL_LOW,
    })
  })

  it('treats an empty string as non-numeric', () => {
    const result = computeAbnormalFlag({
      result: '',
      referenceRangeLow: 70,
      referenceRangeHigh: 110,
      criticalLow: null,
      criticalHigh: null,
    })
    expect(result).toEqual({ isAbnormal: false, abnormalType: null })
  })
})
