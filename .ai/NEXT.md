# NEXT.md

> The next logical task(s) to pick up. Replaced (not appended) whenever a
> milestone completes — this file always describes "start here," not history.

## Design System V2 — Phase 2 is the recommended next task

**Phase 1 (the reusable UI foundation) completed 2026-08-06** — see **ADR-0031**,
`PROGRESS.md` and `docs/design-system.md`. It changed the design *language*
only: no feature page, dashboard, API, business rule or test was touched, by
instruction.

Phase 2 is **migrating feature pages onto the primitives**. It has not been
started and should not be started without a fresh instruction.

### Read this before touching any of it

- **`apps/web/src/app/globals.css` is the only place a colour may be defined.**
  `tailwind.config.ts` contains no colour values at all — only token references.
  If a component needs a colour that does not exist, add a *token*; do not add a
  hex value to either file, and never inline one in a component.
- **Status colour is not per-page any more.** Use `<StatusBadge status={…} />`.
  If a status maps to the wrong tone, fix the map in
  `components/ui/status-badge.tsx` — that is the point of it. Do not pass `tone`
  to work around a bad mapping.
- **Branding is applied as CSS tokens, not as values you read.** A component
  styles itself with `bg-primary`; it never reads a colour from `useBranding()`.
  That hook is for the organization's *name* and *logo* only.
- **Never render a missing measurement as `0`.** `<EmptyValue />` prints an em
  dash. "Not recorded" and "zero" are different clinical and financial facts.
- **`EmptyState` distinguishes empty from filtered-empty.** A list with active
  filters and no rows must offer "Clear filters", not "Create your first…".
- **Scrolling belongs to the shell's `<main>`.** Do not add a second scroll
  container around a page; `<TableContainer>` with a `max-h-*` is how a table
  scrolls under its own sticky header.
- **Do not remove a pre-V2 variant or prop.** They are load-bearing for the ~90
  pages not yet migrated (TD-0077).

### Suggested order

1. **`StatusBadge` everywhere.** Largest consistency win, smallest diff, no
   layout risk.
2. **List pages** (Patients, Appointments, Laboratory) onto `PageLayout` +
   `FilterBar` + the table affordances — this is where density and sticky
   headers actually pay off.
3. **Dashboards** onto `StatCard`/`StatCardGrid` and `useChartTheme`, so chart
   series follow tenant branding.
4. **Detail pages** onto `PageLayout` with breadcrumbs and the `aside` column.

### Close TD-0074 first if branding matters

A design system whose branding reaches one role in six is not finished.
`GET /organizations/me/branding` is gated behind `organizations.read`, which only
Hospital Admin holds — so doctors, nurses, receptionists, pharmacists and lab
technicians all see the default palette. The frontend already consumes branding
correctly; the fix is a small backend change (include `branding` in the
login/refresh payload — preferred — or add an ungated public read endpoint).
Phase 1 was forbidden from making it.

Also open from Phase 1: **TD-0075** (hospital selector remembers a choice but
filters nothing), **TD-0076** (`/dashboard/settings` is a pre-existing 404 linked
from the sidebar and the profile menu), **TD-0077** (page migration itself).

---

## Paused AI Roadmap (Milestone 15.2–15.5)

**There is no active task.** Milestone 19 — Production Hardening & Enterprise
Readiness — completed on 2026-08-06, closing the last non-AI item on
`docs/roadmap.md`. AI development remains **explicitly paused** after Checkpoint
15.1 and must not be resumed without a fresh instruction.

Do not start a new milestone, do not resume AI work, and do not build new HMS
modules automatically.

---

## If production deployment is imminent, read this first

Milestone 19 recorded its gaps honestly rather than closing them silently. Two
matter before real patients:

- **TD-0070 — there is no backup automation.** `docs/operations/disaster-recovery.md`
  specifies the RPO/RTO targets, the `pg_dump` and PITR procedures, restore
  verification and a quarterly drill. **None of it is implemented.** Backup
  scheduling belongs to the infrastructure the deployment runs on, and this
  milestone was instructed not to invent deployment infrastructure. A deployment
  that follows the deployment guide exactly has *no backups*.
- **TD-0067 — rate limiting is per-process.** Required reading before running
  more than one API instance: N replicas allow N × the configured budget. The
  fix is a Redis throttler storage in `ThrottlerModule.forRootAsync`, reusing
  the existing `REDIS_CLIENT` provider.

Then work through `docs/operations/production-checklist.md`. Items marked ⛔
are enforced by the API at boot; items marked ⚠️ produce a `[startup]` warning
that is easy to ignore and should not be.

---

## What Milestone 19 changed — audit before touching any of it

- **`apps/api/src/bootstrap.ts` is where the HTTP hardening lives** — the
  Fastify adapter options, helmet, CORS, and the global pipe/filter/interceptor
  chain. `main.ts` calls it, and so does
  `test/production-hardening.e2e-spec.ts`. Put new transport-level
  configuration there, not in `main.ts`, or no test can assert it.
- **`config/env.validation.ts` can stop a deployment.** Errors abort the boot;
  warnings are replayed through the logger in `main.ts`. Add a rule there rather
  than a runtime check, and keep production-only rules behind the
  `NODE_ENV === 'production'` guard so `pnpm dev`/`test`/`test:e2e` need no new
  variables.
- **Liveness checks nothing external, deliberately** (ADR-0029). Do not "improve"
  `/api/health/live` by adding a database check — that turns a Postgres blip into
  a restart of every API pod.
- **No metric may carry a patient, user or tenant label**, and routes are
  labelled by matched pattern, never URL. Per-tenant usage belongs in
  `ApiUsageService`.
- **`notification_deliveries` is still the only durable queue** (ADR-0027).
  `BackgroundTaskService` is for work that may be lost on a hard kill — a
  welcome email, an invite. Anything that must survive a restart goes in the
  table.
- **`CacheService` keys are structurally tenant-scoped** and only
  configuration-shaped data is cached, so invalidation stays exact.
  `JwtStrategy`'s per-request lookup is **deliberately uncached** — it is what
  makes suspending a tenant take effect on the very next request.
- **The auth throttle is 20/minute, not 5.** The throttler keys on
  `request.ip`, and a hospital LAN presents one NAT address. Per-account lockout
  in `AuthService` is the precise defence; do not "tighten" the IP tier without
  understanding that.

### Process reminders (from `CLAUDE.md`)

- Full verification before calling anything done: `pnpm lint && pnpm typecheck
  && pnpm test && pnpm test:e2e && pnpm build`.
- **Correct local infra (verified 2026-08-06):** containers are
  `medicore_postgres` (host port **5432**) and `medicore_redis` (host port
  **6379**). The e2e specs default to 5434/6381 via `??=`, so supply the ports:
  ```
  cd apps/api && DATABASE_URL="postgresql://medicore:medicore@localhost:5432/medicore_test?schema=public" \
    REDIS_PORT=6379 npx jest --config jest-e2e.config.ts --runInBand
  ```
  Run `prisma migrate deploy` against the **test** database after adding a
  migration, or the e2e suite fails on a missing table.
- Current baselines: **785 API unit tests** across 96 suites, **6 web unit
  tests**, **431 e2e tests across 22 suites** — all passing.
- `pnpm format` / `format:check` are broken repository-wide (TD-0072) and are
  deliberately not in CI. Do not "fix CI" by adding them without first
  installing the two missing Prettier plugins and landing the reformat as its
  own isolated commit.
- `.claude/settings.local.json` still carries
  `env.ECC_DISABLED_HOOKS = "pre:edit-write:gateguard-fact-force"` from
  Milestone 18, with the user's explicit agreement. Remove that entry to
  re-enable the hook.

---

## AI Features — resume here when AI work is unpaused

Milestone 15 is split into **five checkpoints** (**ADR-0023**).
**15.1 — AI Clinical Assistant is complete** (provider abstraction, prompt
templates, conversation/usage/audit logging, feature flags, retry, token
accounting, streaming transport, and seven text-in/text-out clinical
generators). **15.2–15.5 are explicitly not started** and must not be picked up
without a fresh instruction to resume AI work.

### Checkpoint 15.2 — AI Document Intelligence (next AI checkpoint)

Reuses 15.1's platform layer end to end; adds **new input ingestion**:

- Lab report **PDF → text extraction → summarization** (the uploaded
  `LabTest.reportFileUrl` path, not the structured-results path 15.1 already
  covers).
- Prescription **image OCR → structured `PrescriptionItem[]` extraction**, with
  a human review-and-confirm step before anything is written to a real
  prescription.
- Radiology **external report file → text extraction → summarization**
  (`RadiologyAttachment` of type `EXTERNAL_REPORT`/`PDF`).
- A shared `DocumentExtractionService` over the existing `StorageService` — no
  parallel storage path.
- Frontend: an "Extract & review" flow on the existing Lab Orders / Radiology
  Attachments / Prescriptions tabs.

Prerequisite to check first: whether a vision-capable model is reachable with
the configured provider (the abstraction already carries a `supportsVision`
capability flag — see `ai-provider.interface.ts`).

### Checkpoint 15.3 — AI Voice & Ambient Documentation

- New audio upload path (`StorageService`-backed) — the only one of the three
  roadmap input sources with no existing upload route.
- Transcription capability added to the provider abstraction (Whisper-class),
  config-driven like completion.
- Ambient consultation transcript → SOAP extraction → a **draft**
  `ClinicalNote` version the doctor edits and saves (never auto-commits
  clinical text).
- Frontend: a record/upload widget on the Encounter detail page's Subjective
  tab.

### Checkpoint 15.4 — Conversational Assistant & Scheduling Chatbot

- Multi-turn chat over the existing `AiConversation`/`AiMessage` models (15.1
  already writes them; this checkpoint adds the turn-taking read path and
  continuation).
- Tool/function-calling in the provider abstraction, wired to the existing
  `AvailabilityService`/`AppointmentsService` so the assistant books real slots
  rather than describing them.
- Frontend: a streaming chatbot widget.

### Checkpoint 15.5 — AI Governance, Analytics & Admin

- Per-org usage/cost dashboard over `AiUsageLog` — **partially anticipated by
  Milestone 16** (the Organization Usage tab and Platform overview already
  surface real aggregates). **Milestone 17's report registry is the natural
  place to add an AI usage report**, rather than a separate reporting surface.
- Quotas and rate caps per org/user/feature, enforced before dispatch. Milestone
  16 added a subscription-limit concept that is reported but not enforced
  (TD-0048) — unify rather than duplicate. Milestone 19's throttler is per-IP
  and per-route, not per-tenant, so it is not the mechanism for this either.
- Prompt-template admin UI (versioning, activate, roll back) over
  `AiPromptTemplate`. **Milestone 18 built exactly this shape for notification
  templates** — follow it rather than inventing a second versioning UI. Note
  that Milestone 19.2 added caching to that resolution path; an AI template
  cache should follow the same exact-invalidation pattern.
- Model-routing configuration per feature (cheap model for summarization,
  stronger model for generation).
- Safety/guardrail review queue for flagged generations.

### Credential status — still relevant whenever AI work resumes

**Still genuinely credential-blocked in this environment.** `apps/api/.env`
holds placeholder `sk-xxxxxxxxxxxx` / `sk-ant-xxxxxxxxxxxx` values. When no
provider is configured every AI endpoint returns a `503` with an explicit "AI is
not configured" message — it does **not** return fabricated clinical text
(TD-0041). Checkpoint 15.2 must hold the same line: no fabricated OCR output, no
fabricated extraction results.

Milestone 19 added one relevant guardrail: enabling AI against a non-Ollama
provider in production now emits a `[startup]` warning pointing at TD-0042 (no
BAA by default). It warns; it does not block.

What's already in the repo for AI — do not rebuild: `apps/api/src/common/ai/`
(the complete provider abstraction), `apps/api/src/modules/ai/` (prompt
templates, clinical context builders, the seven generators, conversations/usage
read APIs, RBAC-gated controllers), the
`AiConversation`/`AiMessage`/`AiUsageLog`/`AiPromptTemplate` schema + enums, and
`apps/web/src/components/ai/` / `/dashboard/ai`.
