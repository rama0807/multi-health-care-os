# NEXT.md

> The next logical task(s) to pick up. Replaced (not appended) whenever a
> milestone completes — this file always describes "start here," not history.

## Immediate Next Task

**Milestone 19 — Production Hardening** (`docs/roadmap.md`).

**Do not start it automatically.** Milestone 18 completed this session
(2026-08-06) under an explicit instruction ending *"Do NOT begin Milestone
19."* Wait for a fresh instruction.

AI development (Milestone 15) also remains **explicitly paused** after
Checkpoint 15.1 — see "AI Features — paused" below.

### Milestone 19 scope (`docs/roadmap.md`)

- Security audit (OWASP Top 10 review)
- Rate limiting on all public endpoints
- Request sanitization and validation hardening
- Structured logging with correlation IDs (Pino)
- Error monitoring integration (Sentry)
- APM (application performance monitoring)
- Database query optimization (N+1 analysis, slow query log)
- Load testing (k6)
- Production Docker images (multi-stage, minimal)
- Kubernetes manifests (optional)
- Production deployment runbook
- Disaster recovery procedure
- Backup strategy (daily DB snapshots, PITR)
- HIPAA compliance checklist

### What's already in the repo — audit before building any of it

Several Milestone 19 line items are **partly or wholly done already**.
Audit each before writing code:

- **Rate limiting exists.** `ThrottlerModule.forRoot([{ ttl: 60000, limit:
  100 }])` is registered globally in `app.module.ts`, with `ThrottlerGuard`
  first in the global guard chain. The gap is per-endpoint tuning (auth
  endpoints should be far stricter than reads), not the mechanism.
- **Structured logging exists.** `nestjs-pino` is configured in
  `app.module.ts` with a request serializer already emitting `req.id`. The
  gap is propagating that id through to service logs and outbound calls,
  not adopting a logger.
- **Validation hardening is largely in place.** Every DTO in the repo is a
  `createZodDto(...)` over a shared schema in `@medicore/types`, applied by
  a global `ZodValidationPipe`. Look for endpoints taking raw
  `Record<string, string>` query objects (the reports and notifications
  controllers deliberately do, narrowing in a `toFilter`/`toInboxQuery`
  helper) and decide whether that pattern needs tightening.
- **Docker artifacts exist**: `docker-compose.yml` and
  `docker-compose.prod.yml` at the repo root, plus `infra/`.
- **CI exists**: `.github/workflows/ci.yml`.
- **Metering infrastructure exists** — `common/tenant/api-usage.*` already
  counts requests per organization through a global interceptor. That is a
  rolling Redis window rather than a durable ledger (TD-0046), which is
  worth knowing before building APM on top of it.

### Security review starting points (from this repo's own TECH_DEBT)

- **TD-0042** — clinical context reaches a third-party AI provider with no
  BAA by default. `AI_INCLUDE_PATIENT_IDENTIFIERS=false` and
  `AI_PROVIDER=OLLAMA` are the two built-in mitigations. A HIPAA checklist
  has to reach a decision here.
- **TD-0050** — platform access is revocable per organization, not per user.
- **TD-0064** — notification provider credentials are deployment-wide, not
  per tenant.
- The double-gated platform isolation (ADR-0025) already has an e2e test
  asserting a tenant admin granted every `platform.*` permission still gets
  403. Extend that pattern rather than re-deriving it.

### Process reminders (from `CLAUDE.md`)

- Full verification before calling anything done: `pnpm lint && pnpm
  typecheck && pnpm test && pnpm test:e2e && pnpm build`.
- **Correct local infra (verified 2026-08-06):** containers are
  `medicore_postgres` (host port **5432**) and `medicore_redis` (host port
  **6379**). The e2e specs default to 5434/6381 via `??=`, so run them with
  the ports supplied explicitly:
  ```
  cd apps/api && DATABASE_URL="postgresql://medicore:medicore@localhost:5432/medicore_test?schema=public" \
    REDIS_PORT=6379 npx jest --config jest-e2e.config.ts --runInBand
  ```
  Remember to run `prisma migrate deploy` against the **test** database
  after adding a migration, or the e2e suite fails on a missing table.
- Current baselines: **727 API unit tests**, **6 web unit tests**,
  **408 e2e tests across 21 suites** — all passing.
- The unexplained Milestone 17 platform-suite flake **did not reappear**
  during Milestone 18's verification (full suite green). Still worth
  capturing the assertion if it ever returns.
- `.claude/settings.local.json` gained
  `env.ECC_DISABLED_HOOKS = "pre:edit-write:gateguard-fact-force"` during
  Milestone 18, with the user's explicit agreement, because GateGuard's
  fact-forcing hook prompts before every edit. Re-enable it by removing
  that entry whenever it is wanted again.

---

## Milestone 18 — Communication & Notification Platform: Complete

All seven checkpoints landed in one session (2026-08-06). See **ADR-0027**
and `PROGRESS.md`. Headlines, so a future session does not rebuild them:

- **`apps/api/src/modules/notifications/` is now the single entry point for
  "notify someone"** — one exported `NotificationsService.notify()` call.
  It imports no clinical, billing or inventory module, so it cannot
  introduce a module cycle, and it re-implements no business rule.
- **The `notification_deliveries` table *is* the queue.** `bullmq` is still
  an unused dependency and that is deliberate — do not "finish the job" by
  moving the queue into it without reading ADR-0027's reasoning first.
- **Suppressed ≠ failed.** Quiet hours, a muted category or a missing
  address produce `SKIPPED`, excluded from every success rate. Preserve
  that distinction in anything that reads delivery data.
- **`CRITICAL` bypasses every user preference by design**, and `SILENT` is
  in-app only.
- Templates are **bundled defaults** in `default-templates.ts` plus
  append-only versioned org overrides — a new notification type must work
  on a deployment nobody has configured.
- Event integration is **listeners on events that already existed**. Four
  one-line `emit` additions were the only changes to other modules'
  services: `inventory_stock.changed`, `staff.roster.assigned`,
  `hospital.created`, `organization.onboarded`.
- The notification worker is one non-overlapping `setInterval`, **off under
  `NODE_ENV=test`** — tests call `scheduler.tick()` explicitly. It emits
  `notifications.tick`, which is how `ScheduledReportsDispatcher` borrows
  the clock without a module dependency.
- Own-inbox routes carry **no permission**; `notifications.read`/`.send`/
  `.manage` gate the org-wide console only.
- **TD-0053 is closed** — scheduled reports genuinely run, export and email.
- Honest gaps recorded as **TD-0058 … TD-0066** — notably TD-0058 (the
  browser cannot mint an FCM token here: add `firebase` to `apps/web`, set
  the four `FCM_*` variables, and replace one `return null` in
  `acquireToken`) and TD-0059 (SMS/WhatsApp are abstractions with a log
  driver only, by instruction).

---

## AI Features — paused (resume here when AI work is unpaused)

Milestone 15 is split into **five checkpoints** (**ADR-0023**).
**15.1 — AI Clinical Assistant is complete** (provider abstraction, prompt
templates, conversation/usage/audit logging, feature flags, retry, token
accounting, streaming transport, and seven text-in/text-out clinical
generators). **15.2–15.5 are explicitly not started** and must not be picked
up without a fresh instruction to resume AI work.

### Checkpoint 15.2 — AI Document Intelligence (next AI checkpoint)

Reuses 15.1's platform layer end to end; adds **new input ingestion**:

- Lab report **PDF → text extraction → summarization** (the uploaded
  `LabTest.reportFileUrl` path, not the structured-results path 15.1
  already covers).
- Prescription **image OCR → structured `PrescriptionItem[]` extraction**,
  with a human review-and-confirm step before anything is written to a real
  prescription.
- Radiology **external report file → text extraction → summarization**
  (`RadiologyAttachment` of type `EXTERNAL_REPORT`/`PDF`).
- A shared `DocumentExtractionService` over the existing `StorageService` —
  no parallel storage path.
- Frontend: an "Extract & review" flow on the existing Lab Orders /
  Radiology Attachments / Prescriptions tabs.

Prerequisite to check first: whether a vision-capable model is reachable
with the configured provider (the abstraction already carries a
`supportsVision` capability flag — see `ai-provider.interface.ts`).

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
  (15.1 already writes them; this checkpoint adds the turn-taking read path
  and continuation).
- Tool/function-calling in the provider abstraction, wired to the existing
  `AvailabilityService`/`AppointmentsService` so the assistant books real
  slots rather than describing them.
- Frontend: a streaming chatbot widget.

### Checkpoint 15.5 — AI Governance, Analytics & Admin

- Per-org usage/cost dashboard over `AiUsageLog` (15.1 writes it; this
  checkpoint visualizes and reports on it). **Partially anticipated by
  Milestone 16** — the Organization Usage tab and Platform overview already
  surface real `AiUsageLog` aggregates (requests, tokens, estimated cost).
  **Milestone 17's report registry is the natural place to add an AI usage
  report**, rather than building a separate reporting surface.
- Quotas and rate caps per org/user/feature, enforced before dispatch.
  Note Milestone 16 added a general subscription-limit concept that is
  reported but not enforced (TD-0048) — worth unifying rather than
  duplicating.
- Prompt-template admin UI (versioning, activate, roll back) over the
  `AiPromptTemplate` model 15.1 introduced. **Milestone 18 built exactly
  this shape for notification templates** (`NotificationTemplateService` +
  the admin console's Templates tab) — follow it rather than inventing a
  second versioning UI.
- Model-routing configuration per feature (cheap model for summarization,
  stronger model for generation).
- Safety/guardrail review queue for flagged generations.

### Credential status — still relevant whenever AI work resumes

**Still genuinely credential-blocked in this environment.**
`apps/api/.env` holds placeholder `sk-xxxxxxxxxxxx` /
`sk-ant-xxxxxxxxxxxx` values. When no provider is configured every AI
endpoint returns a `503` with an explicit "AI is not configured" message —
it does **not** return fabricated clinical text (TD-0041). Checkpoint 15.2
must hold the same line: no fabricated OCR output, no fabricated extraction
results.

What's already in the repo for AI — do not rebuild: `apps/api/src/
common/ai/` (the complete provider abstraction), `apps/api/src/
modules/ai/` (prompt templates, clinical context builders, the seven
generators, conversations/usage read APIs, RBAC-gated controllers), the
`AiConversation`/`AiMessage`/`AiUsageLog`/`AiPromptTemplate` schema +
enums, and `apps/web/src/components/ai/`/`/dashboard/ai`.
