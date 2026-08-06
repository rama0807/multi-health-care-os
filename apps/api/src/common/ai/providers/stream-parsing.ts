import { AiProviderError } from '../ai-errors'

/**
 * Yields decoded lines from a `fetch` body stream. Shared by every adapter:
 * OpenAI/Anthropic/Gemini emit SSE (`data: {...}`) and Ollama emits
 * newline-delimited JSON, but both are line-oriented over the same transport.
 */
export async function* readLines(body: ReadableStream<Uint8Array> | null): AsyncGenerator<string> {
  if (!body) throw new AiProviderError('The AI provider returned an empty stream', 'provider_invalid_response', true)

  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let newlineIndex = buffer.indexOf('\n')
      while (newlineIndex !== -1) {
        yield buffer.slice(0, newlineIndex).replace(/\r$/, '')
        buffer = buffer.slice(newlineIndex + 1)
        newlineIndex = buffer.indexOf('\n')
      }
    }
    if (buffer.trim()) yield buffer.trim()
  } finally {
    reader.releaseLock()
  }
}

/**
 * Narrows a line to its SSE `data:` payload, skipping comments, blank lines,
 * `event:`/`id:` fields, and the `[DONE]` sentinel. Returns `null` when the
 * line carries no JSON payload.
 */
export function sseData(line: string): string | null {
  if (!line.startsWith('data:')) return null
  const payload = line.slice(5).trim()
  if (!payload || payload === '[DONE]') return null
  return payload
}

/** SSE payloads are best-effort - a malformed frame is skipped, not fatal. */
export function parseJson<T>(payload: string): T | null {
  try {
    return JSON.parse(payload) as T
  } catch {
    return null
  }
}
