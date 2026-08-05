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

import { parseJson, readLines, sseData } from './stream-parsing'

interface OpenAiUsage {
  prompt_tokens?: number
  completion_tokens?: number
}

interface OpenAiChatResponse {
  choices?: Array<{ message?: { content?: string } }>
  usage?: OpenAiUsage
  model?: string
}

interface OpenAiStreamChunk {
  choices?: Array<{ delta?: { content?: string } }>
  usage?: OpenAiUsage
}

/** OpenAI Chat Completions (`POST {baseUrl}/chat/completions`). */
@Injectable()
export class OpenAiProvider implements AiProviderAdapter {
  readonly type: AiProviderType = 'OPENAI'
  readonly supportsStreaming = true
  readonly supportsVision = true

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.config.get<string>('ai.openai.apiKey')
  }

  missingConfigReason(): string | null {
    return this.isConfigured() ? null : 'OPENAI_API_KEY is not set (or is still a placeholder value)'
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    const response = await this.dispatch(request, false)
    const body = (await response.json()) as OpenAiChatResponse
    const content = body.choices?.[0]?.message?.content ?? ''

    if (!content) {
      throw new AiProviderError('OpenAI returned no message content', 'provider_invalid_response', true)
    }

    const metered = body.usage?.prompt_tokens !== undefined && body.usage?.completion_tokens !== undefined
    return {
      content,
      model: body.model ?? request.model,
      usage: {
        promptTokens: body.usage?.prompt_tokens ?? estimateTokens(promptTextOf(request)),
        completionTokens: body.usage?.completion_tokens ?? estimateTokens(content),
        estimated: !metered,
      },
    }
  }

  async *stream(request: AiCompletionRequest): AsyncGenerator<AiProviderStreamEvent> {
    const response = await this.dispatch(request, true)

    for await (const line of readLines(response.body)) {
      const payload = sseData(line)
      if (!payload) continue

      const chunk = parseJson<OpenAiStreamChunk>(payload)
      if (!chunk) continue

      const delta = chunk.choices?.[0]?.delta?.content
      if (delta) yield { type: 'delta', text: delta }

      // Present only because `stream_options.include_usage` was requested; it
      // arrives on a final chunk that carries no choices.
      if (chunk.usage?.prompt_tokens !== undefined) {
        yield {
          type: 'usage',
          usage: {
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens ?? 0,
            estimated: false,
          },
        }
      }
    }
  }

  private async dispatch(request: AiCompletionRequest, stream: boolean): Promise<Response> {
    const apiKey = this.config.get<string>('ai.openai.apiKey')
    if (!apiKey) throw new AiProviderError('OpenAI is not configured', 'provider_unauthorized', false)

    const baseUrl = this.config.get<string>('ai.openai.baseUrl')
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: request.signal,
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        max_tokens: request.maxOutputTokens,
        temperature: request.temperature,
        ...(stream ? { stream: true, stream_options: { include_usage: true } } : {}),
      }),
    })

    if (!response.ok) {
      const { code, retryable } = classifyHttpStatus(response.status)
      throw new AiProviderError(await describeFailure(response, 'OpenAI'), code, retryable, response.status)
    }
    return response
  }
}

export function promptTextOf(request: AiCompletionRequest): string {
  return request.messages.map((message) => message.content).join('\n')
}

/**
 * Provider error bodies are quoted back (truncated) because "OpenAI returned
 * 400" alone is not actionable — but they can be long, and they reach logs.
 */
export async function describeFailure(response: Response, providerName: string): Promise<string> {
  let detail = ''
  try {
    detail = (await response.text()).slice(0, 500)
  } catch {
    detail = ''
  }
  return `${providerName} request failed with HTTP ${response.status}${detail ? `: ${detail}` : ''}`
}
