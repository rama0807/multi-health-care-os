/**
 * A provider failure, classified so the retry loop knows whether another
 * attempt could plausibly succeed. `code` is persisted on `AiUsageLog` so a
 * later audit can tell a rate-limit storm apart from a bad credential.
 */
export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly code: AiErrorCode,
    readonly retryable: boolean,
    readonly httpStatus?: number,
  ) {
    super(message)
    this.name = 'AiProviderError'
  }
}

export type AiErrorCode =
  | 'provider_unauthorized'
  | 'provider_rate_limited'
  | 'provider_unavailable'
  | 'provider_bad_request'
  | 'provider_timeout'
  | 'provider_network_error'
  | 'provider_invalid_response'
  | 'provider_error'

/**
 * Retryable: transient conditions a second attempt can clear (rate limits,
 * upstream 5xx, timeouts). Not retryable: anything that would fail identically
 * next time (bad credential, malformed request).
 */
export function classifyHttpStatus(status: number): { code: AiErrorCode; retryable: boolean } {
  if (status === 401 || status === 403) return { code: 'provider_unauthorized', retryable: false }
  if (status === 408) return { code: 'provider_timeout', retryable: true }
  if (status === 429) return { code: 'provider_rate_limited', retryable: true }
  if (status >= 500) return { code: 'provider_unavailable', retryable: true }
  if (status >= 400) return { code: 'provider_bad_request', retryable: false }
  return { code: 'provider_error', retryable: false }
}

export function toProviderError(error: unknown): AiProviderError {
  if (error instanceof AiProviderError) return error
  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
    return new AiProviderError('The AI provider did not respond in time', 'provider_timeout', true)
  }
  const message = error instanceof Error ? error.message : 'Unknown AI provider failure'
  return new AiProviderError(message, 'provider_network_error', true)
}
