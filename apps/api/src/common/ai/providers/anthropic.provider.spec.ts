import { AnthropicProvider } from './anthropic.provider'

describe('AnthropicProvider', () => {
  const config = {
    get: jest.fn(
      (key: string) =>
        ({
          'ai.anthropic.apiKey': 'sk-ant-real',
          'ai.anthropic.baseUrl': 'https://api.anthropic.com/v1',
          'ai.anthropic.version': '2023-06-01',
        })[key],
    ),
  }
  const fetchMock = jest.fn()
  let provider: AnthropicProvider

  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = fetchMock as unknown as typeof fetch
    provider = new AnthropicProvider(config as never)
  })

  it('lifts the system message into the top-level `system` field', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [{ type: 'text', text: 'Impression: ...' }],
        usage: { input_tokens: 200, output_tokens: 30 },
        model: 'claude-sonnet-5',
      }),
    })

    const result = await provider.complete({
      messages: [
        { role: 'system', content: 'guardrails' },
        { role: 'user', content: 'context' },
      ],
      model: 'claude-sonnet-5',
      maxOutputTokens: 500,
      temperature: 0.2,
    })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.system).toBe('guardrails')
    expect(body.messages).toEqual([{ role: 'user', content: 'context' }])
    expect(fetchMock.mock.calls[0][1].headers['x-api-key']).toBe('sk-ant-real')
    expect(fetchMock.mock.calls[0][1].headers['anthropic-version']).toBe('2023-06-01')
    expect(result.usage).toEqual({ promptTokens: 200, completionTokens: 30, estimated: false })
  })

  it('joins message_start input tokens with message_delta output tokens when streaming', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      body: sseStream([
        'data: {"type":"message_start","message":{"usage":{"input_tokens":90}}}',
        'data: {"type":"content_block_delta","delta":{"text":"Find"}}',
        'data: {"type":"content_block_delta","delta":{"text":"ings"}}',
        'data: {"type":"message_delta","usage":{"output_tokens":7}}',
      ]),
    })

    const events = []
    for await (const event of provider.stream({
      messages: [{ role: 'user', content: 'x' }],
      model: 'claude-sonnet-5',
      maxOutputTokens: 50,
      temperature: 0,
    })) {
      events.push(event)
    }

    expect(events).toEqual([
      { type: 'delta', text: 'Find' },
      { type: 'delta', text: 'ings' },
      { type: 'usage', usage: { promptTokens: 90, completionTokens: 7, estimated: false } },
    ])
  })

  it('surfaces an upstream 503 as retryable', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, text: () => Promise.resolve('overloaded') })
    await expect(
      provider.complete({ messages: [], model: 'm', maxOutputTokens: 1, temperature: 0 }),
    ).rejects.toMatchObject({ code: 'provider_unavailable', retryable: true })
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
