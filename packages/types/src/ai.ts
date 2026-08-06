import { z } from 'zod'

// ─── Enums (mirror the Prisma enums - see ADR-0023) ────────────────────────

export const AI_FEATURES = [
  'SOAP_NOTE',
  'CLINICAL_NOTE_SUMMARY',
  'LAB_RESULT_SUMMARY',
  'RADIOLOGY_REPORT_SUMMARY',
  'PRESCRIPTION_EXPLANATION',
  'DISCHARGE_SUMMARY',
  'REFERRAL_LETTER',
] as const

export type AiFeature = (typeof AI_FEATURES)[number]

export const AI_PROVIDER_TYPES = ['OPENAI', 'ANTHROPIC', 'GEMINI', 'OLLAMA'] as const

export type AiProviderType = (typeof AI_PROVIDER_TYPES)[number]

export type AiMessageRole = 'SYSTEM' | 'USER' | 'ASSISTANT'

export type AiRequestStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED'

/** Human-readable labels, so the API and the UI never drift on wording. */
export const AI_FEATURE_LABELS: Record<AiFeature, string> = {
  SOAP_NOTE: 'SOAP Note',
  CLINICAL_NOTE_SUMMARY: 'Clinical Note Summary',
  LAB_RESULT_SUMMARY: 'Lab Result Summary',
  RADIOLOGY_REPORT_SUMMARY: 'Radiology Report Summary',
  PRESCRIPTION_EXPLANATION: 'Prescription Explanation',
  DISCHARGE_SUMMARY: 'Discharge Summary',
  REFERRAL_LETTER: 'Referral Letter',
}

/**
 * Attached to every generation result and rendered by the UI. AI output in a
 * clinical system is a *draft for clinician review* - nothing generated here
 * is written to a patient's record without an explicit human save action.
 */
export const AI_CLINICAL_DISCLAIMER =
  'AI-generated draft. Review and edit before use - this content has not been validated by a clinician and must not be relied on for clinical decisions on its own.'

// ─── Generation request ────────────────────────────────────────────────────

const additionalContext = z.string().max(4000).optional()

/**
 * One discriminated union rather than seven endpoints (ADR-0023): the features
 * differ only in which context builder runs and which prompt is selected, so
 * the flag check / scope check / conversation write / audit write live in one
 * place. The union still makes each feature's required context refs strict.
 */
export const GenerateAiContentSchema = z.discriminatedUnion('feature', [
  z.object({
    feature: z.literal('SOAP_NOTE'),
    encounterId: z.string().min(1),
    additionalContext,
  }),
  z.object({
    feature: z.literal('CLINICAL_NOTE_SUMMARY'),
    encounterId: z.string().min(1),
    additionalContext,
  }),
  z.object({
    feature: z.literal('LAB_RESULT_SUMMARY'),
    labTestId: z.string().min(1),
    additionalContext,
  }),
  z.object({
    feature: z.literal('RADIOLOGY_REPORT_SUMMARY'),
    radiologyOrderId: z.string().min(1),
    additionalContext,
  }),
  z.object({
    feature: z.literal('PRESCRIPTION_EXPLANATION'),
    prescriptionId: z.string().min(1),
    additionalContext,
  }),
  z.object({
    feature: z.literal('DISCHARGE_SUMMARY'),
    admissionId: z.string().min(1),
    additionalContext,
  }),
  z.object({
    feature: z.literal('REFERRAL_LETTER'),
    encounterId: z.string().min(1),
    referredToSpecialty: z.string().min(1).max(120),
    referredToName: z.string().max(160).optional(),
    reason: z.string().min(1).max(2000),
    additionalContext,
  }),
])

export type GenerateAiContentDto = z.infer<typeof GenerateAiContentSchema>

// ─── Generation result ─────────────────────────────────────────────────────

export interface AiTokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  /**
   * `true` when the provider did not return metered usage and the counts come
   * from the documented `ceil(chars / 4)` heuristic instead. Never conflate
   * the two - see ADR-0023.
   */
  estimated: boolean
  /**
   * Derived from configured per-1K rates, which default to 0. A `0` means
   * "no price configured," not "free."
   */
  estimatedCostUsd: number
}

export interface AiGenerationResult {
  conversationId: string
  feature: AiFeature
  content: string
  provider: AiProviderType
  model: string
  usage: AiTokenUsage
  latencyMs: number
  /** Provider calls made, including retries. 1 means it succeeded first try. */
  attempts: number
  disclaimer: string
}

/** SSE payloads emitted by `POST /ai/generate/stream`. */
export type AiStreamEvent =
  | { type: 'chunk'; delta: string }
  | { type: 'done'; result: AiGenerationResult }
  | { type: 'error'; message: string; statusCode: number }

// ─── Availability / feature flags ──────────────────────────────────────────

export interface AiFeatureStatus {
  feature: AiFeature
  label: string
  enabled: boolean
}

/**
 * What the UI asks before offering an AI action. `configured` is false when no
 * credential is present for the selected provider - in that state every
 * generation endpoint returns 503 rather than fabricating clinical text.
 */
export interface AiStatus {
  enabled: boolean
  configured: boolean
  provider: AiProviderType
  model: string
  streamingSupported: boolean
  features: AiFeatureStatus[]
  /** Populated when AI can't serve a request, explaining exactly what's missing. */
  unavailableReason: string | null
}

// ─── Conversations ─────────────────────────────────────────────────────────

export interface AiMessage {
  id: string
  sequence: number
  role: AiMessageRole
  content: string
  tokenCount: number | null
  createdAt: Date
}

export interface AiConversationSummary {
  id: string
  feature: AiFeature
  featureLabel: string
  title: string
  patientId: string | null
  patientName: string | null
  encounterId: string | null
  createdByUserId: string
  createdAt: Date
  updatedAt: Date
  messageCount: number
  totalTokens: number
}

export interface AiConversationDetail extends AiConversationSummary {
  messages: AiMessage[]
  labTestId: string | null
  radiologyOrderId: string | null
  prescriptionId: string | null
  admissionId: string | null
}

export interface AiConversationQuery {
  feature?: AiFeature
  patientId?: string
  encounterId?: string
  page?: number
  limit?: number
}

// ─── Usage tracking ────────────────────────────────────────────────────────

export interface AiUsageLogEntry {
  id: string
  feature: AiFeature
  featureLabel: string
  provider: AiProviderType
  model: string
  status: AiRequestStatus
  streamed: boolean
  promptTokens: number
  completionTokens: number
  totalTokens: number
  tokensEstimated: boolean
  estimatedCostUsd: number
  latencyMs: number
  attempts: number
  errorCode: string | null
  errorMessage: string | null
  userId: string | null
  conversationId: string | null
  createdAt: Date
}

export interface AiUsageByFeature {
  feature: AiFeature
  featureLabel: string
  requests: number
  totalTokens: number
  estimatedCostUsd: number
}

export interface AiUsageSummary {
  from: string
  to: string
  totalRequests: number
  succeededRequests: number
  failedRequests: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedCostUsd: number
  /** True when any row in the window used estimated (not metered) token counts. */
  containsEstimatedTokens: boolean
  averageLatencyMs: number
  byFeature: AiUsageByFeature[]
}

export interface AiUsageQuery {
  from?: string
  to?: string
  feature?: AiFeature
  page?: number
  limit?: number
}

// ─── Prompt templates ──────────────────────────────────────────────────────

export interface AiPromptTemplate {
  /** `null` for a bundled default, which has no database row. */
  id: string | null
  organizationId: string | null
  feature: AiFeature
  featureLabel: string
  version: number
  systemPrompt: string
  userPromptTemplate: string
  description: string | null
  isActive: boolean
  /** True when this is the bundled default rather than a stored org override. */
  isBuiltIn: boolean
  createdAt: Date | null
  updatedAt: Date | null
}

export const CreateAiPromptTemplateSchema = z.object({
  feature: z.enum(AI_FEATURES),
  systemPrompt: z.string().min(1).max(20000),
  userPromptTemplate: z.string().min(1).max(20000),
  description: z.string().max(500).optional(),
})

export type CreateAiPromptTemplateDto = z.infer<typeof CreateAiPromptTemplateSchema>

export const UpdateAiPromptTemplateSchema = z.object({
  isActive: z.boolean(),
})

export type UpdateAiPromptTemplateDto = z.infer<typeof UpdateAiPromptTemplateSchema>
