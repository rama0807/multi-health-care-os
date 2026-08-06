# ADR-007: AI Architecture and Provider Strategy

**Status:** Accepted  
**Date:** 2024-01-15

---

## Context

MediCore needs AI capabilities for medical report summarization, prescription OCR, voice transcription, and intelligent scheduling. AI providers evolve rapidly - models change, pricing changes, new capabilities emerge. We need an architecture that:
- Abstracts the AI provider behind a stable interface
- Supports swapping providers without feature code changes
- Handles async AI tasks without blocking requests
- Manages prompt versioning
- Tracks costs per organization

## Decision

**Provider-agnostic AI service layer** with pluggable adapters, async processing via BullMQ, and prompt versioning in the database.

## Architecture

```typescript
// Stable internal interface - never changes regardless of provider
interface AIProvider {
  complete(params: CompletionParams): Promise<CompletionResult>
  transcribe(audio: Buffer, language?: string): Promise<TranscriptionResult>
  extractStructured<T>(image: Buffer, schema: ZodSchema<T>): Promise<T>
}

// Implementations
class OpenAIAdapter implements AIProvider { ... }
class AnthropicAdapter implements AIProvider { ... }
class AzureOpenAIAdapter implements AIProvider { ... }

// Feature services use the abstraction
class ReportSummarizerService {
  constructor(private readonly ai: AIProvider) {}

  async summarize(reportText: string): Promise<MedicalSummary> {
    const prompt = await this.promptService.get('report-summarizer', 'v2')
    const result = await this.ai.complete({
      system: prompt.system,
      user: buildReportPrompt(reportText),
      maxTokens: 1000,
      temperature: 0.1,
    })
    return parseMedicalSummary(result.content)
  }
}
```

## Feature Modules

### 1. Report Summarizer
- **Input:** Lab report text (extracted from PDF) or radiology report text
- **Output:** Structured summary with: key findings, abnormal values, doctor's attention items
- **Model:** Claude claude-sonnet-4-6 or GPT-4o (low temperature, structured output)
- **Processing:** Async - user uploads report → queued → result stored → notification sent

### 2. Prescription OCR
- **Input:** Image of handwritten prescription
- **Output:** Structured prescription: medications, dosages, frequencies, instructions
- **Model:** GPT-4o Vision or Claude Vision
- **Processing:** Async - image uploaded → queued → extracted data for doctor review → confirmation

### 3. Voice Transcription
- **Input:** Audio recording of doctor-patient consultation
- **Output:** Timestamped transcript + SOAP note extraction
- **Model:** OpenAI Whisper (transcription) → GPT-4o (SOAP note extraction)
- **Processing:** Async

### 4. Appointment Chatbot
- **Input:** Patient natural language query
- **Output:** Booking intent + slot suggestions
- **Model:** GPT-4o-mini or Claude Haiku (fast, cheap - high volume)
- **Processing:** Synchronous (streaming response)

### 5. Anomaly Detector (Future)
- **Input:** Lab result values + patient history
- **Output:** Risk flags, recommended follow-ups
- **Model:** Fine-tuned or few-shot prompted

## Prompt Management

Prompts are stored in the database with versioning:

```
prompts table:
  id, key, version, system, user_template, model, temperature, active
```

This allows:
- A/B testing different prompt versions
- Rolling back a prompt without deployment
- Per-organization prompt customization (future)

## Cost Tracking

Every AI call records:

```
ai_usage_logs table:
  id, organizationId, feature, provider, model, inputTokens, outputTokens,
  estimatedCostUsd, durationMs, success, createdAt
```

This enables per-tenant billing and budget limits.

## Safety Constraints

- AI outputs are always presented as **suggestions** requiring human confirmation
- No AI output directly modifies medical records without doctor approval
- AI responses are logged for auditing and model improvement
- PII is scrubbed before sending to external AI providers in production
- A `useLocalAI` flag routes to self-hosted models for orgs with strict data policies

## Rejected Alternatives

**LangChain:** High-level orchestration framework. Rejected because it adds abstraction overhead for our simple use cases and changes its API frequently. Our thin provider adapter achieves the same goals with less complexity.

**Vercel AI SDK:** Excellent for streaming UI. We may use it on the frontend for the chatbot interface, but the backend AI service needs provider-agnostic processing that runs in workers.
