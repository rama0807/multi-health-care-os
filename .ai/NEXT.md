# NEXT.md

> The next logical task(s) to pick up. Replaced (not appended) whenever a
> milestone completes — this file always describes "start here," not history.

## Immediate Next Task

**Milestone 16 — Reports & Analytics** (`docs/roadmap.md`).

AI development (Milestone 15) is **explicitly paused** after Checkpoint
15.1 — see "AI Features — paused" below for that plan, preserved for
whenever AI work resumes. This session closed Milestone 3 (Patient
Management), the last unfinished *non-AI* milestone before Milestone
15 — see **ADR-0024** and `PROJECT_CONTEXT.md`'s Milestone 3 section.
Every roadmap milestone 1–14 is now complete end-to-end; **Milestone
16 — Reports & Analytics is the next unfinished non-AI milestone.**

### Milestone 16 scope (`docs/roadmap.md`)

- OPD/IPD statistics dashboard
- Revenue reports (daily, monthly, by service type)
- Doctor-wise consultation reports
- Lab test volume reports
- Bed occupancy reports
- Patient demographics report
- Custom date range reports
- PDF/Excel export for all reports
- Frontend: reports module with charts (Recharts)

### What's already in the repo — do not rebuild

Every module this reports on already exists and is fully built:
Appointments, Medical Records/Encounters, Laboratory, Radiology,
Billing (`Invoice`/`Payment`/`Charge`), IPD (`Admission`/`Bed`/`Ward`),
Patients. A reports module is a **read-only aggregation layer** over
existing tables — it should not duplicate any write path. Check
whether `recharts` is already a frontend dependency before adding it
(`apps/web/package.json`) — the roadmap names it explicitly.

### Process reminders (from `CLAUDE.md`)

- Reading policy: Milestone 16 touches every clinical/billing/IPD
  module read-only. Read schemas and existing dashboard-stats query
  patterns (e.g. `IpdDashboardService.getStats`,
  `BillingDashboardService`, `InsuranceDashboardService`) as the
  precedent for how this repo already does aggregation — don't
  re-read full module business logic that reports won't touch.
- Full verification before calling anything done: `pnpm lint && pnpm
  typecheck && pnpm test && pnpm test:e2e && pnpm build`. Test DB
  containers are `medicore-postgres`/`medicore-redis` (host ports
  5434/6381) — start with `docker start medicore-postgres
  medicore-redis`. `pnpm test:e2e` does not propagate the env vars
  jest-e2e specs default to — run e2e specs directly instead:
  `cd apps/api && DATABASE_URL="postgresql://medicore:medicore@localhost:5434/medicore_test?schema=public" REDIS_PORT=6381 npx jest --config jest-e2e.config.ts --runInBand`.

---

## AI Features — paused (resume here when AI work is unpaused)

Milestone 15 is split into **five checkpoints** (**ADR-0023**).
**15.1 — AI Clinical Assistant is complete** (provider abstraction,
prompt templates, conversation/usage/audit logging, feature flags,
retry, token accounting, streaming transport, and seven text-in/
text-out clinical generators). **15.2–15.5 are explicitly not
started** and must not be picked up without a fresh instruction to
resume AI work.

### Checkpoint 15.2 — AI Document Intelligence (next AI checkpoint)

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

### Credential status — still relevant whenever AI work resumes

**Still genuinely credential-blocked in this environment.**
`apps/api/.env` holds placeholder `sk-xxxxxxxxxxxx` /
`sk-ant-xxxxxxxxxxxx` values. When no provider is configured every AI
endpoint returns a `503` with an explicit "AI is not configured"
message — it does **not** return fabricated clinical text (TD-0041).
Checkpoint 15.2 must hold the same line: no fabricated OCR output, no
fabricated extraction results.

What's already in the repo for AI — do not rebuild: `apps/api/src/
common/ai/` (the complete provider abstraction), `apps/api/src/
modules/ai/` (prompt templates, clinical context builders, the seven
generators, conversations/usage read APIs, RBAC-gated controllers),
the `AiConversation`/`AiMessage`/`AiUsageLog`/`AiPromptTemplate` schema
+ enums, and `apps/web/src/components/ai/`/`/dashboard/ai`.
