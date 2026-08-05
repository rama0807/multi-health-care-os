import { OpenAiProvider } from './openai.provider'

/**
 * Adapters are verified against a mocked `fetch`: request shaping, usage
 * mapping, SSE decoding, and error classification are all real behaviour that
 * can be asserted without a credential — and without inventing a model
 * response as if it were clinical output (ADR-0023).
 */
describe('OpenAiProvider', () => {
  const config = {
    get: jest.fn((key: string) =>
      ({ 'ai.openai.apiKey': 'sk-real-key', 'ai.openai.baseUrl': 'https://api.openai.com/v1' })[key],
    ),
  }
  let provider: OpenAiProvider
  const fetchMock = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = fetchMock as unknown as typeof fetch
    provider = new OpenAiProvider(config as never)
  })

  it('reports configured when a real key is present', () => {
    expect(provider.isConfigured()).toBe(true)
    expect(provider.missingConfigReason()).toBeNull()
  })

  it('reports not configured when the key is absent', () => {
    const bare = new OpenAiProvider({ get: jest.fn(() => undefined) } as never)
    expect(bare.isConfigured()).toBe(false)
    expect(bare.missingConfigReason()).toContain('OPENAI_API_KEY')
  })

  it('sends the model, messages and limits, and maps metered usage back', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'SUBJECTIVE: ...' } }],
        usage: { prompt_tokens: 120, completion_tokens: 45 },
        model: 'gpt-4o-mini',
      }),
    })

    const result = await provider.complete({
      messages: [
        { role: 'system', content: 'guardrails' },
        { role: 'user', content: 'context' },
      ],
      model: 'gpt-4o-mini',
      maxOutputTokens: 900,
      temperature: 0.1,
    })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/chat/completions')
    expect(init.headers.Authorization).toBe('Bearer sk-real-key')
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({ model: 'gpt-4o-mini', max_tokens: 900, temperature: 0.1 })
    expect(body.messages).toHaveLength(2)
    expect(body.stream).toBeUndefined()

    expect(result.content).toBe('SUBJECTIVE: ...')
    expect(result.usage).toEqual({ promptTokens: 120, completionTokens: 45, estimated: false })
  })

  it('falls back to estimated usage when the provider omits it', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: '12345678' } }] }),
    })

    const result = await provider.complete({
      messages: [{ role: 'user', content: 'abcd' }],
      model: 'gpt-4o-mini',
      maxOutputTokens: 100,
      temperature: 0,
    })

    // 8 characters at the documented 4-chars-per-token ratio.
    expect(result.usage).toEqual({ promptTokens: 1, completionTokens: 2, estimated: true })
  })

  it('classifies a 429 as retryable and a 401 as not', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, text: () => Promise.resolve('slow down') })
    await expect(
      provider.complete({ messages: [], model: 'm', maxOutputTokens: 10, temperature: 0 }),
    ).rejects.toMatchObject({ code: 'provider_rate_limited', retryable: true })

    fetchMock.mockResolvedValue({ ok: false, status: 401, text: () => Promise.resolve('bad key') })
    await expect(
      provider.complete({ messages: [], model: 'm', maxOutputTokens: 10, temperature: 0 }),
    ).rejects.toMatchObject({ code: 'provider_unauthorized', retryable: false })
  })

  it('decodes SSE deltas and the terminal usage frame', async () => {
    fetchMock.mockResolvedValue({ ok: true, body: sseStream([
      'data: {"choices":[{"delta":{"content":"Hello"}}]}',
      'data: {"choices":[{"delta":{"content":" world"}}]}',
      'data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":2}}',
      'data: [DONE]',
    ]) })

    const events = []
    for await (const event of provider.stream({
      messages: [{ role: 'user', content: 'hi' }],
      model: 'gpt-4o-mini',
      maxOutputTokens: 50,
      temperature: 0,
    })) {
      events.push(event)
    }

    expect(events).toEqual([
      { type: 'delta', text: 'Hello' },
      { type: 'delta', text: ' world' },
      { type: 'usage', usage: { promptTokens: 10, completionTokens: 2, estimated: false } },
    ])
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).stream).toBe(true)
  })
})

function sseStream(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(`${line}\n\n`))
      controller.close()
    },
  })
}
