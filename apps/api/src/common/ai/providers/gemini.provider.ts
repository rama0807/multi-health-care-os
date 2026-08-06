import { AiProviderType } from '@medicore/types'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { AiProviderError, classifyHttpStatus } from '../ai-errors'
import {
  AiCompletionRequest,
  AiCompletionResponse,
  AiProviderAdapter,
  AiProviderStreamEvent,
} from '../ai-provider.interface'
import { estimateTokens } from '../token-accounting'

import { describeFailure, promptTextOf } from './openai.provider'
import { parseJson, readLines, sseData } from './stream-parsing'

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
  modelVersion?: string
}

/**
 * Google Gemini `generateContent` / `streamGenerateContent`. Two shape
 * differences from the others: the system prompt is `systemInstruction`, and
 * the assistant role is called `model` rather than `assistant`.
 */
@Injectable()
export class GeminiProvider implements AiProviderAdapter {
  readonly type: AiProviderType = 'GEMINI'
  readonly supportsStreaming = true
  readonly supportsVision = true

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.config.get<string>('ai.gemini.apiKey')
  }

  missingConfigReason(): string | null {
    return this.isConfigured() ? null : 'GEMINI_API_KEY is not set (or is still a placeholder value)'
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    const response = await this.dispatch(request, false)
    const body = (await response.json()) as GeminiResponse
    const content = (body.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? '').join('')

    if (!content) {
      throw new AiProviderError('Gemini returned no candidate content', 'provider_invalid_response', true)
    }

    const metered =
      body.usageMetadata?.promptTokenCount !== undefined && body.usageMetadata?.candidatesTokenCount !== undefined
    return {
      content,
      model: body.modelVersion ?? request.model,
      usage: {
        promptTokens: body.usageMetadata?.promptTokenCount ?? estimateTokens(promptTextOf(request)),
        completionTokens: body.usageMetadata?.candidatesTokenCount ?? estimateTokens(content),
        estimated: !metered,
      },
    }
  }

  async *stream(request: AiCompletionRequest): AsyncGenerator<AiProviderStreamEvent> {
    const response = await this.dispatch(request, true)

    // Gemini repeats cumulative usage on every SSE frame, so the last one seen
    // is the total - emitted once the stream drains rather than per chunk.
    let lastUsage: { promptTokens: number; completionTokens: number } | null = null

    for await (const line of readLines(response.body)) {
      const payload = sseData(line)
      if (!payload) continue

      const chunk = parseJson<GeminiResponse>(payload)
      if (!chunk) continue

      const text = (chunk.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? '').join('')
      if (text) yield { type: 'delta', text }

      if (chunk.usageMetadata?.promptTokenCount !== undefined) {
        lastUsage = {
          promptTokens: chunk.usageMetadata.promptTokenCount,
          completionTokens: chunk.usageMetadata.candidatesTokenCount ?? 0,
        }
      }
    }

    if (lastUsage) yield { type: 'usage', usage: { ...lastUsage, estimated: false } }
  }

  private async dispatch(request: AiCompletionRequest, stream: boolean): Promise<Response> {
    const apiKey = this.config.get<string>('ai.gemini.apiKey')
    if (!apiKey) throw new AiProviderError('Gemini is not configured', 'provider_unauthorized', false)

    const baseUrl = this.config.get<string>('ai.gemini.baseUrl')
    const method = stream ? 'streamGenerateContent?alt=sse' : 'generateContent'

    const systemText = request.messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n\n')
    const contents = request.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      }))

    const response = await fetch(`${baseUrl}/models/${request.model}:${method}`, {
      method: 'POST',
      // The key rides in a header rather than the query string so it can't
      // land in an access log alongside the request path.
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: request.signal,
      body: JSON.stringify({
        ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
        contents,
        generationConfig: {
          maxOutputTokens: request.maxOutputTokens,
          temperature: request.temperature,
        },
      }),
    })

    if (!response.ok) {
      const { code, retryable } = classifyHttpStatus(response.status)
      throw new AiProviderError(await describeFailure(response, 'Gemini'), code, retryable, response.status)
    }
    return response
  }
}
