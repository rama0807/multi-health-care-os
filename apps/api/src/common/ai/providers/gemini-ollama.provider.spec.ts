import { GeminiProvider } from './gemini.provider'
import { OllamaProvider } from './ollama.provider'

describe('GeminiProvider', () => {
  const config = {
    get: jest.fn(
      (key: string) =>
        ({ 'ai.gemini.apiKey': 'gemini-real', 'ai.gemini.baseUrl': 'https://generativelanguage.googleapis.com/v1beta' })[
          key
        ],
    ),
  }
  const fetchMock = jest.fn()
  let provider: GeminiProvider

  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = fetchMock as unknown as typeof fetch
    provider = new GeminiProvider(config as never)
  })

  it('maps the system message to systemInstruction and assistant turns to `model`', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: 'Summary' }] } }],
        usageMetadata: { promptTokenCount: 55, candidatesTokenCount: 8 },
      }),
    })

    const result = await provider.complete({
      messages: [
        { role: 'system', content: 'guardrails' },
        { role: 'assistant', content: 'earlier' },
        { role: 'user', content: 'context' },
      ],
      model: 'gemini-1.5-pro',
      maxOutputTokens: 400,
      temperature: 0.3,
    })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/models/gemini-1.5-pro:generateContent')
    // The key must ride in a header, never the query string.
    expect(url).not.toContain('gemini-real')
    expect(init.headers['x-goog-api-key']).toBe('gemini-real')

    const body = JSON.parse(init.body) as {
      systemInstruction: { parts: Array<{ text: string }> }
      contents: Array<{ role: string }>
    }
    expect(body.systemInstruction.parts[0].text).toBe('guardrails')
    expect(body.contents.map((content) => content.role)).toEqual(['model', 'user'])
    expect(result.usage).toEqual({ promptTokens: 55, completionTokens: 8, estimated: false })
  })
})

describe('OllamaProvider', () => {
  const config = { get: jest.fn((key: string) => ({ 'ai.ollama.baseUrl': 'http://localhost:11434' })[key]) }
  const fetchMock = jest.fn()
  let provider: OllamaProvider

  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = fetchMock as unknown as typeof fetch
    provider = new OllamaProvider(config as never)
  })

  it('is configured by a reachable base URL rather than a key', () => {
    expect(provider.isConfigured()).toBe(true)
    expect(new OllamaProvider({ get: jest.fn(() => undefined) } as never).isConfigured()).toBe(false)
  })

  it('reads newline-delimited JSON rather than SSE when streaming', async () => {
    const encoder = new TextEncoder()
    fetchMock.mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('{"message":{"content":"Hel"}}\n'))
          controller.enqueue(encoder.encode('{"message":{"content":"lo"}}\n'))
          controller.enqueue(encoder.encode('{"done":true,"prompt_eval_count":12,"eval_count":3}\n'))
          controller.close()
        },
      }),
    })

    const events = []
    for await (const event of provider.stream({
      messages: [{ role: 'user', content: 'hi' }],
      model: 'llama3.1',
      maxOutputTokens: 20,
      temperature: 0,
    })) {
      events.push(event)
    }

    expect(events).toEqual([
      { type: 'delta', text: 'Hel' },
      { type: 'delta', text: 'lo' },
      { type: 'usage', usage: { promptTokens: 12, completionTokens: 3, estimated: false } },
    ])
  })
})
