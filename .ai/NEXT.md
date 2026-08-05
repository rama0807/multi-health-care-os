# NEXT.md

> The next logical task(s) to pick up. Replaced (not appended) whenever a
> milestone completes — this file always describes "start here," not history.

## Milestone 15 — AI Features: Checkpoint Plan

Milestone 15 is split into **five checkpoints** (recorded as **ADR-0023**
in `DECISIONS.md`). The split follows the same precedent as Milestones
4/5/6/12: each checkpoint is independently shippable, has its own
verification pass, and does not require the next one to be useful.

The ordering is deliberate: **15.1 builds the whole AI platform layer**
(provider abstraction, prompt templates, conversation/usage/audit
logging, feature flags, retry, token accounting, streaming transport)
and proves it with the seven text-in/text-out clinical generators, which
need no new input-ingestion path. Every later checkpoint reuses that
layer rather than re-inventing it.

### Checkpoint 15.1 — AI Clinical Assistant ✅ COMPLETE (2026-08-05)

Platform layer + seven generators over data that **already exists** in
the EMR/Laboratory/Radiology/Prescriptions/IPD modules:

- Provider abstraction (OpenAI, Anthropic, Gemini, Ollama) behind one
  interface, selected by config — mirrors `StorageService`'s driver
  pattern.
- Prompt templates (bundled defaults + DB-stored, versioned org
  overrides).
- Conversation logging, audit logging, usage tracking, token accounting.
- Streaming (SSE) and non-streaming request paths.
- RBAC (`ai.generate`/`ai.read`/`ai.manage`, `ai.templates.*`), with
  doctor own-scope on generation.
- Feature flags (global kill switch + per-feature disable).
- Retry with exponential backoff + typed error mapping.
- Generators: SOAP Note, Clinical Note Summarization, Lab Result
  Summarization, Radiology Report Summarization, Prescription
  Explanation, Discharge Summary, Referral Letter.

### Checkpoint 15.2 — AI Document Intelligence (NEXT)

Reuses 15.1's platform layer end to end; adds **new input ingestion**:

- Lab report **PDF → text extraction → summarization** (the uploaded
  `LabTest.reportFileUrl` path, not the structured-results path 15.1
  already covers).
- Prescription **image OCR → structured `PrescriptionItem[]`
  extraction**, with a human review-and-confirm step before anything is
  written to a real prescription.
- Radiology **external report file → text extraction → summarization**
  (`RadiologyAttachment` of type `EXTERNAL_REPORT`/`PDF`).
- A shared `DocumentExtractionService` over the existing
  `StorageService` — no parallel storage path.
- Frontend: an "Extract & review" flow on the existing Lab Orders /
  Radiology Attachments / Prescriptions tabs.

Prerequisite to check first: whether a vision-capable model is
reachable with the configured provider (the abstraction already carries
a `supportsVision` capability flag — see `ai-provider.interface.ts`).

### Checkpoint 15.3 — AI Voice & Ambient Documentation

- New audio upload path (`StorageService`-backed) — the only one of the
  three roadmap input sources with no existing upload route.
- Transcription capability added to the provider abstraction
  (Whisper-class), config-driven like completion.
- Ambient consultation transcript → SOAP extraction → a **draft**
  `ClinicalNote` version the doctor edits and saves (never auto-commits
  clinical text).
- Frontend: a record/upload widget on the Encounter detail page's
  Subjective tab.

### Checkpoint 15.4 — Conversational Assistant & Scheduling Chatbot

- Multi-turn chat over the existing `AiConversation`/`AiMessage` models
  (15.1 already writes them; this checkpoint adds the turn-taking read
  path and continuation).
- Tool/function-calling in the provider abstraction, wired to the
  existing `AvailabilityService`/`AppointmentsService` so the assistant
  books real slots rather than describing them.
- Frontend: a streaming chatbot widget.

### Checkpoint 15.5 — AI Governance, Analytics & Admin

- Per-org usage/cost dashboard over `AiUsageLog` (15.1 writes it; this
  checkpoint visualizes and reports on it).
- Quotas and rate caps per org/user/feature, enforced before dispatch.
- Prompt-template admin UI (versioning, activate, roll back) over the
  `AiPromptTemplate` model 15.1 introduced.
- Model-routing configuration per feature (cheap model for
  summarization, stronger model for generation).
- Safety/guardrail review queue for flagged generations.

---

## Immediate Next Task

**Checkpoint 15.2 — AI Document Intelligence** (scope above).

### What's already in the repo — do not rebuild

- `apps/api/src/common/ai/` — the complete provider abstraction
  (`AiProvider` interface, OpenAI/Anthropic/Gemini/Ollama adapters,
  `AiClientService` with retry/token accounting/usage logging/streaming,
  `ai.config.ts`). **Reuse it; do not add a second provider path.**
- `apps/api/src/modules/ai/` — prompt templates, clinical context
  builders, the seven generators, conversations/usage read APIs,
  RBAC-gated controllers.
- Schema: `AiConversation`, `AiMessage`, `AiUsageLog`,
  `AiPromptTemplate` + the `AiProviderType`/`AiFeature`/`AiMessageRole`/
  `AiRequestStatus` enums.
- Frontend: `apps/web/src/components/ai/` (streaming assist dialog +
  button) and `/dashboard/ai` (conversations + usage).

### Credential status — read before starting

**Still genuinely credential-blocked in this environment.**
`apps/api/.env` holds placeholder `sk-xxxxxxxxxxxx` /
`sk-ant-xxxxxxxxxxxx` values. Checkpoint 15.1 handled this the way this
repo has always handled credential gaps (TD-0015 SMS, TD-0019 PACS,
TD-0027 payment gateway, TD-0039 biometric): the **full pipeline is
real**, and when no provider is configured every AI endpoint returns a
`503` with an explicit "AI is not configured" message — it does **not**
return fabricated clinical text. See **TD-0041**.

Checkpoint 15.2 must hold the same line: no fabricated OCR output, no
fabricated extraction results.

### Process reminders (from `CLAUDE.md`)

- Reading policy: 15.2 touches `common/ai`, `modules/ai`, Laboratory,
  Radiology, Prescriptions, and `common/storage`. Do not re-scan
  Staff/Attendance/Inventory/IPD/Billing.
- Full verification before calling anything done: `pnpm lint && pnpm
  typecheck && pnpm test && pnpm test:e2e && pnpm build`. Test DB
  containers are `medicore-postgres`/`medicore-redis` (host ports
  5434/6381) — start with `docker start medicore-postgres
  medicore-redis`, **not** `docker compose up`, which creates a
  different, unmapped pair.
