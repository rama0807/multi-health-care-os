import { AbnormalType } from '@medicore/types'

export interface AbnormalFlagInput {
  result: string
  referenceRangeLow: number | null
  referenceRangeHigh: number | null
  criticalLow: number | null
  criticalHigh: number | null
}

export interface AbnormalFlagResult {
  isAbnormal: boolean
  abnormalType: AbnormalType | null
}

/**
 * Server-side abnormal-value computation. This is clinical-safety-adjacent,
 * so the exact rule is disclosed here rather than buried in logic (mirrors
 * how the drug-interaction check's limits are disclosed - see TECH_DEBT):
 *
 *  - Only a result that parses as a finite number is auto-flagged. A
 *    qualitative result (e.g. "Negative", "Reactive", free text) is left
 *    alone here - the caller may still record `isAbnormalOverride`
 *    manually, but this function never coerces text into a number.
 *  - With no numeric reference range at all (both bounds null), nothing can
 *    be auto-flagged.
 *  - A numeric result outside `[referenceRangeLow, referenceRangeHigh]` is
 *    flagged HIGH or LOW.
 *  - "Critical" bounds use the catalog/item's own explicit `criticalLow`/
 *    `criticalHigh` when provided. When they are not provided, a critical
 *    threshold is derived as the normal bound extended by 20% of the normal
 *    range's width (e.g. `criticalHigh = high + 0.2 * (high - low)`). If
 *    only one side of the normal range is defined, the same 20% is applied
 *    to that bound's own magnitude instead of a range width. This 20%
 *    multiplier is a deliberately simple, disclosed heuristic - not a
 *    clinical guideline - and should be replaced with real per-analyte
 *    critical values (e.g. from a lab information system) when one is
 *    integrated; see TECH_DEBT.
 */
export function computeAbnormalFlag(input: AbnormalFlagInput): AbnormalFlagResult {
  const parsed = Number(input.result)
  const isNumeric = input.result.trim() !== '' && Number.isFinite(parsed)
  if (!isNumeric) return { isAbnormal: false, abnormalType: null }

  const { referenceRangeLow: low, referenceRangeHigh: high } = input
  if (low === null && high === null) return { isAbnormal: false, abnormalType: null }

  const rangeWidth = low !== null && high !== null ? high - low : null

  const criticalLow =
    input.criticalLow ?? (low !== null ? low - 0.2 * (rangeWidth ?? Math.abs(low)) : null)
  const criticalHigh =
    input.criticalHigh ?? (high !== null ? high + 0.2 * (rangeWidth ?? Math.abs(high)) : null)

  if (criticalLow !== null && parsed < criticalLow) {
    return { isAbnormal: true, abnormalType: AbnormalType.CRITICAL_LOW }
  }
  if (criticalHigh !== null && parsed > criticalHigh) {
    return { isAbnormal: true, abnormalType: AbnormalType.CRITICAL_HIGH }
  }
  if (low !== null && parsed < low) {
    return { isAbnormal: true, abnormalType: AbnormalType.LOW }
  }
  if (high !== null && parsed > high) {
    return { isAbnormal: true, abnormalType: AbnormalType.HIGH }
  }
  return { isAbnormal: false, abnormalType: null }
}
