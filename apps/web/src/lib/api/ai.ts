import type {
  AiConversationDetail,
  AiConversationQuery,
  AiConversationSummary,
  AiGenerationResult,
  AiPromptTemplate,
  AiStatus,
  AiStreamEvent,
  AiUsageLogEntry,
  AiUsageQuery,
  AiUsageSummary,
  CreateAiPromptTemplateDto,
  GenerateAiContentDto,
  PaginatedResponse,
} from '@medicore/types'

import { apiClient, getAccessToken, getCsrfToken } from './client'

export async function getAiStatus(): Promise<AiStatus> {
  const { data } = await apiClient.get<{ data: AiStatus }>('/ai/status')
  return data.data
}

export async function generateAiContent(dto: GenerateAiContentDto): Promise<AiGenerationResult> {
  const { data } = await apiClient.post<{ data: AiGenerationResult }>('/ai/generate', dto)
  return data.data
}

/**
 * Streaming goes through `fetch` rather than the shared axios client: axios
 * buffers the whole response, which would defeat the point. Auth and CSRF are
 * applied by hand to match what the axios request interceptor does.
 */
export async function streamAiContent(
  dto: GenerateAiContentDto,
  handlers: {
    onChunk: (delta: string) => void
    onDone: (result: AiGenerationResult) => void
    onError: (message: string) => void
  },
  signal?: AbortSignal,
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'
  const token = getAccessToken()
  const csrfToken = getCsrfToken()

  const response = await fetch(`${baseUrl}/v1/ai/generate/stream`, {
    method: 'POST',
    credentials: 'include',
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    },
    body: JSON.stringify(dto),
  })

  if (!response.ok || !response.body) {
    // A non-200 here means the request failed before the stream opened (auth,
    // RBAC, validation, or AI being unconfigured) - the body is a normal
    // JSON error envelope, not SSE.
    const fallback = await response.text().catch(() => '')
    handlers.onError(extractErrorMessage(fallback) ?? `Request failed with status ${response.status}`)
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let boundary = buffer.indexOf('\n\n')
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      boundary = buffer.indexOf('\n\n')

      const payload = frame
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('')
      if (!payload) continue

      let event: AiStreamEvent
      try {
        event = JSON.parse(payload) as AiStreamEvent
      } catch {
        continue
      }

      if (event.type === 'chunk') handlers.onChunk(event.delta)
      else if (event.type === 'done') handlers.onDone(event.result)
      else handlers.onError(event.message)
    }
  }
}

export async function listAiConversations(
  query: AiConversationQuery = {},
): Promise<PaginatedResponse<AiConversationSummary>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<AiConversationSummary> }>('/ai/conversations', {
    params: query,
  })
  return data.data
}

export async function getAiConversation(id: string): Promise<AiConversationDetail> {
  const { data } = await apiClient.get<{ data: AiConversationDetail }>(`/ai/conversations/${id}`)
  return data.data
}

export async function getAiUsageSummary(query: AiUsageQuery = {}): Promise<AiUsageSummary> {
  const { data } = await apiClient.get<{ data: AiUsageSummary }>('/ai/usage/summary', { params: query })
  return data.data
}

export async function listAiUsage(query: AiUsageQuery = {}): Promise<PaginatedResponse<AiUsageLogEntry>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<AiUsageLogEntry> }>('/ai/usage', { params: query })
  return data.data
}

export async function listAiPromptTemplates(): Promise<AiPromptTemplate[]> {
  const { data } = await apiClient.get<{ data: AiPromptTemplate[] }>('/ai/prompt-templates')
  return data.data
}

export async function createAiPromptTemplate(dto: CreateAiPromptTemplateDto): Promise<AiPromptTemplate> {
  const { data } = await apiClient.post<{ data: AiPromptTemplate }>('/ai/prompt-templates', dto)
  return data.data
}

function extractErrorMessage(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string }; message?: string }
    return parsed.error?.message ?? parsed.message ?? null
  } catch {
    return null
  }
}
