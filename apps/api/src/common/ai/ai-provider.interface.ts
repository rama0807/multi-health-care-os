import { AiProviderType } from '@medicore/types'

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiCompletionRequest {
  messages: AiChatMessage[]
  model: string
  maxOutputTokens: number
  temperature: number
  signal?: AbortSignal
}

/**
 * `estimated: false` means the provider returned metered counts. `true` means
 * they came from the `ceil(chars / 4)` fallback in `token-accounting.ts` -
 * the two must never be conflated downstream (ADR-0023).
 */
export interface AiProviderUsage {
  promptTokens: number
  completionTokens: number
  estimated: boolean
}

export interface AiCompletionResponse {
  content: string
  usage: AiProviderUsage
  model: string
}

/**
 * A streaming adapter yields text deltas as they arrive and, if the provider
 * reports it, exactly one `usage` event before finishing. Adapters that can't
 * report usage simply never yield one, and the client falls back to estimation.
 */
export type AiProviderStreamEvent = { type: 'delta'; text: string } | { type: 'usage'; usage: AiProviderUsage }

/**
 * Every provider hides behind this. Domain code injects `AiClientService` and
 * never a concrete adapter, so switching vendors is a config change rather
 * than a code change - the same contract `StorageDriver` uses for disk vs S3.
 */
export interface AiProviderAdapter {
  readonly type: AiProviderType
  readonly supportsStreaming: boolean
  /** Reserved for Checkpoint 15.2's OCR/document work - not exercised in 15.1. */
  readonly supportsVision: boolean

  /** False when the credential (or, for Ollama, the base URL) is absent. */
  isConfigured(): boolean

  /** Human-readable explanation of what's missing, or `null` when configured. */
  missingConfigReason(): string | null

  complete(request: AiCompletionRequest): Promise<AiCompletionResponse>

  stream(request: AiCompletionRequest): AsyncGenerator<AiProviderStreamEvent>
}

export const AI_PROVIDER_ADAPTER = Symbol('AI_PROVIDER_ADAPTER')
