import { AiProviderUsage } from './ai-provider.interface'

/**
 * Fallback ratio for providers/streams that don't report metered usage. ~4
 * characters per token is the widely-used approximation for English prose and
 * is close enough for budgeting — but any usage derived from it is flagged
 * `estimated`, and `AiUsageLog.tokensEstimated` records that in the database,
 * so nothing downstream mistakes it for a billed count (ADR-0023).
 */
export const CHARS_PER_TOKEN = 4

export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

export function estimateUsage(promptText: string, completionText: string): AiProviderUsage {
  return {
    promptTokens: estimateTokens(promptText),
    completionTokens: estimateTokens(completionText),
    estimated: true,
  }
}

/**
 * Both rates default to 0 (see `ai.config.ts`), which yields a 0 cost meaning
 * "no price configured." Rounded to 6 decimals to match the Decimal(12,6)
 * column and keep float drift out of the stored value.
 */
export function computeCostUsd(
  promptTokens: number,
  completionTokens: number,
  inputCostPer1k: number,
  outputCostPer1k: number,
): number {
  const cost = (promptTokens / 1000) * inputCostPer1k + (completionTokens / 1000) * outputCostPer1k
  return Math.round(cost * 1_000_000) / 1_000_000
}
