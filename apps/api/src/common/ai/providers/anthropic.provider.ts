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

interface AnthropicMessageResponse {
  content?: Array<{ type?: string; text?: string }>
  usage?: { input_tokens?: number; output_tokens?: number }
  model?: string
}

interface AnthropicStreamEvent {
  type?: string
  delta?: { text?: string; stop_reason?: string }
  message?: { usage?: { input_tokens?: number; output_tokens?: number } }
  usage?: { input_tokens?: number; output_tokens?: number }
}

/**
 * Anthropic Messages API (`POST {baseUrl}/messages`). Unlike OpenAI, the
 * system prompt is a top-level `system` field rather than a message with
 * `role: "system"`, so it is lifted out here.
 */
@Injectable()
export class AnthropicProvider implements AiProviderAdapter {
  readonly type: AiProviderType = 'ANTHROPIC'
  readonly supportsStreaming = true
  readonly supportsVision = true

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.config.get<string>('ai.anthropic.apiKey')
  }

  missingConfigReason(): string | null {
    return this.isConfigured() ? null : 'ANTHROPIC_API_KEY is not set (or is still a placeholder value)'
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    const response = await this.dispatch(request, false)
    const body = (await response.json()) as AnthropicMessageResponse
    const content = (body.content ?? [])
      .filter((block) => block.type === 'text' || block.text)
      .map((block) => block.text ?? '')
      .join('')

    if (!content) {
      throw new AiProviderError('Anthropic returned no message content', 'provider_invalid_response', true)
    }

    const metered = body.usage?.input_tokens !== undefined && body.usage?.output_tokens !== undefined
    return {
      content,
      model: body.model ?? request.model,
      usage: {
        promptTokens: body.usage?.input_tokens ?? estimateTokens(promptTextOf(request)),
        completionTokens: body.usage?.output_tokens ?? estimateTokens(content),
        estimated: !metered,
      },
    }
  }

  async *stream(request: AiCompletionRequest): AsyncGenerator<AiProviderStreamEvent> {
    const response = await this.dispatch(request, true)

    // Input tokens arrive on `message_start`, output tokens on `message_delta`
    // — they must be joined before a usage event can be emitted.
    let promptTokens: number | null = null

    for await (const line of readLines(response.body)) {
      const payload = sseData(line)
      if (!payload) continue

      const event = parseJson<AnthropicStreamEvent>(payload)
      if (!event) continue

      if (event.type === 'content_block_delta' && event.delta?.text) {
        yield { type: 'delta', text: event.delta.text }
      }
      if (event.type === 'message_start' && event.message?.usage?.input_tokens !== undefined) {
        promptTokens = event.message.usage.input_tokens
      }
      if (event.type === 'message_delta' && event.usage?.output_tokens !== undefined) {
        yield {
          type: 'usage',
          usage: { promptTokens: promptTokens ?? 0, completionTokens: event.usage.output_tokens, estimated: false },
        }
      }
    }
  }

  private async dispatch(request: AiCompletionRequest, stream: boolean): Promise<Response> {
    const apiKey = this.config.get<string>('ai.anthropic.apiKey')
    if (!apiKey) throw new AiProviderError('Anthropic is not configured', 'provider_unauthorized', false)

    const baseUrl = this.config.get<string>('ai.anthropic.baseUrl')
    const version = this.config.get<string>('ai.anthropic.version')

    const system = request.messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n\n')
    const messages = request.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({ role: message.role, content: message.content }))

    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': version ?? '2023-06-01',
      },
      signal: request.signal,
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.maxOutputTokens,
        temperature: request.temperature,
        ...(system ? { system } : {}),
        messages,
        ...(stream ? { stream: true } : {}),
      }),
    })

    if (!response.ok) {
      const { code, retryable } = classifyHttpStatus(response.status)
      throw new AiProviderError(await describeFailure(response, 'Anthropic'), code, retryable, response.status)
    }
    return response
  }
}
