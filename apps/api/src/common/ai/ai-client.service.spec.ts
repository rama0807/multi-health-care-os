import { ServiceUnavailableException } from '@nestjs/common'

import { AiClientService } from './ai-client.service'
import { AiProviderError } from './ai-errors'

describe('AiClientService', () => {
  const baseConfig: Record<string, unknown> = {
    'ai.enabled': true,
    'ai.model': 'gpt-4o-mini',
    'ai.maxOutputTokens': 1000,
    'ai.temperature': 0.2,
    'ai.timeoutMs': 5000,
    'ai.maxRetries': 2,
    'ai.retryBaseDelayMs': 0,
    'ai.disabledFeatures': [],
    'ai.inputCostPer1k': 0,
    'ai.outputCostPer1k': 0,
  }

  function build(overrides: Record<string, unknown> = {}, adapterOverrides: Record<string, unknown> = {}) {
    const values = { ...baseConfig, ...overrides }
    const adapter = {
      type: 'OPENAI',
      supportsStreaming: true,
      supportsVision: true,
      isConfigured: () => true,
      missingConfigReason: () => null,
      complete: jest.fn(),
      stream: jest.fn(),
      ...adapterOverrides,
    }
    const config = { get: jest.fn((key: string) => values[key]) }
    return { service: new AiClientService(adapter as never, config as never), adapter }
  }

  describe('availability', () => {
    it('throws 503 when the global kill switch is off', () => {
      const { service } = build({ 'ai.enabled': false })
      expect(() => service.assertAvailable('SOAP_NOTE')).toThrow(ServiceUnavailableException)
      expect(service.getStatus().unavailableReason).toContain('AI_ENABLED=false')
    })

    it('throws 503 when the provider has no credential - it never returns placeholder content', () => {
      const { service } = build(
        {},
        { isConfigured: () => false, missingConfigReason: () => 'OPENAI_API_KEY is not set' },
      )
      expect(() => service.assertAvailable('SOAP_NOTE')).toThrow(/OPENAI_API_KEY/)
      expect(service.getStatus().configured).toBe(false)
      expect(service.getStatus().features.every((feature) => !feature.enabled)).toBe(true)
    })

    it('throws 503 for a feature disabled by flag while leaving the others enabled', () => {
      const { service } = build({ 'ai.disabledFeatures': ['REFERRAL_LETTER'] })
      expect(() => service.assertAvailable('REFERRAL_LETTER')).toThrow(/disabled for this deployment/)
      expect(() => service.assertAvailable('SOAP_NOTE')).not.toThrow()

      const status = service.getStatus()
      expect(status.features.find((f) => f.feature === 'REFERRAL_LETTER')?.enabled).toBe(false)
      expect(status.features.find((f) => f.feature === 'SOAP_NOTE')?.enabled).toBe(true)
    })
  })

  describe('complete', () => {
    it('sends system and user prompts as two messages and reports metered usage', async () => {
      const { service, adapter } = build()
      adapter.complete.mockResolvedValue({
        content: 'draft',
        model: 'gpt-4o-mini',
        usage: { promptTokens: 100, completionTokens: 20, estimated: false },
      })

      const outcome = await service.complete({ feature: 'SOAP_NOTE', systemPrompt: 'sys', userPrompt: 'usr' })

      expect(adapter.complete.mock.calls[0][0].messages).toEqual([
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'usr' },
      ])
      expect(outcome).toMatchObject({
        content: 'draft',
        provider: 'OPENAI',
        totalTokens: 120,
        tokensEstimated: false,
        attempts: 1,
      })
    })

    it('prices tokens from configured per-1K rates', async () => {
      const { service, adapter } = build({ 'ai.inputCostPer1k': 0.15, 'ai.outputCostPer1k': 0.6 })
      adapter.complete.mockResolvedValue({
        content: 'draft',
        model: 'gpt-4o-mini',
        usage: { promptTokens: 1000, completionTokens: 1000, estimated: false },
      })

      const outcome = await service.complete({ feature: 'SOAP_NOTE', systemPrompt: 's', userPrompt: 'u' })
      expect(outcome.estimatedCostUsd).toBeCloseTo(0.75, 6)
    })

    it('retries a retryable failure and reports the attempt count', async () => {
      const { service, adapter } = build()
      adapter.complete
        .mockRejectedValueOnce(new AiProviderError('rate limited', 'provider_rate_limited', true))
        .mockResolvedValue({
          content: 'draft',
          model: 'gpt-4o-mini',
          usage: { promptTokens: 5, completionTokens: 5, estimated: false },
        })

      const outcome = await service.complete({ feature: 'SOAP_NOTE', systemPrompt: 's', userPrompt: 'u' })
      expect(adapter.complete).toHaveBeenCalledTimes(2)
      expect(outcome.attempts).toBe(2)
    })

    it('does not retry a non-retryable failure', async () => {
      const { service, adapter } = build()
      adapter.complete.mockRejectedValue(new AiProviderError('bad key', 'provider_unauthorized', false))

      await expect(service.complete({ feature: 'SOAP_NOTE', systemPrompt: 's', userPrompt: 'u' })).rejects.toThrow(
        'bad key',
      )
      expect(adapter.complete).toHaveBeenCalledTimes(1)
    })

    it('stops after maxRetries and surfaces the last failure', async () => {
      const { service, adapter } = build({ 'ai.maxRetries': 1 })
      adapter.complete.mockRejectedValue(new AiProviderError('down', 'provider_unavailable', true))

      await expect(service.complete({ feature: 'SOAP_NOTE', systemPrompt: 's', userPrompt: 'u' })).rejects.toThrow(
        'down',
      )
      expect(adapter.complete).toHaveBeenCalledTimes(2)
    })
  })

  describe('stream', () => {
    it('yields deltas then a terminal outcome carrying the provider usage', async () => {
      const { service, adapter } = build()
      adapter.stream.mockImplementation(function* () {
        yield { type: 'delta', text: 'Hel' }
        yield { type: 'delta', text: 'lo' }
        yield { type: 'usage', usage: { promptTokens: 40, completionTokens: 2, estimated: false } }
      })

      const events = []
      for await (const event of service.stream({ feature: 'SOAP_NOTE', systemPrompt: 'sys', userPrompt: 'usr' })) {
        events.push(event)
      }

      expect(events.slice(0, 2)).toEqual([
        { type: 'delta', text: 'Hel' },
        { type: 'delta', text: 'lo' },
      ])
      expect(events[2]).toMatchObject({
        type: 'outcome',
        outcome: { content: 'Hello', totalTokens: 42, tokensEstimated: false, attempts: 1 },
      })
    })

    it('estimates usage - and flags it as estimated - when the stream omits it', async () => {
      const { service, adapter } = build()
      adapter.stream.mockImplementation(function* () {
        yield { type: 'delta', text: '12345678' }
      })

      const events = []
      for await (const event of service.stream({ feature: 'SOAP_NOTE', systemPrompt: 'abcd', userPrompt: 'efgh' })) {
        events.push(event)
      }

      const outcome = (events.at(-1) as { outcome: { tokensEstimated: boolean; completionTokens: number } }).outcome
      expect(outcome.tokensEstimated).toBe(true)
      expect(outcome.completionTokens).toBe(2)
    })

    it('makes exactly one attempt - retrying mid-stream would replay rendered text', async () => {
      const { service, adapter } = build()
      adapter.stream.mockImplementation(function* () {
        yield { type: 'delta', text: 'partial' }
        throw new AiProviderError('dropped', 'provider_unavailable', true)
      })

      const iterate = async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _event of service.stream({ feature: 'SOAP_NOTE', systemPrompt: 's', userPrompt: 'u' })) {
          // drain
        }
      }

      await expect(iterate()).rejects.toThrow('dropped')
      expect(adapter.stream).toHaveBeenCalledTimes(1)
    })
  })

  it('maps provider errors to a 503 without leaking raw provider text', () => {
    const { service } = build()
    const exception = service.toHttpException(new AiProviderError('key sk-abc123 rejected', 'provider_unauthorized', false))

    expect(exception).toBeInstanceOf(ServiceUnavailableException)
    expect(exception.message).not.toContain('sk-abc123')
    expect(exception.message).toContain('credentials')
  })
})
