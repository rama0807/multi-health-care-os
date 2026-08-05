import { AI_FEATURES, AiFeature, AiProviderType } from '@medicore/types'
import { registerAs } from '@nestjs/config'

/**
 * Default model per provider, used when `AI_MODEL` is unset. Deliberately not
 * a per-feature routing table — that is Checkpoint 15.5's job (ADR-0023).
 */
const DEFAULT_MODELS: Record<AiProviderType, string> = {
  OPENAI: 'gpt-4o-mini',
  ANTHROPIC: 'claude-sonnet-5',
  GEMINI: 'gemini-1.5-pro',
  OLLAMA: 'llama3.1',
}

/**
 * `apps/api/.env` ships placeholder credentials (`sk-xxxxxxxxxxxx`,
 * `sk-ant-xxxxxxxxxxxx`). Treating those as "configured" would send real
 * requests that fail with a provider 401 — an error that looks like an outage
 * rather than what it is: no credential. So a run of 6+ `x`s reads as absent,
 * and the API reports an honest "not configured" instead (ADR-0023 / TD-0041).
 */
const PLACEHOLDER_KEY = /x{6,}/i

function realKey(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed || PLACEHOLDER_KEY.test(trimmed)) return undefined
  return trimmed
}

function toProvider(value: string | undefined): AiProviderType {
  const upper = value?.trim().toUpperCase()
  const known: AiProviderType[] = ['OPENAI', 'ANTHROPIC', 'GEMINI', 'OLLAMA']
  return known.find((p) => p === upper) ?? 'OPENAI'
}

function toInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function toFloat(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? '')
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

/** `AI_DISABLED_FEATURES=SOAP_NOTE,REFERRAL_LETTER` — unknown names are ignored. */
function toDisabledFeatures(value: string | undefined): AiFeature[] {
  const names = (value ?? '')
    .split(',')
    .map((name) => name.trim().toUpperCase())
    .filter(Boolean)
  return AI_FEATURES.filter((feature) => names.includes(feature))
}

export default registerAs('ai', () => {
  const provider = toProvider(process.env.AI_PROVIDER)

  return {
    /** Global kill switch. Anything other than an explicit "false" leaves AI on. */
    enabled: process.env.AI_ENABLED !== 'false',
    provider,
    model: process.env.AI_MODEL?.trim() || DEFAULT_MODELS[provider],
    disabledFeatures: toDisabledFeatures(process.env.AI_DISABLED_FEATURES),
    maxOutputTokens: toInt(process.env.AI_MAX_OUTPUT_TOKENS, 2048),
    temperature: toFloat(process.env.AI_TEMPERATURE, 0.2),
    timeoutMs: toInt(process.env.AI_TIMEOUT_MS, 60_000),
    /** Retries *after* the first attempt, so 2 means at most 3 provider calls. */
    maxRetries: toInt(process.env.AI_MAX_RETRIES, 2),
    retryBaseDelayMs: toInt(process.env.AI_RETRY_BASE_DELAY_MS, 500),
    /**
     * Per-1000-token prices in USD. Default 0 — a recorded cost of 0 means
     * "no price configured," not "free." Kept in config rather than a
     * hardcoded table so it can never go stale in the codebase (ADR-0023).
     */
    inputCostPer1k: toFloat(process.env.AI_INPUT_COST_PER_1K, 0),
    outputCostPer1k: toFloat(process.env.AI_OUTPUT_COST_PER_1K, 0),
    openai: {
      apiKey: realKey(process.env.OPENAI_API_KEY),
      baseUrl: process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1',
    },
    anthropic: {
      apiKey: realKey(process.env.ANTHROPIC_API_KEY),
      baseUrl: process.env.ANTHROPIC_BASE_URL?.trim() || 'https://api.anthropic.com/v1',
      version: process.env.ANTHROPIC_VERSION?.trim() || '2023-06-01',
    },
    gemini: {
      apiKey: realKey(process.env.GEMINI_API_KEY),
      baseUrl: process.env.GEMINI_BASE_URL?.trim() || 'https://generativelanguage.googleapis.com/v1beta',
    },
    /**
     * When false, clinical context is sent with patient name/UHID/phone
     * replaced by a placeholder. Default true because a referral letter or
     * discharge summary is unusable without the name — but a deployment
     * without a signed BAA with its provider can turn it off (TD-0042).
     */
    includePatientIdentifiers: process.env.AI_INCLUDE_PATIENT_IDENTIFIERS !== 'false',
    /** Ollama is self-hosted — reachability, not a key, is what makes it configured. */
    ollama: {
      baseUrl: process.env.OLLAMA_BASE_URL?.trim() || 'http://localhost:11434',
    },
  }
})
