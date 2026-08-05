import { AiFeature, AiProviderType, AiStatus, AI_FEATURES, AI_FEATURE_LABELS } from '@medicore/types'
import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { AiErrorCode, AiProviderError, toProviderError } from './ai-errors'
import {
  AI_PROVIDER_ADAPTER,
  AiChatMessage,
  AiProviderAdapter,
  AiProviderUsage,
} from './ai-provider.interface'
import { computeCostUsd, estimateTokens } from './token-accounting'

export interface AiDispatchInput {
  feature: AiFeature
  systemPrompt: string
  userPrompt: string
}

export interface AiDispatchOutcome {
  content: string
  provider: AiProviderType
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  tokensEstimated: boolean
  estimatedCostUsd: number
  latencyMs: number
  attempts: number
}

/** Streaming yields deltas as they arrive, then exactly one terminal outcome. */
export type AiStreamYield = { type: 'delta'; text: string } | { type: 'outcome'; outcome: AiDispatchOutcome }

/**
 * The only thing domain modules inject. Owns feature flags, retry/backoff,
 * timeouts, and token accounting; knows nothing about which vendor is behind
 * `AI_PROVIDER_ADAPTER` and nothing about the database (persistence of
 * conversations and usage rows belongs to `modules/ai` — ADR-0023).
 */
@Injectable()
export class AiClientService {
  private readonly logger = new Logger(AiClientService.name)

  constructor(
    @Inject(AI_PROVIDER_ADAPTER) private readonly adapter: AiProviderAdapter,
    private readonly config: ConfigService,
  ) {}

  getStatus(): AiStatus {
    const enabled = this.config.get<boolean>('ai.enabled') ?? false
    const disabled = this.config.get<AiFeature[]>('ai.disabledFeatures') ?? []
    const configured = this.adapter.isConfigured()

    return {
      enabled,
      configured,
      provider: this.adapter.type,
      model: this.config.get<string>('ai.model') ?? '',
      streamingSupported: this.adapter.supportsStreaming,
      features: AI_FEATURES.map((feature) => ({
        feature,
        label: AI_FEATURE_LABELS[feature],
        enabled: enabled && configured && !disabled.includes(feature),
      })),
      unavailableReason: this.unavailableReason(),
    }
  }

  /** `null` when a request could be served right now. */
  private unavailableReason(): string | null {
    if (!(this.config.get<boolean>('ai.enabled') ?? false)) {
      return 'AI features are disabled for this deployment (AI_ENABLED=false)'
    }
    return this.adapter.missingConfigReason()
  }

  /**
   * Called *before* any patient context is assembled, so a disabled feature
   * never triggers a PHI read (ADR-0023). Throws 503 rather than returning a
   * placeholder: with no credential this system produces no clinical text.
   */
  assertAvailable(feature: AiFeature): void {
    const reason = this.unavailableReason()
    if (reason) throw new ServiceUnavailableException(reason)

    const disabled = this.config.get<AiFeature[]>('ai.disabledFeatures') ?? []
    if (disabled.includes(feature)) {
      throw new ServiceUnavailableException(
        `The ${AI_FEATURE_LABELS[feature]} feature is disabled for this deployment (AI_DISABLED_FEATURES)`,
      )
    }
  }

  async complete(input: AiDispatchInput): Promise<AiDispatchOutcome> {
    const messages = this.toMessages(input)
    const startedAt = Date.now()

    return this.withRetries(async (attempt) => {
      const response = await this.adapter.complete({
        messages,
        model: this.model,
        maxOutputTokens: this.maxOutputTokens,
        temperature: this.temperature,
        signal: this.timeoutSignal(),
      })

      return this.toOutcome(response.content, response.usage, response.model, startedAt, attempt)
    })
  }

  async *stream(input: AiDispatchInput): AsyncGenerator<AiStreamYield> {
    const messages = this.toMessages(input)
    const startedAt = Date.now()

    // Retrying mid-stream would replay text the client has already rendered,
    // so a stream gets exactly one attempt. Callers that need retry semantics
    // use `complete()`.
    let content = ''
    let usage: AiProviderUsage | null = null

    try {
      for await (const event of this.adapter.stream({
        messages,
        model: this.model,
        maxOutputTokens: this.maxOutputTokens,
        temperature: this.temperature,
        signal: this.timeoutSignal(),
      })) {
        if (event.type === 'delta') {
          content += event.text
          yield { type: 'delta', text: event.text }
        } else {
          usage = event.usage
        }
      }
    } catch (error) {
      throw toProviderError(error)
    }

    if (!content) {
      throw new AiProviderError('The AI provider streamed no content', 'provider_invalid_response', true)
    }

    const resolved: AiProviderUsage = usage ?? {
      promptTokens: estimateTokens(`${input.systemPrompt}\n${input.userPrompt}`),
      completionTokens: estimateTokens(content),
      estimated: true,
    }

    yield { type: 'outcome', outcome: this.toOutcome(content, resolved, this.model, startedAt, 1) }
  }

  /** Maps a provider failure onto the HTTP contract callers see. */
  toHttpException(error: unknown): ServiceUnavailableException {
    const providerError = toProviderError(error)
    this.logger.error(`AI provider failure [${providerError.code}]: ${providerError.message}`)
    return new ServiceUnavailableException(messageForCode(providerError.code))
  }

  private toMessages(input: AiDispatchInput): AiChatMessage[] {
    return [
      { role: 'system', content: input.systemPrompt },
      { role: 'user', content: input.userPrompt },
    ]
  }

  private toOutcome(
    content: string,
    usage: AiProviderUsage,
    model: string,
    startedAt: number,
    attempts: number,
  ): AiDispatchOutcome {
    const totalTokens = usage.promptTokens + usage.completionTokens
    return {
      content,
      provider: this.adapter.type,
      model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens,
      tokensEstimated: usage.estimated,
      estimatedCostUsd: computeCostUsd(
        usage.promptTokens,
        usage.completionTokens,
        this.config.get<number>('ai.inputCostPer1k') ?? 0,
        this.config.get<number>('ai.outputCostPer1k') ?? 0,
      ),
      latencyMs: Date.now() - startedAt,
      attempts,
    }
  }

  /**
   * Exponential backoff over retryable failures only (rate limits, upstream
   * 5xx, timeouts). A bad credential or malformed request fails immediately —
   * retrying it would just burn the caller's request budget.
   */
  private async withRetries(run: (attempt: number) => Promise<AiDispatchOutcome>): Promise<AiDispatchOutcome> {
    const maxRetries = this.config.get<number>('ai.maxRetries') ?? 0
    const baseDelayMs = this.config.get<number>('ai.retryBaseDelayMs') ?? 500
    let lastError: AiProviderError | null = null

    for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
      try {
        return await run(attempt)
      } catch (error) {
        lastError = toProviderError(error)
        if (!lastError.retryable || attempt > maxRetries) break

        const delay = baseDelayMs * 2 ** (attempt - 1)
        this.logger.warn(
          `AI attempt ${attempt} failed (${lastError.code}); retrying in ${delay}ms: ${lastError.message}`,
        )
        await sleep(delay)
      }
    }

    throw lastError ?? new AiProviderError('AI request failed', 'provider_error', false)
  }

  private timeoutSignal(): AbortSignal {
    return AbortSignal.timeout(this.config.get<number>('ai.timeoutMs') ?? 60_000)
  }

  private get model(): string {
    return this.config.get<string>('ai.model') ?? ''
  }

  private get maxOutputTokens(): number {
    return this.config.get<number>('ai.maxOutputTokens') ?? 2048
  }

  private get temperature(): number {
    return this.config.get<number>('ai.temperature') ?? 0.2
  }
}

/**
 * Deliberately does not echo the provider's raw error text to the caller — it
 * can contain request fragments, and a clinician can't act on it anyway.
 * The full detail is logged above.
 */
function messageForCode(code: AiErrorCode): string {
  switch (code) {
    case 'provider_unauthorized':
      return 'The AI provider rejected this deployment’s credentials. Check the configured API key.'
    case 'provider_rate_limited':
      return 'The AI provider is rate-limiting this deployment. Try again shortly.'
    case 'provider_timeout':
      return 'The AI provider did not respond in time. Try again.'
    case 'provider_unavailable':
    case 'provider_network_error':
      return 'The AI provider is currently unreachable. Try again shortly.'
    case 'provider_bad_request':
    case 'provider_invalid_response':
      return 'The AI provider could not process this request. No content was generated.'
    default:
      return 'The AI request failed. No content was generated.'
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
