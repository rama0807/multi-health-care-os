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
import { parseJson, readLines } from './stream-parsing'

interface OllamaChatResponse {
  message?: { content?: string }
  model?: string
  done?: boolean
  prompt_eval_count?: number
  eval_count?: number
}

/**
 * Ollama (`POST {baseUrl}/api/chat`) — the self-hosted option, so there is no
 * API key: a reachable base URL is what "configured" means. Its stream is
 * newline-delimited JSON rather than SSE, which is why the line reader is
 * shared but the SSE `data:` unwrapping is not used here.
 */
@Injectable()
export class OllamaProvider implements AiProviderAdapter {
  readonly type: AiProviderType = 'OLLAMA'
  readonly supportsStreaming = true
  readonly supportsVision = false

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.config.get<string>('ai.ollama.baseUrl')
  }

  missingConfigReason(): string | null {
    return this.isConfigured() ? null : 'OLLAMA_BASE_URL is not set'
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    const response = await this.dispatch(request, false)
    const body = (await response.json()) as OllamaChatResponse
    const content = body.message?.content ?? ''

    if (!content) {
      throw new AiProviderError('Ollama returned no message content', 'provider_invalid_response', true)
    }

    const metered = body.prompt_eval_count !== undefined && body.eval_count !== undefined
    return {
      content,
      model: body.model ?? request.model,
      usage: {
        promptTokens: body.prompt_eval_count ?? estimateTokens(promptTextOf(request)),
        completionTokens: body.eval_count ?? estimateTokens(content),
        estimated: !metered,
      },
    }
  }

  async *stream(request: AiCompletionRequest): AsyncGenerator<AiProviderStreamEvent> {
    const response = await this.dispatch(request, true)

    for await (const line of readLines(response.body)) {
      if (!line.trim()) continue
      const chunk = parseJson<OllamaChatResponse>(line)
      if (!chunk) continue

      if (chunk.message?.content) yield { type: 'delta', text: chunk.message.content }

      if (chunk.done && chunk.prompt_eval_count !== undefined) {
        yield {
          type: 'usage',
          usage: {
            promptTokens: chunk.prompt_eval_count,
            completionTokens: chunk.eval_count ?? 0,
            estimated: false,
          },
        }
      }
    }
  }

  private async dispatch(request: AiCompletionRequest, stream: boolean): Promise<Response> {
    const baseUrl = this.config.get<string>('ai.ollama.baseUrl')
    if (!baseUrl) throw new AiProviderError('Ollama is not configured', 'provider_unauthorized', false)

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: request.signal,
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream,
        options: { temperature: request.temperature, num_predict: request.maxOutputTokens },
      }),
    })

    if (!response.ok) {
      const { code, retryable } = classifyHttpStatus(response.status)
      throw new AiProviderError(await describeFailure(response, 'Ollama'), code, retryable, response.status)
    }
    return response
  }
}
