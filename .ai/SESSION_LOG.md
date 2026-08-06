# SESSION_LOG.md

> End-of-session handoff log. Newest entry on top. Each entry must let a
> fresh Claude Code session continue immediately without re-reading the
> whole codebase.

---

## Session — 2026-08-06 — Design System V2, Phase 2: every feature page migrated

### What was completed

Phase 2 of the same-day redesign instruction: migrated **all 18 frontend
modules** (Dashboard home, Patients, Doctors, Appointments, Medical Records,
Laboratory, Radiology, Pharmacy, Billing, Insurance, IPD, Nursing, Inventory,
Staff, Organization, Reports, Notifications, AI — ~90 files) onto the Phase 1
primitives (`PageLayout`, `StatusBadge`, `Card`/`CardHeader`/`CardContent`/
`CardFooter`, `TableContainer`+`Table`, `EmptyState`, `StatCard`/
`StatCardGrid`, `FilterBar`/`SearchInput`, real `recharts` charts). Full detail
in `PROGRESS.md` and `CHANGELOG.md`.

**Executed strictly UI/UX-only**, per explicit instruction: no backend, API,
route, business-logic, permission, workflow or Prisma-schema change; no
browser testing, screenshots or image generation; docs updated only now, at
the very end, not per-module.

**Cadence:** one module = one checkpoint. For each: read every file, migrate
header/table/badges/empty-states onto the primitives, then run
`pnpm --filter @medicore/web typecheck`, `lint`, `build` in sequence before
moving to the next module. All 18 passed clean before the full-repo
verification at the end.

**Centralizing `StatusBadge` surfaced real, pre-existing colour bugs** — not
introduced by this work, but only visible once every module's independent
status-colour guess was replaced by one shared map. See `CHANGELOG.md` for the
full list (Cancelled rendering red in two modules, In Consultation rendering
green, pharmacy low-stock rendering red instead of amber, an IPD bed-grid
contrast-pairing bug). Five additive entries were added to the shared
`STATUS_TONES` map (`UNDER_RENOVATION`, `ADMINISTERED`, `TRIALING`,
`PAST_DUE`, `SUCCEEDED`) — nothing existing was changed. One genuine semantic
ambiguity (nursing risk levels vs. lab abnormal flags both using `LOW`/`HIGH`
with opposite meaning) was handled via `StatusBadge`'s sanctioned `tone`
override, documented inline, rather than by corrupting the shared map.

### Files modified

~90 files under `apps/web/src/app/dashboard/**` (every module listed above),
plus `apps/web/src/components/ui/status-badge.tsx` (5 additive map entries)
and this session's `.ai/` doc updates (`PROGRESS.md`, `CHANGELOG.md`,
`MODULE_STATUS.md`, `TECH_DEBT.md`, `NEXT.md`, this file). No file outside
`apps/web` and `.ai/` changed.

### Architectural decisions made

None new — this executed the migration ADR-0031 already specified for Phase
2. The bug fixes above are corrections against ADR-0031's own stated status
vocabulary, not new decisions.

### Known issues

- **TD-0077 is now resolved.**
- **TD-0074 — branding still reaches only `organizations.read` holders.**
  Unchanged; needs a backend change, correctly out of scope for this pass.
- **TD-0075 — the hospital selector still filters nothing.** Unchanged for
  the same reason; its `.ai/TECH_DEBT.md` entry now says explicitly that Phase
  2 did not close it, rather than leaving that implied.
- **Not browser-verified. No screenshots** — both by the same explicit
  instruction that started this phase.
- **`pnpm test:e2e` could not be run** — pre-existing, documented local-infra
  gap (TD-0004: `medicore_test`/`medicore_dev` need a running, migrated
  Postgres + Redis this session's environment did not have). Confirmed
  unrelated: `git status` on `apps/api`/`packages/database` shows zero change
  from this session.

### Verification

`pnpm lint`, `pnpm typecheck`, `pnpm build` — clean across all 5 packages.
`pnpm test` — **785 API unit tests across 96 suites** and **49 web unit tests
across 3 suites**, zero failures (both unchanged from Phase 1 — this work
added no new tests, by design, since it changed no behaviour to test).
`pnpm test:e2e` — could not run; see above.

### Recommended next task

Nothing is queued automatically. The two realistic options, neither to be
started without a fresh instruction: (1) close **TD-0074** (include
`branding` in the login/refresh payload so every role sees tenant branding,
not just `organizations.read` holders) and **TD-0075** (wire
`activeHospitalId` into each module's queries) — both small, backend-touching
fixes; or (2) resume the explicitly-paused AI roadmap (Checkpoints 15.2–15.5).

### Estimated project completion

Unchanged in feature terms. Frontend presentation layer: **Design System V2
complete — both phases (100%)**. TD-0077 closed; TD-0074/TD-0075 remain open
and are backend-touching, not presentation work.

---

## Session — 2026-08-06 — Design System V2, Phase 1: the reusable UI foundation

### What was completed

A complete design system for the web app, under an explicit instruction that
this is **Phase 1 — the design language only**: no page redesign, no dashboard
redesign, no API change, no business-logic change, no test removal. See
**ADR-0031** for the full decision record.

**The audit came first and changed the work.** The frontend was stock
shadcn/ui with minor edits. Three findings shaped everything after:

1. `Organization.branding` has been editable through the Milestone 16 admin UI
   for two milestones and **had never affected a single pixel**. The
   white-label promise was a form that wrote JSON to a column.
2. The four clinical status colours were **hardcoded hex** in
   `tailwind.config.ts`, so they could not participate in theming at all, and
   each of ~90 pages chose its own status colours independently.
3. `packages/ui` — which `PROJECT_CONTEXT.md` and `MODULE_STATUS.md` both
   describe as the shared component library — **does not exist**. The real
   component surface is `apps/web/src/components/ui/`. Per `CLAUDE.md`, code is
   ground truth: the documentation was corrected, and Tailwind's now-dead
   content glob for it was removed.

**Delivered:** a full semantic token layer (light + a re-derived dark theme);
runtime tenant branding with WCAG-enforced colour derivation; a centralised
status-colour vocabulary; rebuilt tables, sidebar and top bar; and ~20 new
reusable primitives. Full detail in `CHANGELOG.md`.

**The branding colour engine is the part worth knowing about.** It never trusts
a configured colour: it derives seven roles per theme and moves each until it
clears WCAG AA against the surface it actually sits on. Writing its 43 unit
tests surfaced a genuine defect — a mid-grey brand colour (`#808080`) admits
**no** readable foreground, since neither white nor black clears 4.5:1 on a
50%-lightness fill — which the derivation now handles by pushing the fill off
the midpoint.

### Files modified

**Tokens and config**
- `apps/web/src/app/globals.css` — rewritten as the token layer
- `apps/web/tailwind.config.ts` — rewritten; contains no colour values

**Branding (new)**
- `apps/web/src/lib/branding/color.ts` + `color.test.ts` (43 tests)
- `apps/web/src/lib/branding/theme.ts`
- `apps/web/src/providers/branding-provider.tsx`
- `apps/web/src/providers/workspace-provider.tsx`
- `apps/web/src/providers/index.tsx` — both providers mounted inside `AuthProvider`
- `apps/web/src/lib/charts/palette.ts`

**Primitives — new**
- `components/ui/`: `skeleton`, `status-badge`, `empty-state`, `stat-card`,
  `breadcrumb`, `page-header`, `toolbar`, `entity-cell`, `timeline`,
  `progress` (also exports `Kbd`), `sheet`

**Primitives — refined onto tokens (all pre-V2 exports preserved)**
- `components/ui/`: `button`, `badge`, `card`, `table`, `input`, `select`,
  `tabs`, `dialog`, `dropdown-menu`, `tooltip`, `toast`

**Layout**
- `components/layout/nav-config.ts` (new — navigation extracted from the sidebar)
- `components/layout/page-layout.tsx` (new)
- `components/layout/hospital-selector.tsx` (new)
- `components/layout/sidebar.tsx`, `header.tsx`, `command-palette.tsx` — rebuilt
- `app/dashboard/layout.tsx` — shell scroll/padding

**Docs**
- `docs/design-system.md` (new), `.ai/DECISIONS.md` (ADR-0031),
  `.ai/TECH_DEBT.md` (TD-0074…TD-0077), `.ai/CHANGELOG.md`, `.ai/PROGRESS.md`,
  `.ai/MODULE_STATUS.md`, `.ai/NEXT.md`, `.ai/SESSION_LOG.md`

### Architectural decisions made

ADR-0031, in short: semantic tokens are the only colour surface; branding is
applied as an injected stylesheet (not inline styles) because dark mode needs a
*different* derivation of the same colour; a configured colour is corrected
until it passes WCAG rather than rendered as given; `accentColor`/
`secondaryColor` get their own token family instead of overwriting the neutral
`--accent`/`--secondary` interaction surfaces; **status colour is fixed and not
brandable**, because green-means-normal is a clinical convention rather than a
customisation; and every pre-V2 export was preserved so no page needed editing.

### Known issues

- **TD-0074 — branding reaches only `organizations.read` holders.** The endpoint
  is gated that way and Phase 1 could not change APIs. Most clinical users
  therefore see the default palette. The fix is to include `branding` in the
  login/refresh payload (preferred) or add an ungated public read endpoint.
- **TD-0075 — the hospital selector remembers a choice but filters nothing yet.**
  Said on screen rather than implied.
- **TD-0076 — `/dashboard/settings` is a 404** and always has been; the sidebar
  and profile menu both link to it. Left behaving exactly as before rather than
  silently re-pointed mid-redesign.
- **TD-0077 — feature pages still use pre-V2 call shapes.** They work and
  inherit the new tokens, density, typography, focus treatment and branding
  automatically; they do not yet use `PageLayout`, `StatusBadge`, the new table
  affordances, `EmptyState` or `StatCard`. This is Phase 2 by instruction.
- **Not browser-verified.** Verification was automated only (see below), which
  is this repository's default policy. No screenshots were captured.

### Verification

`pnpm lint`, `pnpm typecheck`, `pnpm build` — clean across all 5 packages.
`pnpm test` — **785 API unit tests across 96 suites** and **49 web unit tests
across 3 suites** (up from 6 — the 43 new branding tests), zero failures.
e2e — **431 tests across 22 suites**, zero failures, run against
`medicore_postgres` (5432) / `medicore_redis` (6379).

### Recommended next task

**Phase 2 — migrate feature pages onto the primitives, module by module.** Start
with `StatusBadge`: it removes the largest source of cross-module inconsistency
for the least code and touches no layout. Then the list pages (Patients,
Appointments, Laboratory) onto `PageLayout` + the table affordances, since they
are where density and sticky headers pay off most.

**Before or alongside that, close TD-0074** — a design system whose branding
reaches one role in six is not finished. It is a small backend change now that
the frontend consumes it.

### Estimated project completion

Unchanged in feature terms — this milestone added no HMS functionality. Frontend
foundation moves from "stock shadcn, unaudited" to **Design System V2 complete
(Phase 1 of 2)**; feature-page adoption is 0% and is Phase 2.

---

## Session — 2026-08-06 — Milestone 19: Production Hardening & Enterprise Readiness (all 7 checkpoints)

### What was completed

Milestone 19 in full, under an explicit instruction to **audit the repository
first**, treat the code as the source of truth, reuse existing services, not
rebuild existing functionality, and add **no new HMS features**. AI development
(Milestone 15.2–15.5) remained paused and untouched.

**The audit is the headline.** Most of what `NEXT.md` listed as Milestone 19
scope already existed and was correct: Zod validation on every DTO behind a
global pipe, namespaced own/all-scoped RBAC, a CSRF double-submit cookie applied
to exactly the cookie-authenticated routes, per-account login lockout, and
tenant isolation re-verified against the database on every request. On the
performance side, the two shapes most likely to be N+1s
(`AvailabilityService.getDashboardStats`, `NotificationsService.resolveRecipients`)
already batch with `{ in: [...] }`, and the 205 existing indexes cover the hot
filters. **No schema change was made and no migration was added.**

What was genuinely missing is what got built — plus three real defects found
while reading:

1. The container `HEALTHCHECK` polled `/api/health`, which **did not exist**
   (health was mounted at `/api/v1/health` only), so every deployment reported
   unhealthy.
2. `docker-compose.prod.yml` declared `depends_on: [postgres, redis]` against
   services **it never defined** — the production stack could not start.
3. nginx published 443 and mounted certificates, but **nothing listened on it**.

### Checkpoints

- **19.1 Security** — `@fastify/helmet` (CSP `default-src 'none'`, relaxed for
  inline script/style *only when Swagger is mounted*, so `SWAGGER_ENABLED=false`
  tightens rather than hides); `CORS_ORIGINS` list that refuses `*`; **startup
  environment validation that aborts the boot** on the shipped default cookie
  secret, a missing RS256 keypair, a wildcard origin or no Redis, and *warns
  without aborting* on a log-only SMS driver, an `http://` origin,
  container-local document storage, or AI against a third-party provider
  (TD-0042); per-endpoint throttling on the seven credential routes;
  `TRUST_PROXY` off by default; constant-time CSRF comparison.
- **19.2 Performance** — `CacheService` (tenant-scoped keys, `SCAN` not `KEYS`,
  Redis-down is a miss not an error) applied to notification template
  resolution; Prisma slow-query logging above `DB_SLOW_QUERY_MS` carrying the
  causing request id, parameterised SQL only.
- **19.3 Background processing** — `BackgroundTaskService`, deliberately not a
  second queue; six blocking outbound emails moved off the request path.
- **19.4 Observability** — `AsyncLocalStorage` request context; one request-id
  derivation rule shared by Fastify/pino/middleware; W3C `traceparent`;
  credential redaction; liveness + readiness + detailed health at version-neutral
  *and* `/v1` paths; bearer-authenticated Prometheus `/api/metrics`.
- **19.5 Deployment** — graceful shutdown (readiness 503 → drain → close);
  a working `docker-compose.prod.yml`; a hardened nginx with a real HTTPS block;
  an unprivileged API image.
- **19.6 CI** — `build` gated on the test jobs; one `CI` job to require in branch
  protection.
- **19.7 Docs** — `docs/operations/{deployment,operations,monitoring,disaster-recovery,runbook,production-checklist}.md`
  plus `production.env.example`.

### Files modified

**New (API):** `src/bootstrap.ts`, `src/config/security.config.ts`,
`src/config/env.validation.ts` (+spec), `src/common/observability/`
(`request-context.service.ts`, `request-context.middleware.ts`,
`trace-context.util.ts` (+spec), `metrics.service.ts`, `metrics.interceptor.ts`,
`observability.module.ts`), `src/common/background/`
(`background-task.service.ts` (+spec), `background.module.ts`),
`src/common/redis/cache.service.ts` (+spec),
`src/modules/health/health.service.ts` (+spec),
`src/modules/health/metrics.controller.ts`,
`test/production-hardening.e2e-spec.ts`.

**Changed (API):** `main.ts` (now thin — adapter/plugins/CORS moved to
`bootstrap.ts` so they are testable), `app.module.ts`, `prisma/prisma.service.ts`,
`common/filters/http-exception.filter.ts`, `common/guards/csrf.guard.ts`,
`common/redis/redis.module.ts`, `common/onboarding/staff-onboarding.service.ts`,
`modules/health/{health.controller,health.module}.ts`,
`modules/auth/{auth.controller,auth.service,strategies/jwt.strategy}.ts`,
`modules/appointments/appointments.service.ts`, `modules/users/users.service.ts`,
`modules/notifications/{notification-template,notification-scheduler}.service.ts`,
and five specs updated for new constructor arguments.

**Changed (infra/root):** `docker-compose.prod.yml`, `infra/nginx/nginx.conf`,
`apps/api/Dockerfile`, `.github/workflows/ci.yml`, `apps/api/package.json`
(+`@fastify/helmet`, `prom-client`).

**New (docs):** `docs/operations/` — six guides + `production.env.example`.

**Updated (`.ai/`):** all eight files.

### Architectural decisions made

- **ADR-0028** — fail the boot on an unsafe environment; helmet at the
  application, not only at the proxy; one throttler tier overridden per route
  (because every configured throttler runs on every route); auth limit of 20/min
  rather than 5, since the throttler keys on IP and a hospital LAN is NAT'd.
- **ADR-0029** — `AsyncLocalStorage` over a request-scoped provider; W3C trace
  propagation *without* an OpenTelemetry SDK; metrics labelled by route pattern
  only, never by URL or tenant; liveness deliberately checks nothing external.
- **ADR-0030** — fire-and-forget work is a service, not a bare `void`;
  `notification_deliveries` stays the only durable queue; caching is
  read-through, tenant-scoped and confined to configuration data;
  `JwtStrategy`'s lookup is deliberately *not* cached.

### Known issues / deferred

- **TD-0070 (High) — there is no backup automation.** The DR procedure is fully
  specified and entirely unimplemented, because backup scheduling belongs to the
  target infrastructure and the instruction was not to invent deployment
  infrastructure. **A deployment following the deployment guide exactly has no
  backups.** This is the most important thing for the next session or the next
  operator to know.
- TD-0067 rate limiting is per-process (only matters with replicas);
  TD-0068 every instance runs the notification worker (wasteful, not incorrect);
  TD-0069 trace context propagates but no OTel SDK exports spans;
  TD-0071 a second instance may serve a stale notification template for ≤300s;
  TD-0072 `pnpm format` has never worked — its Prettier plugins are not
  installed — which is why `format:check` was **not** added to CI.
- No browser verification and no screenshots (per instruction; no new UI).

### Verification

Run from the repository root, all clean:

| Gate | Result |
|---|---|
| `pnpm lint` | 5 packages, clean |
| `pnpm typecheck` | 5 packages, clean |
| `pnpm test` | **785 API unit** (was 727) across 96 suites, + 6 web |
| `pnpm test:e2e` | **431 across 22 suites** (was 408 / 21) |
| `pnpm build` | 4 packages, clean |

e2e run with the verified local infra:
`cd apps/api && DATABASE_URL="postgresql://medicore:medicore@localhost:5432/medicore_test?schema=public" REDIS_PORT=6379 npx jest --config jest-e2e.config.ts --runInBand`.
`infra/nginx/nginx.conf` was validated with a real `nginx -t`, and
`docker-compose.prod.yml` with `docker compose config`.

### Recommended next task

**Nothing automatically.** `NEXT.md` has been replaced with *"Paused AI Roadmap
(Milestone 15.2–15.5)"* per instruction. Do not resume AI work, and do not build
new HMS modules, without a fresh instruction.

If production deployment is imminent, the highest-value non-AI work is
**TD-0070** (backup automation) followed by **TD-0067** (Redis-backed throttler
storage, required before running more than one API instance).

### Estimated completion

- **Overall:** every roadmap milestone except the paused AI checkpoints
  15.2–15.5 is complete. Milestone 19 closes the roadmap's last non-AI item.
- **Affected modules:** `health` 100% for 19.4 (was "In Progress / Unaudited");
  four new cross-cutting components under `common/` at 100% for their
  checkpoints; every other module unchanged.

---

## Session — 2026-08-06 — Milestone 18: Communication & Notification Platform (all 7 checkpoints)

### What was completed

Milestone 18 in full, under an explicit instruction to audit first, treat
the repository as the source of truth, reuse existing services, not rebuild
existing functionality, and **integrate no paid providers** — abstractions
and local implementations only. AI development (Milestone 15) remained
paused and untouched.

The audit materially changed the plan:

1. `apps/api/src/modules/notifications/` **existed but was an empty stub** —
   a service with an unused constructor, a controller with no routes.
   Nothing in the repo had ever written to the `Notification` table, so the
   model could be reshaped without a data migration.
2. `common/email/` was already the working sender; the email channel wraps
   it rather than standing up a second one.
3. `EventEmitter2` was already wired with 125 emitted events across every
   module. Event integration added **listeners**, not emitters — with four
   one-line exceptions where an event genuinely did not exist.
4. `bullmq` was a dependency used nowhere, and stayed that way on purpose.

### Architecture (ADR-0027)

- **The delivery table is the queue.** Delivery history must be durable and
  queryable for the admin console anyway; a broker would duplicate those
  rows and eventually disagree with them. Claiming is a compare-and-set, so
  concurrent workers cannot double-send.
- **One notification, many deliveries**; the notification's status is
  *derived* from them, with `READ` sticky.
- **Suppressed ≠ failed.** A muted category or quiet hours produces
  `SKIPPED`, which is excluded from every success rate.
- **Preferences are evaluated at dispatch time**, not creation time.
- **`CRITICAL` overrides every preference** — quiet hours, muted
  categories, disabled channels — and the preferences page says so.
- **One `setInterval`**, non-overlapping, off under `NODE_ENV=test`; each
  tick emits `notifications.tick`, which is how the scheduled-report
  dispatcher borrows the clock without a module dependency.
- **FCM over HTTP v1 directly** (`node:crypto` JWT + `fetch`), no
  `firebase-admin`.

### Files

New: `config/notifications.config.ts`; the whole
`modules/notifications/` implementation (5 channel adapters, 8 services,
3 controllers, listener, DTOs, 4 spec files);
`modules/reports/cron-match.util.ts` (+ spec) and
`scheduled-reports.dispatcher.ts`; `test/notifications.e2e-spec.ts`;
`packages/types/src/notification.ts`; the web API client, push hook,
service worker, bell component and four pages.

Modified: `schema.prisma` (+ migration
`20260805200000_notification_platform`), `seed.ts`, `types/{index,enums}.ts`,
`app.module.ts`, the three stub notification files, `reports.module.ts`,
and **four one-line `emit` additions** in `stock.service.ts`,
`shift-roster.service.ts`, `hospitals.service.ts` and `auth.service.ts`
(plus their three spec files, for the new constructor argument).

### Verification

`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm build`
— all pass. **727 API unit tests** (+64), **6 web unit tests**,
**408 e2e tests across 21 suites** (+30). The full e2e suite was run to
green **twice** after the two fixes below. `pnpm db:seed` re-run so the new
`notifications.*` and `platform.notifications.*` permissions exist locally.

### Two defects the full-suite run caught (both fixed)

Neither showed up running the notification suite alone; both needed the
full 21-suite run:

1. **Wrong payload key in the staff-leave handler.**
   `StaffLeaveService` publishes `{ leaveId, staffId, … }`, and the listener
   read `payload.staffLeaveId`. That made
   `findUnique({ where: { id: undefined } })` throw a Prisma validation
   error on every leave approval. `safely()` caught it, so nothing broke
   visibly — it just logged. Fixed, and **every handler now guards on the id
   it needs before touching the database**: these payloads come from twelve
   modules that predate the listener and are not typed at the emit site, so
   an absent field must be a clean no-op rather than log noise.

2. **The e2e suite assumed one worker tick drains its own rows.**
   `claimDue` drains oldest-first *across every tenant*, bounded by
   `NOTIFICATIONS_WORKER_BATCH` (50). That is correct in production, but a
   shared e2e database had accumulated 67 `PENDING` deliveries from earlier
   runs — more than one batch — so the suite's own rows were never reached
   and four tests failed. Fixed on the **test** side (a bounded `drainQueue`
   helper that ticks until the queue reports no work, with a generous
   timeout on the first drain); the worker's behaviour was left alone
   because it is the behaviour that is wanted.

### Known issues

- **Not browser-verified** — no Playwright, no screenshots, by explicit
  instruction (TD-0066).
- **Browser push cannot obtain an FCM token in this deployment** (TD-0058).
  Everything else about push is real and tested; the missing piece is the
  `firebase` JS SDK plus a Firebase project. It is reported explicitly at
  every layer and never faked.
- The Milestone 17 e2e flake noted last session **did not reappear** across
  this session's full-suite runs (21/21 suites, 408/408 tests).
- New honest gaps: **TD-0058 … TD-0066**. **TD-0053 is resolved.**

### Recommended next task

**Milestone 19 — Production Hardening.** See `NEXT.md`, replaced
accordingly. AI Checkpoints 15.2–15.5 remain explicitly paused.

### Completion

- Overall: Milestone 18 is closed. Milestone 19 remains, plus AI
  Checkpoints 15.2–15.5.
- `notifications` module: **100% for Milestone 18**.
- Notification frontend pages: **100% for Milestone 18**.
- `reports` module: unchanged at 100% for Milestone 17, with TD-0053 now
  closed by the new dispatcher.

---

## Session — 2026-08-05 — Milestone 17: Reports & Analytics (all 5 checkpoints)

### What was completed

Milestone 17 in full, under an explicit instruction to generate everything
from existing data, **not** duplicate business logic, and reuse existing
services. AI development (Milestone 15) remained paused and untouched.

The session opened with an audit, which materially changed the plan:

1. `reports: ['read', 'export']` was **already in the seed permission
   catalog** and `/dashboard/reports` was **already a dormant
   `reports.read`-gated sidebar link** — the route just had nothing behind
   it. No new permission, no new nav entry.
2. `recharts` was **already** a dependency, so no chart library was added.
3. Five dashboard-shaped aggregation services already existed; their
   idioms were followed rather than replaced.
4. Three roadmap metrics are **not derivable** from this schema. Each
   shipped as the closest honest measure with the limitation stated in the
   API doc comment, the UI, and TECH_DEBT — none was faked.

### Architecture (ADR-0026)

- **Reports are a projection layer.** The module writes to exactly one
  table (`SavedReport`) and re-implements no rule. Overtime calls
  `ShiftsService.standardMinutes` rather than assuming an 8-hour day, so
  Payroll Prep and the staff report cannot disagree.
- **Dashboards compose the report services**, issuing one Prisma query of
  their own. A dashboard that re-queried would eventually contradict the
  report it links to.
- **One registry drives the builder and all three export formats**, so an
  exported file cannot show different numbers from the page it came from.
- **`to` is exclusive everywhere**; bucket keys are local-time, never
  `toISOString()` (which shifts the day in +05:30).
- **Null means "not measured"** — never 0. Carried through CSV, XLSX and
  PDF. `changePercent` is null when the previous period was zero.
- **A dependency-free XLSX writer** emits a real OOXML package; tests walk
  the ZIP central directory, not just the XML text.

### Files added

`apps/api/src/modules/reports/` — `report-range.util.ts`, eleven
`*-reports.service.ts`, `dashboards.service.ts`, `report-registry.service.ts`,
`report-export.service.ts`, `xlsx.util.ts`, `report-pdf.ts`,
`saved-reports.service.ts`, three controllers, `dto/saved-report.dto.ts`,
`reports.module.ts`, plus five spec files.
`apps/api/test/reports.e2e-spec.ts`.
`packages/types/src/reports.ts`.
`apps/web/src/lib/api/reports.ts`, `apps/web/src/app/dashboard/reports/`
(3 pages + `_components/charts.tsx` + `_components/report-filters.tsx`).

### Files modified

`packages/database/prisma/schema.prisma` (additive: `SavedReport` +
back-relation) and its migration `20260805162846_reports_and_analytics`;
`packages/types/src/index.ts`; `apps/api/src/app.module.ts`.

### Verification

`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm build`
— all pass. **663 API unit tests** (+48) and **378 e2e tests across 20
suites** (+43). Web build emits `/dashboard/reports`,
`/dashboard/reports/builder`, `/dashboard/reports/operational`.

### Known issues

- **Not browser-verified** — no screenshots taken, per the explicit
  "Do NOT use browser verification" instruction.
- **One non-reproducing e2e flake.** In the first full e2e run, one
  platform-suite test failed; it passed in three subsequent full runs and
  in an isolated run of that suite (36/36). The failing assertion was not
  captured before it stopped reproducing, so it is unexplained rather than
  fixed. Worth watching on the next full-suite run.
- New honest gaps: **TD-0051 … TD-0057**.

### Recommended next task

**Milestone 18 — Notifications & Communication.** See `NEXT.md`, which has
been replaced accordingly. Note TD-0053: the scheduled-report dispatcher is
a natural first deliverable for that milestone, since `SavedReport` already
persists a validated cron and recipient list with nothing reading it.

### Completion

- Overall: methodology unchanged (see `MODULE_STATUS.md`) — Milestone 17 is
  closed; Milestones 18 and 19 remain, plus AI Checkpoints 15.2–15.5.
- `reports` module: **100% for Milestone 17**.
- Frontend reports pages: **100% for Milestone 17**.

---

## Session — 2026-08-05 — Milestone 16: Platform & Multi-Tenant Administration (all 5 checkpoints)

### What was completed

Milestone 16 in full, redefined by explicit instruction from
`docs/roadmap.md`'s "Reports & Analytics" to **Platform & Multi-Tenant
Administration** (**ADR-0025**; roadmap renumbered 16→17→18→19).

The session opened with an audit, as instructed, and that audit shaped the
work: the `Organization → Hospital → Department → User → Patient` hierarchy
and per-request `orgId` filtering **already existed**, so tenant isolation
was never the gap. The real gaps were cross-tenant operation, tenant
lifecycle, subscriptions, usage metering, and audit filtering.

- **16.1 Organization Management** — profile/settings/branding/logo,
  administrators, hospital onboarding wizard, hospital activation,
  statistics, org-scoped filtered audit logs, and an 8-tab dashboard.
- **16.2 Platform Owner Console** — new `platform` module + isolated
  `/platform` route group: cross-tenant orgs/hospitals, suspend/reinstate/
  enable/disable, subscriptions, usage, global audit, global search,
  analytics.
- **16.3 Tenant Resolution** — extended the existing JWT rather than adding
  a mechanism; the only new claim is `isPlatform`, which fails closed.
- **16.4 Organization Settings** — full settings surface; holidays reuse
  Milestone 14's `Holiday` model rather than a second calendar.
- **16.5 Verification** — lint, typecheck, test, test:e2e, build all green.

### Files modified (~66)

**Schema/types:** `packages/database/prisma/schema.prisma` (+2 enums,
+5 `Organization` columns, +`Subscription`), migration
`20260805142007_platform_multi_tenant_admin`, `packages/database/prisma/seed.ts`,
`packages/types/src/{enums,organization,platform,hospital,auth,index}.ts`.

**API:** new `apps/api/src/common/tenant/` (tenant util/decorator/module,
`PlatformGuard`, `ApiUsageService` + interceptor, `StorageUsageService`,
2 spec files); new `apps/api/src/modules/platform/` (controller, 2 services,
DTO, module, spec); expanded `modules/organizations/` (service, controller,
2 new services, DTOs, module, spec) and `modules/hospitals/` (service,
controller, DTO, module, spec); `modules/audit/audit.service.ts`;
`modules/auth/{auth.service.ts,strategies/jwt.strategy.ts}`;
`modules/roles/roles.service.ts`; `app.module.ts`; 2 permission spec
fixtures; `test/platform.e2e-spec.ts` (new, 36 tests);
`test/doctor-documents.e2e-spec.ts` (pre-existing bug fixed).

**Web:** `lib/api/{organization,platform}.ts`;
`app/dashboard/organization/` (page + 8 tab components + `format.ts`);
`app/platform/` (layout + 5 pages); `components/layout/sidebar.tsx`.

**Docs:** `docs/roadmap.md`, `.ai/{DECISIONS,TECH_DEBT,PROGRESS,CHANGELOG,MODULE_STATUS,NEXT,SESSION_LOG,PROJECT_CONTEXT}.md`.

### Architectural decisions made (ADR-0025)

1. Platform tenant = `Organization.isPlatform`, not a new entity.
2. **Isolation gated twice**: `PlatformGuard` (org must be platform) **and**
   a `platform.*` permission excluded from org admins in both `seed.ts` and
   `RolesService.createDefaultOrgAdminRole`. `JwtStrategy` re-checks
   `isPlatform` against the DB every request. An e2e test proves a tenant
   admin holding every `platform.*` permission still gets 403.
3. Suspension reuses the pre-existing `Organization.isActive` that auth
   already enforces — **no auth-code change was needed**.
4. `Subscription`: one row per org, no history table (audit already stores
   before/after), legacy tier columns kept in sync, limits nullable =
   unlimited.
5. API metering in **Redis** (rolling 30-day window) rather than a DB write
   per request — disclosed, not hidden.
6. AI usage reported **for real** from `AiUsageLog`, not as the placeholder
   the brief allowed.
7. Branding in its own column so it can never clobber `settings`, which
   Patients/Billing/Appointments read without a fallback. Both merge.

### Known issues

- **TD-0044** no browser verification (by instruction; mirrors TD-0035/0036).
- **TD-0045** no platform organization *detail* page — its endpoints exist
  and are tested; only the page is missing.
- **TD-0046** API metering is a rolling Redis window, not a durable billing
  ledger. Stated in the UI.
- **TD-0047** storage usage measures recorded `fileSizeBytes`, not bucket
  contents; a new upload path must be added to `StorageUsageService` by hand.
- **TD-0048** no payment gateway; subscription limits are **reported but not
  enforced**, and `PAST_DUE` restricts nothing. Both stated in-page.
- **TD-0049** global search excludes patients/clinical records by design.
- **TD-0050** platform access is revocable per organization, not per user.

Two bugs found and fixed en route:
- `doctor-documents.e2e-spec.ts` upserted `doctors.read.all` but granted its
  Doctor role `doctors.read.own` — it passed only against a pre-seeded DB.
- `.ai/NEXT.md` documented the test containers as ports 5434/6381; they are
  `medicore_postgres`:5432 and `medicore_redis`:6379.

### Verification

`pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm test` ✅ **615 API + 6 web**
(49 new) · e2e ✅ **335 across 19 suites** (36 new) · `pnpm build` ✅
(68 static pages).

Run e2e with explicit ports — the specs' `??=` defaults are wrong for this
machine:
```
cd apps/api && DATABASE_URL="postgresql://medicore:medicore@localhost:5432/medicore_test?schema=public" \
  REDIS_PORT=6379 npx jest --config jest-e2e.config.ts --runInBand
```

### Recommended next task

**Stop here.** The instruction was explicit: *"Stop after Milestone 16. Do
not start Milestone 17 automatically."* Milestone 17 (Reports & Analytics)
is scoped in `NEXT.md` and should not begin without a fresh instruction.
AI work (Milestone 15.2–15.5) remains separately paused.

If a browser becomes available, closing TD-0044 (screenshots for both new
surfaces) and TD-0045 (the platform org detail page) are the smallest
high-value follow-ups.

### Estimated completion

- Overall: ~**88%** of the 19-milestone roadmap (16 of 19 complete;
  Milestone 15 is 1 of 5 checkpoints and paused).
- `organizations` 100% · `hospitals` 100% · `platform` 100% ·
  `audit` 100% · `common/tenant` 100% (all for Milestone 16's scope).

---

## Session: 2026-08-05 (Milestone 3 — Patient Management, complete; AI development paused)

### What was completed
Explicit instruction: treat Checkpoint 15.1 (AI) as complete for now,
pause AI development (do not touch 15.2–15.5), and resume the next
unfinished **non-AI** HMS milestone. Per the instruction, read only
`CLAUDE.md`/`.ai/NEXT.md`/`.ai/PROJECT_CONTEXT.md`/`.ai/SESSION_LOG.md`
first. `NEXT.md` pointed only at AI checkpoints, so determined the next
non-AI milestone from `docs/roadmap.md` + `MODULE_STATUS.md`:
`patients` was the only pre-Milestone-15 module still listed
"In Progress / Unaudited" — Milestone 3 (Patient Management) had every
roadmap checkbox unchecked despite being in daily use by every later
milestone. Read `patients.service.ts`/`.controller.ts`/
`.service.spec.ts` end to end before designing anything: confirmed CRUD,
UHID generation, search, timeline, documents, emergency contacts, and
duplicate *detection* already existed and were tested. Exactly three
roadmap deliverables were missing: family linkage, patient merge, and
CSV import. Implemented all three. See **ADR-0024** for full reasoning.

- **Schema** (migration `20260805095836_patient_family_and_merge`,
  applied to both `medicore_dev`/`medicore_test`): `Patient` gained
  `headOfFamilyId` (self-relation, one level deep by design — enforced
  in the service layer, not the DB) and `mergedIntoId` (self-relation,
  provenance pointer to the merge survivor), both indexed.
- **Backend** (`apps/api/src/modules/patients/`): `linkFamilyMember`/
  `unlinkFamilyMember`/`listFamilyMembers`; `mergePatients` (reassigns
  `patientId` across all 16 linked models —
  `PATIENT_LINKED_MODELS` in `patients.service.ts` — plus family
  dependents, inside one transaction, then soft-deletes the source
  with `mergedIntoId` set; `restore()` now refuses a merged record);
  `importFromCsv` (new `csv-parser.util.ts`, a hand-rolled RFC 4180
  parser — no new dependency — sequential per-row reuse of `create()`,
  500-row cap, per-row success/failure report, no fabricated rows on a
  bad file). New DTOs and shared types in `packages/types/src/patient.ts`
  (`LinkFamilyMemberSchema`, `MergePatientsSchema`, `FamilyGroup`,
  `PatientMergeResult`, `CsvImportResult`).
- **RBAC**: new `patients.manage` permission (seed.ts) gates `POST
  /patients/merge` and `POST /patients/import` — admin-only by default
  (mirrors `billing.manage`'s precedent), not granted to Receptionist
  alongside their existing create/update. Family link/unlink reuse
  `patients.update`. Reseeded both `medicore_dev` (`pnpm db:seed`) and
  confirmed the e2e spec's own permission-upsert list covers the new
  action.
- **Audit**: `audit.listener.ts` gained `patient.family_linked`/
  `family_unlinked`/`merged`/`import_completed` handlers;
  `PatientEventPayload` gained an optional `metadata` field so these
  new events don't need bespoke per-field plumbing.
- **Tests**: 20 new unit tests (`patients.service.spec.ts` — family
  linkage guard rails, merge transaction reassignment, CSV row-level
  success/failure/cap; new `csv-parser.util.spec.ts`) — 578 API unit
  total. 4 new e2e tests (`patients.e2e-spec.ts` — family link/list/
  unlink, merge with a real reassigned document, CSV import with a
  real created + a real rejected row) — 299 e2e total across 18
  suites, zero failures.
- **Frontend**: `lib/api/patients.ts` extended. Patient detail page
  (`apps/web/src/app/dashboard/patients/[id]/page.tsx`) gained a
  "Family" tab (resolves the group from either the head or a member,
  link/unlink) and a "Merge" dialog in the header (a reusable
  `PatientSearchPicker`, direction choice, `patients.manage`-gated)
  plus a banner on a merged record linking to the survivor. Patient
  list page gained an "Import CSV" dialog (`patients.manage`-gated,
  per-row result list) next to the existing disabled "Export" button.
- **Full verification, all green**: `pnpm lint` ✅ (fixed one
  irregular-whitespace issue from a literal BOM character in a regex —
  switched to `﻿`), `pnpm typecheck` ✅, `pnpm test` ✅ (578 API +
  6 web unit, up from 558), `pnpm build` ✅ (all 6 packages, Next.js
  build included the new `/dashboard/patients/[id]` bundle). E2E run
  directly (per the standing `pnpm test:e2e` env-var-stripping issue):
  `cd apps/api && DATABASE_URL="postgresql://medicore:medicore@localhost:5434/medicore_test?schema=public" REDIS_PORT=6381 npx jest --config jest-e2e.config.ts --runInBand`
  → **18 suites / 299 tests, all passing, zero failures** (the
  previously-noted pre-existing `doctor-documents` flake from the prior
  session's log did not reproduce this run). Not browser-verified — no
  Playwright, no screenshots — per this session's explicit instruction.

### Files modified/created
- Schema: `packages/database/prisma/schema.prisma`,
  `packages/database/prisma/migrations/20260805095836_patient_family_and_merge/`.
- RBAC: `packages/database/prisma/seed.ts`.
- Shared types: `packages/types/src/patient.ts` (extended).
- Backend: `apps/api/src/modules/patients/patients.service.ts`
  (extended), `patients.controller.ts` (extended), new
  `csv-parser.util.ts`(+spec), `dto/link-family-member.dto.ts`,
  `dto/merge-patients.dto.ts`; `patients.service.spec.ts` (extended);
  `apps/api/src/modules/audit/audit.listener.ts` (extended);
  `apps/api/test/patients.e2e-spec.ts` (extended).
- Frontend: `apps/web/src/lib/api/patients.ts` (extended),
  `apps/web/src/app/dashboard/patients/[id]/page.tsx` (extended —
  Family tab, Merge dialog, `PatientSearchPicker`), `apps/web/src/app/
  dashboard/patients/page.tsx` (extended — Import CSV dialog).
- Docs: `.ai/PROJECT_CONTEXT.md`, `.ai/PROGRESS.md`,
  `.ai/MODULE_STATUS.md`, `.ai/CHANGELOG.md`, `.ai/DECISIONS.md`
  (ADR-0024), `.ai/TECH_DEBT.md` (TD-0043), `.ai/NEXT.md` (replaced).

### Architectural decisions made
See **ADR-0024** — full reasoning: family linkage kept one level deep
by application-layer validation rather than a variable-depth graph;
merge reuses the existing soft-delete lifecycle plus a new
`mergedIntoId` pointer rather than a third patient state; CSV import
reuses `create()` per row rather than a parallel bulk path, with a
hand-rolled parser rather than a new dependency; `patients.manage` is
a new admin-only permission separate from ordinary create/update.

### Known issues
- **TD-0043 (new, Medium):** `PATIENT_LINKED_MODELS` (the list of every
  model with a `patientId` column, reassigned on merge) is hand-
  maintained with no automated check that it stays in sync with the
  schema. A future module adding a `patientId` column and forgetting
  to add itself to this list would have its records silently orphaned
  on a merge — no error, easy to miss in review.
- No browser walkthrough, no screenshots — explicit instruction this
  session (mirrors TD-0035/TD-0036).
- AI Milestone 15 remains at Checkpoint 15.1 only, by instruction —
  15.2–15.5 untouched, still fully scoped in `NEXT.md` for whenever AI
  work resumes.

### Recommended next task
**Milestone 16 — Reports & Analytics** (`docs/roadmap.md`) — the next
unfinished non-AI milestone now that Milestones 1–14 are all complete.
Full scope and process reminders are in `NEXT.md`. Per this session's
own instruction, the following milestone was **not** started.

### Completion percentage
Overall: **16 of ~18 pre-AI-completion roadmap milestones/checkpoints
now fully complete end-to-end** (Patients, Doctors/Scheduling,
Appointments, Clinical/EMR, Laboratory, Radiology, Pharmacy, Billing,
Insurance, IPD — both checkpoints — General Inventory, Staff &
Attendance — plus foundational auth/RBAC/multi-tenancy scaffolding).
Milestone 15 (AI) remains at 1 of 5 checkpoints, paused by instruction.
**Patients module: 100% for Milestone 3.** No other module's
percentage changed.

---

## Session: 2026-08-05 (Milestone 15, Checkpoint 15.1 — AI Clinical Assistant, complete)

### What was completed
Read `CLAUDE.md`/`NEXT.md`/`PROJECT_CONTEXT.md`/`SESSION_LOG.md` first
per instruction, then split Milestone 15 into five checkpoints
(recorded in `NEXT.md`, reasoned in **ADR-0023**) and implemented
**15.1 only**. Confirmed before designing that `apps/api/src/modules/ai/`
was a 29-line no-op scaffold and that no AI schema/enum existed.

- **Provider abstraction** (`apps/api/src/common/ai/`): `AiProviderAdapter`
  + four real HTTP adapters (OpenAI, Anthropic, Gemini, Ollama), a
  `useFactory` picking one from `ConfigService` (StorageModule's exact
  pattern), and `AiClientService` (feature flags, retry with backoff,
  timeouts, token accounting, cost, error mapping). Streaming and
  non-streaming share one code path; only the sink differs.
- **Domain layer** (`apps/api/src/modules/ai/`): seven generators over
  one discriminated-union `POST /ai/generate` (+ SSE `/stream` over
  POST), `ClinicalContextService` (read-only reuse of EMR/Laboratory/
  Radiology/Prescriptions/IPD), bundled-default + org-override prompt
  templates, conversation/usage/audit persistence.
- **Schema**: migration `20260804231008_ai_clinical_assistant` —
  `AiConversation`, `AiMessage`, `AiUsageLog`, `AiPromptTemplate` +
  `AiProviderType`/`AiFeature`/`AiMessageRole`/`AiRequestStatus`.
  Applied to both `medicore_dev` and `medicore_test`.
- **RBAC**: `ai` (`read`/`generate`/`manage`) and `ai.templates`
  (`read`/`manage`) added to the seed catalog; Doctor own-scoped,
  Nurse all-scope.
- **Frontend**: `components/ai/` (streaming dialog + gated button),
  `/dashboard/ai` (Assistant/Conversations/Usage), sidebar item, and
  entry points on the Encounter detail header and IPD Discharge tab.

### Files modified
New: `apps/api/src/config/ai.config.ts`, `apps/api/src/common/ai/**`
(interface, errors, token accounting, stream parsing, 4 adapters,
client service, global module, 4 spec files),
`apps/api/src/modules/ai/**` (generation/conversations/usage/templates
services + 3 controllers + context builder + prompts + dto + 3 specs),
`apps/api/test/ai.e2e-spec.ts`, `packages/types/src/ai.ts`,
`apps/web/src/lib/api/ai.ts`, `apps/web/src/components/ai/**`,
`apps/web/src/app/dashboard/ai/page.tsx`.
Modified: `apps/api/src/app.module.ts`, `packages/database/prisma/
schema.prisma`, `packages/database/prisma/seed.ts`,
`packages/types/src/index.ts`, `apps/web/src/lib/api/client.ts`
(exported `getCsrfToken` for the streaming fetch),
`apps/web/src/components/layout/sidebar.tsx`, the Encounter detail
page, the IPD discharge tab, and all `.ai/` docs.
Deleted: `apps/api/src/modules/ai/ai.service.ts` (the no-op scaffold).

### Architectural decisions made
**ADR-0023** — the five-checkpoint split; provider abstraction in
`common/ai` not `modules/ai`; real HTTP adapters rather than stubs;
bundled-default + DB-override prompt templates (not a nullable-org
unique index); honest token accounting with a `tokensEstimated` flag
and config-driven costs; own-scope-capable `ai.generate`; two
feature-flag layers checked *before* any PHI read; SSE over POST rather
than Nest's GET-only `@Sse()`; one generic endpoint over a
discriminated union rather than seven controllers.

### Known issues
- **TD-0041 (new, High):** no AI provider credential exists here.
  `ai.config.ts` treats `sk-xxxxxxxxxxxx`-style placeholders as absent,
  so every generation endpoint returns **503 with an explicit reason**
  and no clinical text is produced. The e2e suite asserts that contract
  rather than asserting generated output.
- **TD-0042 (new, High):** clinical context goes to a third-party
  provider with no BAA by default. Two built mitigations —
  `AI_INCLUDE_PATIENT_IDENTIFIERS=false` (pseudonymisation, *not* Safe
  Harbor) and `AI_PROVIDER=OLLAMA` (nothing leaves the deployment).
- **Pre-existing, not mine:** `doctor-documents.e2e-spec.ts` → "lets a
  doctor read their own audit timeline" fails with 403. Reproduced
  identically on a pristine `HEAD` worktree, so it predates this work.
  Worth a dedicated look next session.
- `NEXT.md`'s note about test containers was **stale**: there is no
  `medicore-postgres`/`medicore-redis` pair on 5434/6381. The running
  compose containers are `medicore_postgres` (5432) and `medicore_redis`
  (6379). E2E specs default to 5434/6381 via `??=`, so run them as:
  `cd apps/api && DATABASE_URL="postgresql://medicore:medicore@localhost:5432/medicore_test?schema=public" REDIS_PORT=6379 npx jest --config jest-e2e.config.ts --runInBand`.
  **`pnpm test:e2e` does not work for this** — turbo strips the env
  vars, so every suite targets the non-existent 5434 and all 18 fail.
  Use `--runInBand`; the parallel default also causes spurious failures.

### Verification
`pnpm lint` ✅, `pnpm typecheck` ✅, `pnpm test` ✅ (558 unit, 75 suites
— 45 new), `pnpm build` ✅. E2E run serially with the env above:
**295 passed / 296**, the single failure being the pre-existing
`doctor-documents` one confirmed against a clean HEAD worktree. All 18
new AI e2e tests pass. Not browser-verified and no screenshots — by
explicit instruction this session (mirrors TD-0035/TD-0036).

### Recommended next task
**Checkpoint 15.2 — AI Document Intelligence** (scope in `NEXT.md`).
It must reuse `common/ai` rather than adding a second provider path.
If a real API key becomes available first, the higher-value move is to
extend `apps/api/test/ai.e2e-spec.ts` with the generation-path
assertions TD-0041 currently blocks — that validates 15.1's whole
pipeline before 15.2 builds on it.

### Completion percentage
Overall: unchanged in structure — Milestone 15 is now 1 of 5
checkpoints complete (~20% of the milestone). `ai` module: **100% for
Checkpoint 15.1**. No other module's percentage changed; the EMR,
Laboratory, Radiology, Prescriptions and IPD modules were read from,
never modified.

---

## Session: 2026-08-05 (Bugfix — doctors dashboard-stats 500)

### What was completed
Single-issue bugfix session, driven by a user screenshot of the
Dashboard with DevTools open: `GET /api/v1/doctors/stats/dashboard`
→ **500 Internal Server Error**, and the "Total Doctors"/"Active
Doctors" tiles reading 0 despite 8 seeded doctors.

**Root cause.** The demo seed wrote `DoctorScheduleDay.shifts` as
`{start, end, slotDurationMinutes, breaks:[{start, end}]}`, but the
canonical contract (`ScheduleShiftSchema`, `packages/types/src/
doctor-schedule.ts`) is `{startTime, endTime, slotDurationMinutes,
breaks:[{startTime, endTime}]}`. `AvailabilityService.
getDashboardStats` → `isNowWithinShift` → `toMinutes(shift.startTime)`
therefore called `.split(':')` on `undefined`:

```
TypeError: Cannot read properties of undefined (reading 'split')
    at toMinutes (availability.util.js:32:35)
    at isNowWithinShift (availability.util.js:82:19)
    at AvailabilityService.getDashboardStats (availability.service.js:149:25)
```

`shifts` is an untyped Prisma `Json` column and the seed cast its
literal straight to `Prisma.InputJsonValue`, so neither TypeScript,
Prisma, nor the 513-test suite could see the drift.

**How it was diagnosed** (worth reusing): the API's `HttpExceptionFilter`
returns a generic `"An unexpected error occurred"` and logs the stack
only to the dev server's stdout, which wasn't readable. Ran a second
API instance off the existing build — `PORT=4001 node dist/main.js >
api.log` — reproduced against it, and read the real stack from the
captured log. Confirmed first that every underlying Prisma query
succeeded (standalone `tsx` script), which correctly ruled out the DB
layer and pointed at the JS mapping.

### Files modified
- `packages/database/prisma/demo/foundation.ts` — shifts literal now
  uses `startTime`/`endTime` and is parsed through
  `ScheduleShiftSchema.array().parse(...)` before the
  `InputJsonValue` cast, so a future shape drift fails the seed loudly
  instead of silently poisoning the database.
- `packages/database/package.json` — added `@medicore/types`
  (`workspace:*`) as a **devDependency** so the seed can import the
  canonical schema. No cycle (`@medicore/types` depends only on zod);
  devDep, so `apps/api` is unaffected. Ran `pnpm install`.
- `.ai/CHANGELOG.md`, `.ai/TECH_DEBT.md` (TD-0040), `.ai/SESSION_LOG.md`.

Data repaired by re-running `pnpm db:seed:demo` (idempotent —
`resetDemoData` deletes `doctorScheduleDay`/`doctorSchedule` first).
**Any other developer's already-seeded database needs the same re-run.**

### Architectural decisions made
None — no ADR. This was a contract-conformance bug, not a design
change; the canonical shape in `packages/types` was already correct
and was treated as ground truth.

### Known issues
- **TD-0040 (new, Medium):** nothing automatically checks that
  seed-written `Json` columns match the Zod contract the services read
  by. `availability.service.spec.ts` mocks `doctorSchedule.findMany`
  with fixtures already in the correct shape, so it validated the
  reader against an assumed contract while the writer violated it —
  all 513 tests passed against a database no service could read. The
  fix above closes the one site; the general gap is open.
- Other `Json` columns (`Doctor.languagesSpoken`,
  `Organization.settings`) have not been audited for the same drift.
- No regression test was added for this specific bug — the meaningful
  test is the seed-vs-schema integration test described in TD-0040,
  not another mock-based unit test, which by construction could not
  have caught it.

### Verification
`pnpm lint`, `pnpm typecheck`, `pnpm test` (513 passed, 68 suites),
`pnpm build` — all green. Endpoint verified live against the running
dev server on :4000: `HTTP 200`, `{totalDoctors: 8, activeDoctors: 8,
availableToday: 8, onLeaveToday: 0, offDutyToday: 8, upcomingLeave:
[1 entry]}` (`offDutyToday: 8` is correct — checked at 04:49, outside
both the 09:00–13:00 and 17:00–20:00 shifts). Also re-verified the
endpoints the same bad data was silently breaking:
`/doctors/:id/schedule` 200, `/doctors/:id/availability/today` 200
(`nextShiftStart: 2026-08-05T09:00:00`), and
`/doctors/:id/availability?date=…` 200 with correctly generated
15-minute slots. Not browser-verified (no screenshot captured).

### Recommended next task
`NEXT.md` is unchanged by this session — resume the milestone work it
points to. If picking up the debt instead, TD-0040's option (1) — a
seed-output-vs-Zod integration test against `medicore_test` — is the
highest-value follow-up, since it generalises to every `Json` column.

### Completion percentage
Unchanged — this was a defect fix against already-delivered
functionality, not new scope. Milestone 4.2 (Doctor Scheduling &
Availability) was previously marked complete but was in practice
non-functional against seeded data; it is now genuinely working.

---

## Session: 2026-08-05 (Milestone 14 — Staff & Attendance, complete)

### What was completed
Continued directly from Milestone 13 per an explicit instruction
giving the full Milestone 14 deliverable list (Staff Management/
Attendance/Leave Management/Shift Scheduling/Payroll Preparation/
Dashboard/RBAC). Read `CLAUDE.md`/`NEXT.md`/`PROJECT_CONTEXT.md`/
`SESSION_LOG.md` first per the session's own instruction, then
inspected the existing `Staff` model (schema.prisma) and the 3-line
no-op `staff` module scaffold before designing anything — confirmed
both were unaudited pre-existing scaffolding, the same category as
`Medication`/`MedicalRecord`/`Ward`-`Bed`-`Admission` before their own
milestones. Also read `DoctorSchedule`/`DoctorLeave`/`AvailabilityService`
(Checkpoint 4.2) and their exact own-scope-resolution pattern
(`PermissionsService.getScope` + a `*RefService.findProfileForUser`
helper) before deciding Milestone 14's scope boundary. Recorded the
full design as **ADR-0022**: this milestone covers the **non-doctor**
employee population only (Nurse/Receptionist/Lab Technician/Radiology
Technician/Pharmacist/Cashier/HR/Inventory Manager) — Doctors keep
their existing Checkpoint-4.2 scheduling/leave system unmerged and
un-duplicated (recorded as TD-0039, not left ambiguous). Per the
reading policy, work touched Staff (new), Departments/Hospitals
(`DepartmentsService`/`HospitalsService.getById` reuse, mirroring
`DoctorsService`'s pattern), Scheduling (`availability.util.ts`'s
date-helpers reused directly, not duplicated), the Prisma schema, and
shared types. Did not re-scan Inventory/IPD/Billing/Insurance.

- **Schema** (migration `20260804210705_staff_attendance_management`,
  applied to both `medicore_dev`/`medicore_test`): `Staff` extended
  with `hospitalId` (was missing), `employmentType`/`employmentStatus`
  enums (replacing the scaffold's `isActive`/`shiftType` — mirrors the
  `Ward`/`Room`/`Bed` "dedicated Status enum" precedent, ADR-0018),
  `reportsToId` self-relation, `dateOfLeaving`, `monthlySalary`. New
  models: `StaffDocument` (mirrors `DoctorDocument`), `Shift`
  (org-scoped catalog — `HH:mm` start/end, break/grace-period minutes,
  night-shift flag), `ShiftRoster` (one row per staff per date,
  `@@unique([staffId, date])`), `Attendance` (one row per staff per
  date, `AttendanceStatus` enum), `Holiday`, `LeaveTypeConfig`
  (per-org annual-day quota per the existing `LeaveType` enum),
  `StaffLeave` (mirrors `DoctorLeave`). The scaffold's `ShiftType`
  enum itself was kept (still used by `NursingNote.shift` from
  Milestone 12, unrelated to this milestone) — only `Staff`'s use of
  it was dropped.
- **RBAC** (`packages/database/prisma/seed.ts`): `staff`/`staff.
  documents` (mirrors `doctors`/`doctors.documents`), new `attendance`
  (`read`/`create`/`update`/`manage`), `leave` (`read`/`approve`/
  `manage` — deliberately matches `doctors.leave`'s action set),
  `shifts`/`shifts.roster` namespaces. Every non-doctor role
  (Nurse/Receptionist/Lab Technician/Radiology Technician/Pharmacist/
  Cashier/Inventory Manager) granted `.own`-scoped self-service
  (`attendance.read/create/update`, `leave.read/manage`,
  `shifts.roster.read`); HR granted the full all-scope admin set on
  every new namespace plus its own self-service grants.
- **Backend** (`apps/api/src/modules/staff/`, 20 new files, rewrote
  the 3-line scaffold): `StaffRefService` (mirrors `DoctorRefService`),
  `StaffService` (onboarding via the existing generic
  `StaffOnboardingService`, list/get/create/update/employment-status),
  `StaffDocumentsService`+`.controller.ts` (mirrors
  `DoctorDocumentService` exactly — same upload/list/delete shape,
  reuses `StorageService`), `ShiftsService` (catalog CRUD +
  `standardMinutes` — a static helper shared with attendance/payroll
  for shift-length calculation, crossing midnight for a night shift),
  `ShiftRosterService` (assign/bulk-assign/list, feeds
  `AttendanceService`'s lateness/half-day derivation), `AttendanceService`
  (`clockIn`/`clockOut` — server-derives Present/Late/Half-Day/Week-Off
  from the day's roster entry's shift grace-period/standard-minutes;
  `mark()` — HR backdated override; `correct()` — recomputes
  `workedMinutes`, flags `isCorrected`; monthly `calendar()`;
  `getDashboardStats()`), `HolidaysService`, `LeaveTypesService`
  (lists every `LeaveType` even if unconfigured, defaulting to 0
  days), `StaffLeaveService` (mirrors `DoctorLeaveService` — apply/
  approve/reject/cancel with an overlap conflict check; `getBalance()`
  computes annualDays-minus-approved-day-spans rather than storing a
  mutable counter, mirroring `Vital.bmi`/`IntakeOutputRecord`'s
  computed-field precedent), `StaffDashboardService` (headcount,
  today's attendance breakdown, pending leave approvals, by-department,
  shift coverage), `PayrollService` (`getSummary()` — present/late/
  half-day/absent days, paid/unpaid leave days split by
  `LeaveTypeConfig.isPaid`, overtime minutes/amount using a disclosed
  `monthlySalary / 30` per-day-rate convention, a leave-deduction
  amount, net payable days; `toCsv()` — hand-built CSV string, no new
  dependency).
- **Audit integration**: `audit.listener.ts` gained 13 new `@OnEvent`
  handlers (staff created/updated/employment-status-changed,
  document uploaded/deleted, attendance clocked-in/clocked-out/marked/
  corrected, leave requested/approved/rejected/cancelled).
- **Tests**: 8 new unit spec files (49 tests — `StaffService`'s
  onboarding-conflict paths, `ShiftsService`'s `standardMinutes` calc
  including a night-shift midnight-crossing case, `AttendanceService`'s
  full clock-in/out status-derivation matrix using
  `jest.useFakeTimers().setSystemTime(...)` for deterministic
  lateness, `StaffLeaveService`'s overlap + balance computation,
  `PayrollService`'s overtime/deduction math and CSV shape,
  `HolidaysService`/`ShiftRosterService`'s conflict/bulk-assign paths)
  + `apps/api/test/staff.e2e-spec.ts` (14 e2e tests — the full golden
  path against a real registered org: staff creation with a genuinely
  provisioned login account, a full-day shift + roster assignment
  chosen specifically to avoid wall-clock-time flakiness in lateness
  assertions, clock-in/clock-out/duplicate-clock-in-rejection,
  a manual correction, a document upload, leave-type config → apply →
  approve → balance reflecting the approved days, holiday-calendar
  CRUD, both dashboards, a payroll summary + a real downloaded CSV
  confirmed to contain the header row and the staff member's data, and
  an employment-status transition). All passing (513 API unit / 278
  e2e total across the whole API, zero failures — up from 471/264
  after Milestone 13).
- **Frontend** (`apps/web/src/lib/api/{staff,shifts,attendance,leave,
  payroll}.ts` — 5 new files; `apps/web/src/app/dashboard/staff/**` —
  7 new routes): Dashboard (`page.tsx` — stat tiles, a self clock-in/
  out widget gated on having a linked `Staff` profile, department/
  shift-coverage breakdowns), Directory (`directory/page.tsx` —
  search/filter/paginate + an add-staff dialog with real
  `listHospitals`/`listDepartments` pickers and a non-doctor
  `systemRole` select), Profile (`[staffId]/page.tsx` — Overview/
  Documents/Attendance-calendar/Leave-with-balance tabs, inline in one
  file rather than split into `_components/*` — a deliberate scope-
  saving deviation from the IPD-admission-detail-page precedent, not
  tech debt), Shifts (`shifts/page.tsx` — catalog CRUD with a
  night-shift checkbox), Roster (`roster/page.tsx` — a real
  week-navigable staff-by-date grid + an assign dialog using a real
  staff-picker `Select` — the first one in this repo's frontend, now
  that a real staff directory exists, replacing the free-text-ID
  precedent from Milestone 13/TD-0028 for this specific use case),
  Attendance (`attendance/page.tsx` — org-wide list with status/date
  filters + a correction dialog), Leave (`leave/page.tsx` — three tabs:
  Requests with approve/reject, Leave Types with inline quota editing,
  Holidays with an add dialog), Payroll (`payroll/page.tsx` — a month
  picker, a summary table, and a CSV export button reusing the
  `downloadBlob` pattern from `lib/api/billing.ts`). Reused the
  pre-existing dormant sidebar "Staff" nav item (`/dashboard/staff`,
  `staff.read`-gated) completely unchanged — no sidebar edit needed.
- **Full verification, all green**: `pnpm lint` / `pnpm typecheck` /
  `pnpm build` clean across all 6 packages; `pnpm test` — 513 API unit
  + 6 web, all passing; `pnpm test:e2e` — 278/278 passing. Both
  `medicore_dev`/`medicore_test` databases migrated and reseeded
  (permission catalog grew from ~171 to 191 rows) using the
  already-running, correctly-mapped `medicore-postgres`/
  `medicore-redis` containers (dash-named, ports 5434/6381) — no
  container-naming gotcha hit this session, unlike Milestone 13's.
- **No browser walkthrough, no screenshots** — this session's own
  verification instructions explicitly said not to (Playwright, a
  browser, screenshots, and manual walkthroughs were all named as
  "Do NOT"), mirroring Milestone 13's TD-0035 under the exact same
  kind of explicit instruction. Disclosed as **TD-0036** rather than
  claimed as browser-verified.
- Replaced `.ai/NEXT.md` with **Milestone 15 — AI Features**.

### Files modified/created
- Schema: `packages/database/prisma/schema.prisma`,
  `packages/database/prisma/migrations/20260804210705_staff_attendance_management/`.
- RBAC: `packages/database/prisma/seed.ts`.
- Shared types: `packages/types/src/enums.ts` (4 new enums),
  `packages/types/src/staff.ts`, `staff-document.ts`, `shift.ts`,
  `attendance.ts`, `staff-leave.ts`, `payroll.ts` (all new),
  `packages/types/src/index.ts`.
- Backend: `apps/api/src/modules/staff/*` (rewrote the 3-line
  scaffold; new: `staff-ref.service.ts`, `staff.service.ts`(+spec)+
  `.controller.ts`, `staff-documents.service.ts`(+spec)+
  `.controller.ts`, `shifts.service.ts`(+spec)+`.controller.ts`,
  `shift-roster.service.ts`(+spec)+`.controller.ts`,
  `attendance.service.ts`(+spec)+`.controller.ts`,
  `holidays.service.ts`(+spec), `leave-types.service.ts`,
  `staff-leave.service.ts`(+spec), `leave.controller.ts`,
  `staff-dashboard.service.ts`+`.controller.ts`,
  `payroll.service.ts`(+spec)+`.controller.ts`, `staff.module.ts`,
  `dto/*`), `apps/api/src/modules/audit/audit.listener.ts` (extended),
  `apps/api/test/staff.e2e-spec.ts` (new).
- Frontend: `apps/web/src/lib/api/staff.ts`/`shifts.ts`/
  `attendance.ts`/`leave.ts`/`payroll.ts` (new), `apps/web/src/app/
  dashboard/staff/page.tsx` (new), `.../directory/page.tsx` (new),
  `.../[staffId]/page.tsx` (new), `.../shifts/page.tsx` (new),
  `.../roster/page.tsx` (new), `.../attendance/page.tsx` (new),
  `.../leave/page.tsx` (new), `.../payroll/page.tsx` (new).
- Docs: `.ai/PROJECT_CONTEXT.md`, `.ai/PROGRESS.md`,
  `.ai/MODULE_STATUS.md`, `.ai/CHANGELOG.md`, `.ai/DECISIONS.md`
  (ADR-0022), `.ai/TECH_DEBT.md` (TD-0036, TD-0037, TD-0038, TD-0039),
  `.ai/NEXT.md` (replaced).

### Architectural decisions made
See **ADR-0022** in `DECISIONS.md` for the full reasoning — summary:
Milestone 14 covers non-doctor staff only (Doctors keep their existing
Checkpoint-4.2 system, deliberately not merged); `Staff` extended
in-place rather than replaced; `ShiftRoster` is a per-day assignment
table (not a versioned weekly template like `DoctorSchedule`) since
rotating/night shifts genuinely vary day to day; leave balance is
computed on read, not a mutable counter; Payroll Prep has no new
persisted model and stops at preparation/export by design; RBAC
namespacing mirrors `doctors.*`/`ipd.*`'s established sub-resource
pattern.

### Known issues
- TD-0036: No browser-verified screenshots for Milestone 14 — this
  session was explicitly told not to attempt it (mirrors TD-0035).
- TD-0037: Payroll Prep's per-day/per-hour rate (`monthlySalary / 30`)
  is a disclosed convention, not a configurable per-org pay policy.
- TD-0038: Attendance corrections apply immediately — no HR approval
  gate like `StaffLeave`'s apply→approve/reject workflow (low risk
  today since no self-service role is seeded with `attendance.update`).
- TD-0039: No doctor-duty-roster integration (by design — doctors keep
  their existing system) and no biometric attendance-hardware
  integration exists anywhere in this repo (same category as the
  SMS/AI-provider/payment-gateway/PACS credential-blocked gaps).

### Recommended next task
**Milestone 15 — AI Features**, per `docs/roadmap.md` and the
now-replaced `.ai/NEXT.md`. Do not re-implement or re-verify anything
from Milestone 14. Likely credential-blocked in this environment (no
real `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`) — read `TECH_DEBT.md`'s
prior credential-blocked disclosures (TD-0015/TD-0018/TD-0019) before
starting, and raise the question with the user rather than fabricating
provider responses.

### Estimated project completion
**Overall: ~15 of 18 roadmap milestones/checkpoints fully complete
end-to-end** (Doctors/Scheduling, Appointments, Clinical/EMR,
Laboratory, Radiology, Pharmacy, Billing, Insurance, IPD — both
checkpoints — General Inventory, Staff & Attendance — plus
foundational auth/RBAC/multi-tenancy scaffolding). **Staff module:
100% for Milestone 14** (backend + frontend both complete; TD-0036–
TD-0039 tracked, not blocking). Everything else's percentage remains
provisional per `MODULE_STATUS.md`.

---

## Session: 2026-08-05 (Milestone 13 — General Inventory, complete)

### What was completed
Continued directly from Frontend Checkpoint 1 (below) per an explicit
resume instruction stating the backend, dashboard, Item Master,
Lookups, API client, and sidebar fix were already done — did not
re-implement or re-verify any of it. Read every controller/service
under `apps/api/src/modules/inventory/` and the shared
`packages/types/src/inventory.ts`/`procurement.ts` types before
writing any frontend code, then built the ten remaining pages per
`NEXT.md`'s scope list: Stores, Stock + Transfers, Vendors, Purchase
Requests, Purchase Orders, Goods Receipt, Vendor Invoices, Store
Requisitions, Stock Audits, Assets + Maintenance. Recorded
**ADR-0020** (the Milestone 13 backend's own design, retroactively —
the backend's code comments already said "see ADR-0020" but it had
never been written) and **ADR-0021** (this session's frontend
decisions). Per the reading policy, work touched only Inventory
(reading `hospitals.ts`'s `listDepartments` once for the asset
department-assignment picker, and mirroring the Wards/pharmacy-stock/
pharmacy-dispense-detail pages once each as UI-pattern references, per
`NEXT.md`'s own suggestion).

- **Frontend** (`apps/web/src/app/dashboard/inventory/`, all new):
  `stores/page.tsx` (CRUD + manager-assignment dialog), `stock/
  page.tsx` (Stock levels + Transfers tabs), `vendors/page.tsx` (CRUD +
  rating dialog), `purchase-requests/page.tsx`+`[id]/page.tsx`,
  `purchase-orders/page.tsx`+`[id]/page.tsx` (`?fromPr=` deep-link
  prefill), `grn/page.tsx`+`[id]/page.tsx` (`?fromPo=` deep-link
  prefill), `vendor-invoices/page.tsx`, `requisitions/page.tsx`+
  `[id]/page.tsx`, `audits/page.tsx`+`[id]/page.tsx`, `assets/
  page.tsx`+`[id]/page.tsx`. `lib/api/inventory.ts` extended (Stores/
  Stock/Transfers/Vendors); new `lib/api/procurement.ts` (everything
  else) — split per `NEXT.md`'s own suggestion once `inventory.ts`
  would have gotten unwieldy. Inventory Dashboard's button row
  extended with a permission-gated link to each of the 10 new pages.
- **Judgment calls made, recorded in ADR-0021**: `?fromPr=`/`?fromPo=`
  query-param deep-linking (mirrors the existing `?wardId=`/`?roomId=`
  pattern on `/dashboard/ipd/beds`, ADR-0018) instead of a wizard or a
  separate "convert" route; free-text internal user ID inputs for
  store-manager and asset-user assignment since no staff/user picker
  exists anywhere in this repo yet (same shape as the pre-existing
  TD-0028); Vendor Returns (a working, tested backend) left without a
  frontend since it wasn't in the explicit remaining-scope list
  (TD-0034); no browser walkthrough or screenshots, per this session's
  own explicit instruction overriding the standing Screenshot policy
  (TD-0035).
- **One real bug fixed in passing** (not a feature change): four
  backend spec files (`assets`/`purchase-orders`/`requisitions`/
  `stock.service.spec.ts`) failed `pnpm lint`'s `@typescript-eslint/
  require-await` rule — `jest.fn(async (cb) => cb(prisma))` wrapped a
  callback in an unneeded `async` with no `await` inside. Removed the
  `async`; `cb(prisma)` already returns whatever `cb` returns (a
  promise, for every real `$transaction` caller), so no test behavior
  changed. Confirmed by re-running the full unit suite after the fix.
- **Full verification, all green**: `pnpm lint` / `pnpm typecheck` /
  `pnpm build` clean across all 6 packages; `pnpm test` — 471 API unit
  + 6 web unit, all passing (no new test files needed — pure frontend
  wiring against an already-tested API, no backend logic changed);
  `pnpm test:e2e` — 264/264 passing. Getting e2e running required
  starting Docker Desktop (`open -a Docker`, not running at session
  start) and then discovering `docker compose up postgres redis`
  creates containers (`medicore_postgres`/`medicore_redis`, no host
  port mapping matching `.env`'s expected 5434/6381, and conflicting
  with an unrelated project's container already on host port 5432) —
  stopped those and started the pre-existing, correctly-mapped
  `medicore-postgres`/`medicore-redis` containers (dash-named, ports
  5434/6381) instead, confirmed the `medicore_test` DB's migrations
  were current (they were), then all 264 e2e tests passed cleanly.
- **No browser walkthrough, no screenshots** — this session's own
  verification instructions explicitly said not to (Playwright, a
  browser, screenshots, and manual walkthroughs were all named as
  "Do NOT"), which overrides the standing Screenshot policy for this
  session only. Disclosed as TD-0035 per the Verification Policy
  rather than claimed as browser-verified — the only milestone in this
  repo without one.
- Replaced `.ai/NEXT.md` with **Milestone 14 — Staff & Attendance**.

### Files modified/created
- Frontend: `apps/web/src/lib/api/inventory.ts` (extended),
  `apps/web/src/lib/api/procurement.ts` (new), `apps/web/src/app/
  dashboard/inventory/page.tsx` (button row extended),
  `apps/web/src/app/dashboard/inventory/{stores,stock,vendors,
  purchase-requests,purchase-orders,grn,vendor-invoices,requisitions,
  audits,assets}/page.tsx` (new, 10 files) and `.../{purchase-requests,
  purchase-orders,grn,requisitions,audits,assets}/[id]/page.tsx` (new,
  6 files) — 16 new route files total (20 routes counting the 4
  already-existing dashboard/items/lookups pages from Checkpoint 1).
- Backend (mechanical lint fix only, no logic change):
  `apps/api/src/modules/inventory/{assets,purchase-orders,
  requisitions,stock}.service.spec.ts`.
- Docs: `.ai/DECISIONS.md` (ADR-0020, ADR-0021), `.ai/TECH_DEBT.md`
  (TD-0034, TD-0035), `.ai/PROGRESS.md`, `.ai/CHANGELOG.md`,
  `.ai/MODULE_STATUS.md`, `.ai/PROJECT_CONTEXT.md`, `.ai/NEXT.md`
  (replaced).

### Architectural decisions made
See **ADR-0020** (backend design, recorded retroactively — Item
Master's lookup grouping, the per-store/per-batch stock ledger with
shared `receiveStock`/`issueStock` mutation primitives, the four-entity
procurement chain, namespaced RBAC, sequential numbering) and
**ADR-0021** (this session's frontend decisions — deep-link query-
param prefill between procurement stages, free-text ID inputs where no
picker exists, Vendor Returns UI deferred, no browser walkthrough this
session by explicit instruction).

### Known issues
- TD-0034: Vendor Returns has a working, tested backend but no
  frontend yet.
- TD-0035: No browser-verified screenshots for Milestone 13 — every
  other milestone in this repo has one; this session was explicitly
  told not to attempt it.
- Store-manager and asset-user assignment both take a free-text
  internal user ID — no staff/user picker exists anywhere in this
  repo's frontend yet (same shape as the pre-existing TD-0028).

### Recommended next task
**Milestone 14 — Staff & Attendance**, per `docs/roadmap.md` and the
now-replaced `.ai/NEXT.md`. A `Staff` model and a `staff` module
scaffold already exist unaudited (same category as `Medication`/
`MedicalRecord`/`Ward`-`Bed`-`Admission` before their milestones) —
read them first, don't assume a clean slate. Decide explicitly whether
shift/leave/duty-roster reuse or extend the existing doctor-specific
`scheduling` module (Checkpoint 4.2) rather than silently duplicating
or silently merging.

### Estimated project completion
**Overall: ~14 of 18 roadmap milestones/checkpoints fully complete
end-to-end** (Doctors/Scheduling, Appointments, Clinical/EMR,
Laboratory, Radiology, Pharmacy, Billing, Insurance, IPD — both
checkpoints — General Inventory — plus foundational auth/RBAC/multi-
tenancy scaffolding). **Inventory module: 100% for Milestone 13**
(backend + frontend both complete; TD-0034/TD-0035 tracked, not
blocking). Everything else's percentage remains provisional per
`MODULE_STATUS.md`.

---

## Session: 2026-08-05 (Milestone 13, Frontend Checkpoint 1 — Inventory Dashboard, Item Master & Lookups)

### What was completed
Resumed via an explicit resume-point instruction stating Milestone 13's
backend/database/APIs/RBAC/tests were already done and only frontend
remained — confirmed against the repo: commit `e7f4abb` had landed the
full General Inventory backend (Item Master, Stores, Stock, Vendors,
Purchase Requests/Orders, Goods Receipt, Store Requisitions, Stock
Audits, Vendor Invoices, Assets + Maintenance) with unit/e2e tests, even
though `.ai/` docs still described Milestone 13 as not-yet-started. Per
the resume instruction, did **not** re-audit that backend. Built the
first frontend checkpoint: Inventory Dashboard, Item Master (catalog
list + create/edit), and a Categories & Lookups page (tabs for the 5
item-master lookup tables). See `PROGRESS.md` (2026-08-05 entry) for
full detail on what each page does.

### Files modified
- `apps/web/src/lib/api/inventory.ts` (new)
- `apps/web/src/app/dashboard/inventory/page.tsx` (new)
- `apps/web/src/app/dashboard/inventory/items/page.tsx` (new)
- `apps/web/src/app/dashboard/inventory/lookups/page.tsx` (new)
- `apps/web/src/components/layout/sidebar.tsx` (fixed a dead permission
  string: `inventory.read` → `inventory.items.read`)

### Architectural decisions made
None new — followed the existing pharmacy/IPD frontend patterns
(TanStack Query + the shared `Table`/`Dialog`/`Select`/`Pagination` UI
components) rather than inventing a new one. The five item-master
lookups were kept on one tabbed page rather than five separate routes,
mirroring the backend's own `ItemMasterService` grouping decision.

### Known issues
- Not browser-verified — no browser tool available this session.
  `pnpm --filter @medicore/web lint|typecheck|build|test` all pass, but
  the golden path (create an item, create a lookup, filter/paginate)
  has not been clicked through in a real browser. Flagging per the
  Verification Policy rather than claiming it works.
- The Milestone 13 backend (commit `e7f4abb`) itself remains unaudited
  by any session that has actually read through it end to end — treated
  as ground truth per the resume instruction, consistent with how prior
  milestones' pre-existing scaffolding was handled, but worth a real
  audit pass before calling Milestone 13 complete.
- No screenshots captured yet (blocked on the same missing browser
  tool) — `docs/screens/inventory-*.png` still owed once verified.

### Recommended next task
Continue Milestone 13 frontend: Stores page, Stock page (levels/adjust/
transfer), Vendors page, the Purchase Request → Purchase Order → Goods
Receipt procurement flow, Store Requisitions, Stock Audits, Vendor
Invoices, and Assets + Maintenance. See `NEXT.md`.

### Estimated project completion
Overall: unaudited (see TD-0001) — no change to the overall estimate
methodology this session. Inventory module: backend ~100% for Milestone
13 (unaudited in depth), frontend ~15% (3 of an estimated 10+ pages).
## Session: 2026-08-05 (Local environment brought up + demo-data seed added)

### What was completed
Environment/tooling session — **no milestone work, and Milestone 13 was
not started.** `NEXT.md` is unchanged and still describes Milestone 13
(General Inventory) as the next task.

1. **Docker stack running.** `docker compose --profile dev up -d` —
   postgres, redis, mailhog, minio, redis-commander all healthy.
2. **Environment files created** (they were absent — only `.env.example`
   files are checked in): `apps/api/.env` (from the example, with a
   freshly generated RS256 JWT keypair via `pnpm --filter @medicore/api
   keys:generate` and a random 32-byte `COOKIE_SECRET`), `apps/web/.env`,
   and `packages/database/.env` with `DATABASE_URL`/`DATABASE_URL_TEST`.
3. **Schema applied** — all 18 migrations deployed to **both**
   `medicore_dev` and `medicore_test` (97 tables), per TD-0004.
4. **Base seed run** (`pnpm db:seed`) — 161 permissions, 11 staff users.
5. **New demo-data seed** (`pnpm db:seed:demo`) — see CHANGELOG. Adds a
   realistic dataset across every completed module so the UI is not
   empty on a fresh database.

### Files modified
- Added: `packages/database/prisma/seed-demo.ts`,
  `packages/database/prisma/demo/{helpers,reference-data,reset,
  foundation,clinical,ipd,inventory}.ts`
- Modified: `packages/database/package.json` and the root
  `package.json` (added the `db:seed:demo` script). No application code
  was touched.

### Decisions made
- The demo seed is a **separate, additive script**, not a change to
  `prisma/seed.ts`. The base seed's "no fake patients" stance is
  deliberate and correct for a real deployment; demo data belongs behind
  its own opt-in command. No ADR raised — this is tooling, not
  architecture.
- Demo randomness is **deterministic** (fixed-seed LCG) so screenshots,
  manual walkthroughs and any future e2e expectations stay stable.
- Document numbering, and every derived value (BMI, GCS total, fall-risk
  and Braden bands, Charge Engine line maths, lab abnormal flags,
  invoice totals) is computed the way the services compute it, rather
  than filled with arbitrary values.

### Bugs found and fixed during this session
- **Per-module document counters collided.** The clinical and IPD
  seeders each had their own counter, so both issued
  `RX-MED-2026-000001` and tripped the
  `(prescriptionNumber, organizationId)` unique index. Fixed by moving
  the counter to a module-level singleton in `demo/helpers.ts`
  (`docNumber`/`resetCounters`).
- **Insured patients were double-paying.** A settled insurance claim
  created an `INSURANCE` payment on an invoice the patient had already
  paid in full in cash, so `sum(payments) > invoice.paidAmount`. Fixed
  by deciding the claim outcome before the payment: on a settled claim
  the patient now pays only their share and the insurer pays the rest.

### Verification performed
- `pnpm db:seed:demo` run three times — succeeds and is idempotent
  (identical counts each run).
- `tsc --noEmit --strict` clean over `prisma/seed-demo.ts` and its
  imports.
- SQL integrity checks against `medicore_dev`, all returning zero bad
  rows: invoice `subtotal - discount + tax = total`; `total - paid =
  balanceDue`; `sum(completed payments) = paidAmount`; no overpaid
  invoices; invoice status agrees with `balanceDue`; charge count per
  invoice equals invoice-item count; every SETTLED claim has an
  INSURANCE payment; no finalised discharge has an incomplete checklist
  item; occupied beds (14) equals currently-admitted patients (14).
- **Not run:** `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm test:e2e`, `pnpm build`. No application code changed, and the
  `@medicore/database` package defines no lint/typecheck scripts, so
  turbo would not cover these files. A future session touching app code
  should run the full suite as usual.
- **No browser walkthrough performed** and no screenshots captured —
  not requested, and per the Verification Policy automated verification
  is the default.

### Known issues / notes for next session
- **Port conflict, resolved by stopping another project's containers.**
  `rentrik-postgres` and `rentrik-redis` (a different project, with a
  restart policy that brings them up with Docker Desktop) were bound to
  5432/6379. With the user's approval they were stopped
  (`docker stop rentrik-postgres rentrik-redis`); restart them with
  `docker start` when needed. Expect this conflict again after any
  machine restart.
- **Compose can leave a container without its port binding.** After the
  first `up` failed part-way on the port conflict, `medicore_postgres`
  came up healthy but with no published host port, so Prisma reported
  `P1001` despite the container being fine. `docker compose up -d
  --force-recreate postgres redis` fixed it. Worth checking
  `docker ps --format '{{.Ports}}'` before debugging connection errors.
- **A stale `node` process was still listening on port 3000** from an
  earlier session (the TD-0004 addendum hazard). It was left running —
  kill it before starting `pnpm dev`.

### Recommended next task
Unchanged: **Milestone 13 — General Inventory**, exactly as `NEXT.md`
describes. Note that the demo seed now populates the Milestone 13
tables, so when auditing what already exists there, read the schema and
the `inventory` module code as `NEXT.md` instructs — do not infer
completeness from the presence of seeded rows.

### Estimated completion
Unchanged by this session (no product code was written).

---

## Session: 2026-08-04 (Milestone 12, Checkpoint 12.2 — Nursing, Medication Administration & Discharge, complete)

### What was completed
Continued directly from Checkpoint 12.1 without re-implementing or
re-verifying it. Resolved `NEXT.md`'s four framed judgment calls and
recorded the full reasoning as **ADR-0019**: nursing notes/
assessments/I-O charting/orders/tasks are new admission-scoped models
(nurse-authored, higher-frequency, tied to the stay — not
`ClinicalNote` reuse); IPD vitals charting reuses the existing
encounter-scoped `Vital` model completely unchanged; MAR reuses
`Prescription`/`PrescriptionItem` with a `MedicationAdministration`
admin-log child table (mirrors `DispenseOrder`/`DispenseItem`);
discharge is a four-step workflow (doctor approval → nursing checklist
+ summary → finalize) that closes TD-0030 by raising a real per-stay
room `Charge` at finalize. Per the reading policy, work touched IPD
(this session's own module, extending Checkpoint 12.1), Medical
Records (`Vital` reuse decision; `EncountersService.updateStatus`
reuse to close the encounter at discharge), Billing (`ChargesService.
create` reuse — added a new `ChargeSourceModule.IPD` enum member),
Prescriptions (`PrescriptionItem` reuse for MAR), Prisma schema, and
shared types.

- **Schema** (migrations `20260804220000_nursing_mar_discharge` and
  `20260804221000_ipd_charge_source_module`, applied to both
  `medicore_dev`/`medicore_test`): 8 new models — `NursingNote`
  (type/shift/content/`isEscalated`+reason), `NursingAssessment` (one
  consolidated row per event: pain score, fall risk score + server-
  derived level, Braden score + server-derived level, GCS eye/verbal/
  motor + server-computed total, general notes), `IntakeOutputRecord`
  (8 intake/output fields), `IpdOrder` (category/instructions/status/
  discontinue fields), `NursingTask` (optional `sourceOrderId`,
  priority/status/assignment/completion), `MedicationAdministration`
  (type/scheduledAt/administeredAt/status/doseGiven/route/
  barcodeVerified+scannedCode/nurseSignature), `DischargeChecklistItem`
  (8-key enum, `@@unique([admissionId, itemKey])`), `DischargeSummary`
  (one row per admission, not versioned — final diagnosis/course/
  procedures/condition/med-reconciliation/follow-up+doctor+
  prescription link). `Admission` gained `dischargeApprovedAt`/
  `dischargeApprovedByUserId`. `ChargeSourceModule` gained `IPD`
  (second migration, since the first had already been applied before
  this addition was noticed). Recorded **ADR-0019**.
- **RBAC**: new namespaced resources `ipd.nursing` (notes/assessments/
  I-O, all-scope read/create), `ipd.orders`/`ipd.tasks`/`ipd.mar`
  (all-scope read/create/update), `ipd.discharge` split into `create`
  (doctor approval)/`update` (nursing checklist+summary)/`manage`
  (finalize — mirrors `billing.manage`'s requester/approver
  separation). All-scope throughout, mirroring `ipd.beds`/
  `ipd.transfer`'s precedent rather than `ipd.admissions`' own-scope
  carve-out — disclosed as **TD-0032**, not silently accepted. Doctor
  role granted orders read/create/update + discharge read/create/
  manage + nursing/tasks/mar read-only; Nurse granted nursing/tasks/mar
  full read-write + discharge read/update (not create/manage);
  Receptionist granted discharge read-only.
- **Backend** (`apps/api/src/modules/ipd/`): `NursingNotesService`,
  `NursingAssessmentsService` (derives `FallRiskLevel`/
  `PressureUlcerRiskLevel` from disclosed Morse-style/Braden-style
  score thresholds, mirrors `laboratory`'s `abnormal-flagging.ts`
  precedent; computes GCS total server-side), `IntakeOutputService`
  (computes total intake/output/balance at read time, mirrors
  `Vital.bmi`'s computed-field precedent), `IpdOrdersService` (create/
  discontinue, blocks placing an order against a non-`ADMITTED`
  admission), `NursingTasksService` (admission-scoped list + an
  org-wide queue joined to patient/ward for display, optionally
  spawned from an `IpdOrder`), `MedicationAdministrationService`
  (`generateScheduled` — times-of-day × days, `createAdHoc` — PRN/STAT,
  `administer`/`recordException` — missed/refused/held/delayed, every
  action requiring a nurse signature; validates the prescription item
  belongs to the admission's patient), `DischargeService` (`approve` —
  idempotently seeds all 8 checklist items via `createMany` +
  `skipDuplicates`, `updateChecklistItem`, `upsertSummary` — validates
  `followUpDoctorId`/`dischargePrescriptionId`, `generateSummaryPdf` —
  a new `discharge-summary-pdf.ts` generator mirroring `insurance`'s
  encounter-summary-pdf pattern, `complete` — validates approval + every
  checklist item complete + a summary with a final diagnosis, then
  vacates the bed via the existing `BedAllocationService.vacate`,
  computes `days-stayed = ceil(elapsed-ms / 24h), min 1` and raises a
  `Charge` via `ChargesService.create` (`sourceModule: IPD`), closes
  the linked encounter via `EncountersService.updateStatus` if not
  already `COMPLETED`, and sets `AdmissionStatus.DISCHARGED`).
  `IpdDashboardService` extended with `inpatients`/`occupancyPercent`/
  `pendingDischarge`/`pendingNursingTasks`. `AdmissionsService.list`
  gained a `pendingDischarge` filter (`status: ADMITTED AND
  dischargeApprovedAt: not null`).
- **Audit integration**: `audit.listener.ts` gained ~20 new `@OnEvent`
  handlers across nursing notes/assessments, I-O, orders, tasks, MAR
  doses, and every discharge-lifecycle step.
- **Tests**: 7 new unit spec files (35 tests, including a full
  `discharge.service.spec.ts` covering approve/checklist/complete
  guard rails) + a new `apps/api/test/nursing-mar-discharge.e2e-
  spec.ts` (15 e2e tests — full lifecycle from admission through
  nursing docs, orders/tasks, MAR schedule+administer+missed, discharge
  approve→checklist→summary→complete, a real downloaded PDF). All
  passing (441 unit / 241 e2e total across the whole API, zero
  failures). One existing test fixed: `ipd-dashboard.service.spec.ts`'s
  mock Prisma object was missing the new `nursingTask` model, breaking
  after the dashboard's `getStats` was extended.
- **Frontend**: `apps/web/src/lib/api/nursing.ts`, `mar.ts`,
  `discharge.ts` (new). Four new tabs on `/dashboard/ipd/
  [admissionId]` (`_components/nursing-tab.tsx`, `orders-tab.tsx`,
  `mar-tab.tsx`, `discharge-tab.tsx`) wrapped in a `Tabs` component
  around the existing Overview content. New pages:
  `/dashboard/ipd/discharges` (pending/discharged queue),
  `/dashboard/nursing` (dashboard — census/occupancy/pending-tasks/
  pending-discharge tiles + a STAT-task alert panel),
  `/dashboard/nursing/tasks` (org-wide queue, status/priority filters),
  `/dashboard/nursing/patients` (patient census — no per-nurse
  ward-assignment model exists in this repo, disclosed on-page rather
  than fabricated). Sidebar gained a "Nursing" nav item under
  Clinical. IPD dashboard page gained 4 new stat tiles and
  Discharges/Nursing quick-link buttons.
- **Full verification, all green**: `pnpm --filter @medicore/database
  db:generate`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (441 api
  unit + 6 web), `pnpm test:e2e` (241/241), `pnpm build` (all 6
  packages).
- **Browser-verified end to end**: killed two stale dev-server
  processes squatting ports 3000/4000 from a previous session before
  starting fresh (per the standing TD-0004-addendum guidance), reseeded
  the dev DB to pick up the new permissions. Playwright installed ad
  hoc into the session scratch directory again (TD-0010, still open).
  One scripting gotcha hit: `waitForURL` with a loose regex
  (`/\/dashboard\/ipd\/[a-z0-9]+$/`) false-matched the static
  `/dashboard/ipd/admissions` list route (since "admissions" is itself
  all lowercase letters) — fixed by waiting for a real page-specific
  element instead of a URL pattern. Logged in as `admin@medicore.demo`,
  admitted a real patient (Ramesh Gupta) into ICU Ward Bed 34, recorded
  a nursing note + an assessment with a real derived "Fall risk: High"/
  "Pressure ulcer: Moderate"/"GCS 15/15" + an I-O chart entry with a
  real computed "Balance: 100ml", placed a doctor order that spawned a
  nursing task (completed), recorded real vitals (BP 128/82, Pulse 88,
  Temp 37.2°C, SpO2 96%) on the linked encounter, prescribed Amoxicillin
  and scheduled/administered a real MAR dose with a genuine nurse
  signature ("Nurse Anjali Verma") plus recorded a missed-dose
  exception, then walked discharge through approve → all 8 checklist
  items → summary → finalize — confirmed the bed correctly landed in
  "Cleaning" (not directly "Available"), the encounter flipped to
  "Completed", a real room `Charge` was created, and a genuine
  discharge-summary PDF downloaded — and confirmed the Discharges
  queue, Nursing Dashboard, Nursing Tasks queue, and IPD dashboard all
  reflect the real resulting state. 30 screenshots under
  `docs/screens/`.
- Replaced `.ai/NEXT.md` with **Milestone 13 — General Inventory**.

### Files modified/created
- Schema: `packages/database/prisma/schema.prisma`,
  `packages/database/prisma/migrations/20260804220000_nursing_mar_discharge/`,
  `packages/database/prisma/migrations/20260804221000_ipd_charge_source_module/`.
- RBAC: `packages/database/prisma/seed.ts`.
- Shared types: `packages/types/src/enums.ts` (10 new enums + `IPD`
  added to `ChargeSourceModule`), `packages/types/src/nursing.ts`
  (new), `packages/types/src/mar.ts` (new), `packages/types/src/
  discharge.ts` (new), `packages/types/src/ipd.ts` (extended
  `Admission`/`AdmissionQuery`/`IpdDashboardStats`),
  `packages/types/src/index.ts`.
- Backend: `apps/api/src/modules/ipd/*` (new: `nursing-notes.*`,
  `nursing-assessments.*`, `intake-output.*`, `ipd-orders.*`,
  `nursing-tasks.*`, `medication-administration.*`,
  `discharge.service.ts`(+spec)+`.controller.ts`,
  `discharge-summary-pdf.ts`, `dto/*` — each with `.service.ts`+
  `.spec.ts`+`.controller.ts`), `admissions.service.ts`/`.controller.ts`
  (extended), `ipd-dashboard.service.ts`(+spec, extended),
  `ipd.module.ts` (extended), `apps/api/src/modules/billing/` (no code
  change — `ChargesService` reused as-is), `apps/api/src/modules/
  audit/audit.listener.ts` (extended), `apps/api/test/
  nursing-mar-discharge.e2e-spec.ts` (new).
- Frontend: `apps/web/src/lib/api/nursing.ts`/`mar.ts`/`discharge.ts`
  (new), `apps/web/src/app/dashboard/ipd/[admissionId]/page.tsx`
  (extended with `Tabs`), `.../[admissionId]/_components/*.tsx` (new),
  `apps/web/src/app/dashboard/ipd/discharges/page.tsx` (new),
  `apps/web/src/app/dashboard/ipd/page.tsx` (extended),
  `apps/web/src/app/dashboard/nursing/page.tsx`/`tasks/page.tsx`/
  `patients/page.tsx` (new), `apps/web/src/components/layout/
  sidebar.tsx` (new nav item).
- Docs: `.ai/PROJECT_CONTEXT.md`, `.ai/PROGRESS.md`,
  `.ai/MODULE_STATUS.md`, `.ai/CHANGELOG.md`, `.ai/DECISIONS.md`
  (ADR-0019), `.ai/TECH_DEBT.md` (TD-0030 resolved, TD-0032/TD-0033
  opened), `.ai/NEXT.md` (replaced).
- Screenshots: `docs/screens/` — 30 new (`nursing-*.png`, `mar-*.png`,
  `discharge-*.png`, `admit-wizard-step1-patient.png`,
  `admit-wizard-step3-bed.png`, `admit-wizard-review.png`,
  `admission-created-bed-assigned.png`, `vitals-form-filled.png`,
  `vitals-recorded.png`, `bed-grid-after-discharge.png`,
  `discharges-queue-discharged.png`,
  `ipd-dashboard-with-nursing-stats.png`).

### Architectural decisions made
See **ADR-0019** in `DECISIONS.md` for the full reasoning — summary:
nursing docs are new admission-scoped models, not `ClinicalNote`
reuse; vitals charting reuses `Vital` unchanged; MAR reuses
`Prescription`/`PrescriptionItem` with an admin-log child table; all
new sub-resources are all-scope (not doctor-own-scoped, TD-0032);
discharge is a 4-step workflow ending in a real Charge Engine
integration (elapsed-time-based days-stayed, minimum 1); fall-risk/
Braden levels are server-derived from disclosed, documented score
thresholds (not a clinically-validated scoring service).

### Known issues
- TD-0030 (resolved this session): IPD billing integration and
  discharge are now genuinely reachable.
- TD-0032: nursing/MAR/discharge RBAC is all-scope, including for the
  Doctor role — a doctor can approve/finalize discharge for any
  admission, not only their own attended ones.
- TD-0033 (tracking only, disclosed): MAR's barcode fields have no
  real scanner hardware integration.
- TD-0031 (pre-existing, still open): ward/room deactivation doesn't
  check for occupied beds inside it.

### Recommended next task
**Milestone 13 — General Inventory**, per `docs/roadmap.md` (ADR-0017's
renumbering) and the now-replaced `.ai/NEXT.md`. Do not re-implement or
re-verify anything from Milestone 12 (either checkpoint).

### Estimated project completion
**Overall: ~13 of 18 roadmap milestones/checkpoints fully complete
end-to-end** (Doctors/Scheduling, Appointments, Clinical/EMR,
Laboratory, Radiology, Pharmacy, Billing, Insurance, IPD — both
Checkpoint 12.1 and 12.2 — plus foundational auth/RBAC/multi-tenancy
scaffolding). **IPD module: 100% for Milestone 12 (both checkpoints) —
Milestone 12 is now fully complete.** Everything else's percentage
remains provisional per `MODULE_STATUS.md`.

---

## Session: 2026-08-04 (Milestone 12, Checkpoint 12.1 — IPD Admission, Wards & Bed Management, complete)

### What was completed
Ran in Auto Mode. `NEXT.md` framed this as a clean schema slate for
`Ward`/`Bed`/`Admission` (per ADR-0017) — that was wrong: all three
models, plus `BedType`/`BedStatus`/`AdmissionStatus` enums, existed
unaudited since the very first scaffolding migration
(`20260730185306_auth_org_rbac`), the same category of unused scaffold
as `Medication` (ADR-0014) and the flat `MedicalRecord` (ADR-0008).
Confirmed via `git show 56857d3:.../schema.prisma`. Audited, extended
(not replaced), and recorded the full schema/RBAC design as
**ADR-0018**. Per the reading policy, work touched IPD (new module),
Patients (`patients.service.ts`'s `getTimeline`/`getSummaryCounts`
already queried `prisma.admission` — verified field-name compatibility
before touching anything), Encounters (`EncountersService` reuse for
auto-create-or-reuse-existing IPD encounter), Doctors
(`DoctorRefService` reuse), Insurance (`PatientInsurance` reuse for
"Insurance Admission"), Prisma schema, and shared types.

- **Schema** (migration `20260804120000_ipd_bed_management`, applied
  to both `medicore_dev`/`medicore_test`): new `Room`, `BedAllocation`,
  `BedTransfer` models. `Ward` gained `floor`/`block`/`type`/`status`
  (dropped the scaffold's `isActive`/`totalBeds` — bed counts are
  computed by query, matching every other dashboard stat in this
  repo). `Bed`'s unique constraint moved `[bedNumber, wardId]` →
  `[bedNumber, roomId]` (a room, not a ward, is the natural uniqueness
  scope); gained `roomId`. `Admission` gained `encounterId`/
  `attendingDoctorId` (renamed from the scaffold's `doctorId`)/
  `departmentId`/`roomId`/`patientInsuranceId`/`type`/
  `expectedDischargeAt`/`cancelledAt`/`cancelReason`/
  `createdByUserId`; `wardId` became required. New enums: `WardType`,
  `WardStatus`, `RoomStatus`, `AdmissionType`, `BedAllocationAction`;
  `BedType`/`BedStatus`/`AdmissionStatus` redefined to the checkpoint's
  spec'd value sets (dropped `AdmissionStatus.TRANSFERRED` — a
  mid-stay transfer is a `BedTransfer` event, not an admission-status
  change); `EncounterType` gained `IPD`. The scaffolded field names
  read by `patients.service.ts` (`admissionNumber`/`admissionReason`/
  `admittedAt`/`status`/`patientId`) were kept unchanged.
- **RBAC**: new `ipd.wards`/`ipd.rooms`/`ipd.beds` (inventory CRUD,
  all-scope), `ipd.admissions` (admit/cancel, own-scope-capable —
  Doctor role granted `.own`, mirroring `medical_records`/
  `prescriptions`), `ipd.transfer` (allocate/reserve/vacate/transfer
  workflow, all-scope, kept separate from `ipd.beds` since it's an
  action on a bed rather than editing the bed record). Nurse granted
  operational read + `ipd.beds.update` + `ipd.transfer.*`;
  Receptionist granted admission read/create + inventory read.
- **Backend** (`apps/api/src/modules/ipd/`, new module):
  `WardsService`/`RoomsService`/`BedsService` (CRUD, soft-deactivate —
  `BedsService` blocks deactivating an `OCCUPIED` bed; the ward/room
  equivalents don't yet, see TD-0031), `AdmissionsService` (one code
  path handles all four `AdmissionType`s; auto-creates a fresh `IPD`
  encounter or reuses a passed-in one when the patient/encounter match;
  cancel releases any held bed), `BedAllocationService`
  (allocate/reserve/cancel-reservation/vacate/transfer — a
  vacated/transferred-from bed lands in `CLEANING`, not directly
  `AVAILABLE`, mirroring a real ward cleaning workflow),
  `IpdDashboardService` (all real queries; discharges-today is a real
  query that always reads 0 this checkpoint since nothing sets
  `DISCHARGED` yet — a placeholder by construction, not faked).
  Sequential `ADM-<prefix>-<year>-<seq>` numbering (advisory-locked,
  mirrors `LAB-`/`RAD-` precedent).
- **Audit integration**: `audit.listener.ts` gained 8 new `@OnEvent`
  handlers (`ipd.admission_created/updated/cancelled`,
  `ipd.bed_allocated/reserved/reservation_cancelled/vacated/
  transferred`).
- **Tests**: 6 new unit spec files (47 tests) + `apps/api/test/
  ipd.e2e-spec.ts` (16 e2e tests — ward/room/bed CRUD with duplicate-
  code/number conflicts, admitting directly into a bed vs. ward-only,
  rejecting an already-occupied bed, transfer with real history,
  vacate landing in `CLEANING`, the dashboard's real counts, cancel
  releasing a re-allocated bed, 401 without a token). All passing
  (406 unit / 226 e2e total across the whole API — zero failures). One
  e2e setup gotcha hit and fixed: a register()-created test org has no
  `SystemRole.DOCTOR` role row (unlike the seeded demo org), which
  `StaffOnboardingService` requires — same gotcha `prescriptions.
  e2e-spec.ts` already worked around, mirrored here.
- **Frontend**: `apps/web/src/lib/api/ipd.ts` (new) + 6 new pages
  (`/dashboard/ipd` dashboard, `/wards`, `/rooms`, `/beds` — a
  color-coded Bed Grid grouped by ward/room, `?wardId=`/`?roomId=`
  deep-linkable — `/admissions` — queue + a 5-step Admit Patient
  wizard, `/[admissionId]` — allocate/reserve/cancel-reservation/
  vacate/transfer actions plus a merged bed-allocation-+-transfer
  history timeline). Sidebar's dormant "Wards & Beds" nav item
  (`departments.read`-gated, pointing at `/dashboard/wards`, unbuilt
  since Milestone 4) replaced with "IPD & Beds" → `/dashboard/ipd`,
  gated on `ipd.admissions.read`. Patient detail page gained a real
  "Admissions" tab (current admission + full history, encounter link).
- **Full verification, all green**: `pnpm --filter @medicore/database
  db:generate`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (406 api unit
  + 6 web), `pnpm test:e2e` (226/226), `pnpm build` (all 6 packages).
- **Browser-verified end to end**: a stale `node dist/main.js` process
  was squatting port 4000 from an earlier manual API smoke-test this
  session — killed and restarted via `pnpm dev` before the browser
  walkthrough, per the standing TD-0004-addendum guidance. Playwright
  installed ad hoc into the session scratch directory again (TD-0010,
  still open) — hit a real Radix Tabs gotcha along the way: `el.click()`
  (native DOM click) doesn't trigger Radix Tabs' tab-switch (it listens
  on `mousedown`, not `click`), so patient-page tab navigation needed a
  real Playwright `.click()` instead; and the Admit Patient wizard's
  final submit button shares its exact text ("Admit patient") with the
  page-header trigger button, so the click needed `[role="dialog"]`
  scoping to hit the right one. Logged in as `admin@medicore.demo`,
  created an ICU ward + a General ward, rooms, and beds, then ran the
  full 5-step Admit Patient wizard for a real patient (Rohan Mehta)
  into a real bed with a real doctor (Priya Sharma) — produced
  `ADM-MED-2026-000002` with a genuine auto-created IPD encounter —
  then transferred the patient to a second bed (old bed correctly
  landed in "Cleaning"), vacated it, and confirmed the Bed Grid,
  dashboard, and the patient's new Admissions tab all reflected the
  real state. 19 screenshots under `docs/screens/` (`ipd-*.png`).
- Updated `.ai/NEXT.md`: replaced entirely with **Milestone 12,
  Checkpoint 12.2 — Nursing, Medication Administration & Discharge**.

### Files modified/created
- Schema: `packages/database/prisma/schema.prisma`,
  `packages/database/prisma/migrations/20260804120000_ipd_bed_management/`.
- RBAC: `packages/database/prisma/seed.ts`.
- Shared types: `packages/types/src/enums.ts` (7 new enums + `IPD` added
  to `EncounterType`), `packages/types/src/ipd.ts` (new — full
  interface/zod-schema set), `packages/types/src/index.ts`.
- Backend: `apps/api/src/modules/ipd/*` (new: `wards.service.ts`
  (+spec)+`.controller.ts`, `rooms.service.ts`(+spec)+`.controller.ts`,
  `beds.service.ts`(+spec)+`.controller.ts`, `admissions.service.ts`
  (+spec)+`.controller.ts`, `bed-allocation.service.ts`(+spec)+
  `.controller.ts`, `ipd-dashboard.service.ts`(+spec)+`.controller.ts`,
  `ipd.module.ts`, `dto/*`), `apps/api/src/app.module.ts`,
  `apps/api/src/modules/audit/audit.listener.ts`,
  `apps/api/test/ipd.e2e-spec.ts`.
- Frontend: `apps/web/src/lib/api/ipd.ts` (new), `apps/web/src/app/
  dashboard/ipd/page.tsx` (new), `.../wards/page.tsx` (new),
  `.../rooms/page.tsx` (new), `.../beds/page.tsx` (new),
  `.../admissions/page.tsx` (new), `.../[admissionId]/page.tsx` (new),
  `apps/web/src/app/dashboard/patients/[id]/page.tsx` (new Admissions
  tab), `apps/web/src/components/layout/sidebar.tsx` (nav item
  replaced).
- Docs: `docs/roadmap.md` (Milestone 12 split into Checkpoints 12.1/
  12.2, 12.1 marked complete), `.ai/PROJECT_CONTEXT.md`,
  `.ai/PROGRESS.md`, `.ai/MODULE_STATUS.md`, `.ai/CHANGELOG.md`,
  `.ai/DECISIONS.md` (ADR-0018), `.ai/TECH_DEBT.md` (TD-0030, TD-0031),
  `.ai/NEXT.md` (replaced).
- Screenshots: `docs/screens/ipd-*.png` (19 new).

### Architectural decisions made
See **ADR-0018** in `DECISIONS.md` for the full reasoning — summary:
`Ward → Room → Bed` hierarchy with `Bed`/`Admission` denormalizing
`wardId` alongside the room-level FK; dedicated `Status` enums for
Ward/Room/Bed rather than this repo's usual `isActive` boolean (the
brief explicitly named "Status" as its own field, and `Bed` needs a
real 6-state operational machine); `Admission.bedId`/`roomId` optional
at creation (ward-only admission, bed allocated later, is a real
intake pattern); `Admission.encounterId` reused-if-passed /
auto-created-otherwise, handling all four admission types through one
path; `Admission.patientInsuranceId` is the entire "Insurance
Admission" implementation (no new pre-auth/claim workflow — the
existing Insurance module UI does that once billing exists to claim
against); `AdmissionStatus.DISCHARGED`/`ABSCONDED` kept as
not-yet-reachable enum values (mirrors `InvoiceStatus.OVERDUE`,
TD-0026); `BedAllocation` (single-bed event log) and `BedTransfer`
(from→to pair) as two separate history models rather than deriving
transfers from allocation pairs.

### Known issues
- TD-0030 (tracking only): IPD billing integration and discharge are
  Checkpoint 12.2, not built this session — `AdmissionStatus.
  DISCHARGED`/`ABSCONDED` exist but nothing sets them yet.
- TD-0031: deactivating a Ward or Room doesn't check for occupied beds
  inside it, unlike `BedsService.deactivate` which already blocks on
  `OCCUPIED` — a missing prevention check, not a data-loss bug.

### Recommended next task
**Milestone 12, Checkpoint 12.2 — Nursing, Medication Administration &
Discharge**, per `docs/roadmap.md` and the now-replaced `.ai/NEXT.md`.
Do not re-implement or re-verify anything from Checkpoint 12.1.

### Estimated project completion
**Overall: ~12 of 18 roadmap milestones/checkpoints fully complete
end-to-end** (Doctors/Scheduling, Appointments, Clinical/EMR,
Laboratory, Radiology, Pharmacy, Billing, Insurance, IPD Checkpoint
12.1 — plus foundational auth/RBAC/multi-tenancy scaffolding). **IPD
module: 100% for Checkpoint 12.1** (Checkpoint 12.2 — Nursing/MAR/
Discharge — still ahead). Everything else's percentage remains
provisional per `MODULE_STATUS.md`.

---

## Session: 2026-08-04 (Milestone 11 — Insurance Management, complete)

### What was completed
Ran in Auto Mode. The instruction gave the full Milestone 11 deliverable
list directly (Providers/Plans, Patient Coverage, Pre-Authorization,
Claims + Settlement, auto-attached Claim Documents, RBAC, 6 frontend
routes + 2 tabs, tests, docs) — materially larger than `NEXT.md`'s
prior framing, which had only scoped a claim workflow reusing
`InsuranceClaim`'s existing denormalized fields. Recorded as
**ADR-0016**. This session picked up mid-flight: the insurance module
already had `InsuranceProvider`/`InsurancePlan` scaffolding, the
schema migration, and the RBAC seed changes in place from an
interrupted prior pass (one file was left as a stray `.tmp.<pid>.
<hash>` write) — verified and completed rather than redone. Per the
reading policy, work touched Insurance, Billing (`InvoicesService`/
`PaymentsService` reuse), Patients, Encounters, Laboratory, Radiology,
Prescriptions, Prisma schema, and shared types.

- **Schema** (migration `20260802224429_insurance_management`, applied
  to both `medicore_dev`/`medicore_test`): `InsuranceProvider`,
  `InsurancePlan`, `PatientInsurance`, `PreAuthorization` +
  `PreAuthAttachment`, `ClaimDocument`; `InsuranceClaim` gained
  `encounterId` + structured FKs + settlement fields +
  `PARTIALLY_SETTLED`/`CLOSED` statuses. See ADR-0016 for the full
  model-design reasoning (denormalization, nullable FKs with
  `SetNull`, no `InsurancePolicy`-vs-`PatientInsurance` distinction).
- **RBAC**: `packages/database/prisma/seed.ts`'s flat `insurance`
  resource split into `insurance.providers`/`plans`/`claims`/`preauth`/
  `settlement` (the last `.manage`-gated, admin-only); `Cashier` gets
  read/create/update on providers/plans/claims/preauth plus
  `settlement.read` only — mirrors `billing.manage`'s approver
  separation.
- **Backend** (`apps/api/src/modules/insurance/`): `InsuranceProviders
  Service`/`Controller`, `InsurancePlansService`/`Controller`,
  `PatientInsuranceService`/`Controller` (nested under `insurance/
  patients/:patientId/coverages`), `PreAuthorizationService`/
  `Controller` (Draft→Submitted→Under Review→Approved/Partially
  Approved/Rejected/Cancelled, file attachments), `ClaimDocuments
  Service` (auto-attach via `InvoicesService.generatePdf`/
  `PrescriptionsService.generatePdf`/`LabTestsService.
  generateReportPdf`/`RadiologyOrdersService.generateReportPdf` + a new
  `generateEncounterSummaryPdf`; failures logged and skipped, not
  thrown), `InsuranceClaimsService`/`Controller` (full lifecycle +
  settlement, records a real `Payment` via `PaymentsService.create`),
  `InsuranceDashboardService`/`Controller`. `insurance.controller.ts`/
  `insurance.service.ts` (the old 3-line scaffold) repurposed into the
  dashboard endpoint rather than left as dead code.
- **Audit integration**: `audit.listener.ts` gained 12 new `@OnEvent`
  handlers for pre-auth/claim lifecycle events.
- **Tests**: 7 new unit spec files (46 tests) + `apps/api/test/
  insurance.e2e-spec.ts` (11 e2e tests — provider/plan CRUD, the
  one-active-coverage conflict, the full pre-auth workflow, claim
  creation with real auto-attached documents, the duplicate-invoice-
  claim conflict, the full claim workflow through a genuine settlement
  payment, an out-of-order-transition rejection, and the cashier-
  can't-settle RBAC split). All passing (359 unit / 210 e2e total
  across the whole API — zero failures).
- **Frontend**: `apps/web/src/lib/api/insurance.ts` + 6 new pages
  (`/dashboard/insurance` dashboard, `/providers`, `/plans`,
  `/preauth`, `/claims`, `/[claimId]`) + a real Patient Insurance tab
  (replacing the Milestone 10-era placeholder) + a new Encounter
  Insurance tab. Sidebar's "Insurance" link permission string updated
  from the retired flat `insurance.read` to `insurance.claims.read`.
- **Full verification, all green**: `pnpm --filter @medicore/database
  db:generate`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (359 api unit
  + 6 web), `pnpm test:e2e` (210/210), `pnpm build` (all 6 packages).
- **Browser-verified end to end**: port 3000 was occupied by an
  unrelated project's dev server (`onehaul-front-app`) this session —
  rather than killing another project's process without asking, the
  user was asked and chose to run MediCore's web app on port 3100
  instead (with `FRONTEND_URL` adjusted on the API side to match, since
  CORS is origin-locked). Logged in as `admin@medicore.demo`, created a
  provider + plan, added a patient's coverage, requested and approved a
  pre-authorization from that patient's encounter, filed a claim
  (confirmed real auto-attached Invoice + Encounter Summary PDFs), and
  walked it through Submit → Under Review → Approved → Settled →
  Closed, confirming a real ₹800 `Payment` (`paymentMode: INSURANCE`)
  landed against the invoice. 12 screenshots under `docs/screens/`
  (`insurance-*.png`). **One real bug found and fixed**: the "Add
  provider" dialog sent empty strings instead of `undefined` for
  unfilled optional fields, which broke `email`'s Zod `.email()`
  format validation on every provider-creation attempt that left email
  blank — fixed in `apps/web/src/app/dashboard/insurance/providers/
  page.tsx`.
- Updated `.ai/NEXT.md`: replaced entirely with **Milestone 12 — IPD &
  Bed Management**.

### Files modified/created
- Schema: `packages/database/prisma/schema.prisma`,
  `packages/database/prisma/migrations/20260802224429_insurance_management/`.
- RBAC: `packages/database/prisma/seed.ts`.
- Shared types: `packages/types/src/enums.ts` (7 new enums),
  `packages/types/src/insurance.ts` (new — full interface/zod-schema
  set), `packages/types/src/index.ts`.
- Backend: `apps/api/src/modules/insurance/*` (new: `insurance-
  providers.service.ts`(+spec)+`.controller.ts`, `insurance-plans.
  service.ts`(+spec)+`.controller.ts`, `patient-insurance.service.ts`
  (+spec)+`.controller.ts`, `pre-authorization.service.ts`(+spec)+
  `.controller.ts`, `claim-documents.service.ts`(+spec),
  `insurance-claims.service.ts`(+spec)+`.controller.ts`,
  `insurance-dashboard.service.ts`(+spec), `insurance-encounter-
  summary-pdf.ts`, `dto/*`; rewrote `insurance.module.ts`/
  `insurance.controller.ts`; deleted the old `insurance.service.ts`
  placeholder), `apps/api/src/modules/audit/audit.listener.ts`,
  `apps/api/test/insurance.e2e-spec.ts`.
- Frontend: `apps/web/src/lib/api/insurance.ts` (new), `apps/web/src/
  app/dashboard/insurance/page.tsx` (new), `.../providers/page.tsx`
  (new), `.../plans/page.tsx` (new), `.../preauth/page.tsx` (new),
  `.../claims/page.tsx` (new), `.../[claimId]/page.tsx` (new),
  `apps/web/src/app/dashboard/patients/[id]/page.tsx` (Insurance tab
  replaced), `apps/web/src/app/dashboard/medical-records/
  [encounterId]/page.tsx` (new Insurance tab), `apps/web/src/
  components/layout/sidebar.tsx` (permission string fix).
- Docs: `docs/roadmap.md` (Milestone 11 marked complete), `.ai/
  PROJECT_CONTEXT.md`, `.ai/PROGRESS.md`, `.ai/MODULE_STATUS.md`,
  `.ai/CHANGELOG.md`, `.ai/DECISIONS.md` (ADR-0016), `.ai/TECH_DEBT.md`
  (TD-0028, TD-0029), `.ai/NEXT.md` (replaced).
- Screenshots: `docs/screens/insurance-*.png` (12 new).

### Architectural decisions made
See **ADR-0016** in `DECISIONS.md` for the full reasoning — summary:
separate `InsuranceProvider`/`InsurancePlan`/`PatientInsurance` models
rather than extending `InsuranceClaim`'s denormalized fields; one
active coverage per type enforced in application code, not a DB
constraint; RBAC split into 5 namespaced sub-resources with
`settlement.manage` admin-gated; settlement posts a real `Payment` via
the existing `PaymentsService`, no parallel concept; claim documents
auto-attach by reusing every other module's existing PDF generator
(skip-and-log on failure) plus one new Encounter Summary generator;
Discharge Summary auto-attach explicitly deferred (IPD doesn't exist
yet); an encounter→invoice lookup gap (TD-0028) and a synthesized-vs-
real claim timeline gap (TD-0029) both tracked rather than
scope-creeped into Billing/Audit changes this session.

### Known issues
- TD-0028: no `encounterId` filter on `InvoicesController`'s list
  endpoint, so the Encounter Insurance tab's "File claim" dialog asks
  for the invoice ID as free text instead of a picker.
- TD-0029: the claim detail page's "Timeline" is synthesized from the
  claim's own lifecycle timestamp columns, not a real per-resource
  audit-trail feed (the audit rows exist; no endpoint filters them by
  `resourceId` for a single claim yet).
- Discharge Summary auto-attach is explicitly out of scope — no
  `Admission`/discharge model exists until Milestone 12 (IPD).

### Recommended next task
**Milestone 12 — IPD & Bed Management**, per `docs/roadmap.md` and the
now-replaced `.ai/NEXT.md`. Do not re-implement or re-verify anything
from Milestone 11.

### Estimated project completion
**Overall: ~11 of 17 roadmap milestones fully complete end-to-end**
(Doctors/Scheduling, Appointments, Clinical/EMR, Laboratory, Radiology,
Pharmacy, Billing, Insurance — plus foundational auth/RBAC/multi-tenancy
scaffolding). **Insurance module: 100% for Milestone 11.** Everything
else's percentage remains provisional per `MODULE_STATUS.md`.

---

## Session: 2026-08-03 (Milestone 10 — Billing, complete)

### What was completed
Ran in Auto Mode. Explicit instruction narrowed Milestone 10 to Billing
only ("Insurance is NOT part of this milestone"), giving the full
deliverable list (Charge Engine, Invoice, Payments, Discounts, Taxes,
Receipts, Refunds, APIs, frontend, dashboard). Recorded as **ADR-0015** —
`docs/roadmap.md`'s Milestone 10 is now "Billing" alone; a new Milestone
11 ("Insurance Management") carries the TPA/cashless-claim deliverables
that used to sit under the old "Billing & Insurance" bundle, and every
later milestone shifted by one (12–16 → 13–17). Per the reading policy,
work touched Billing, Appointments (auto-invoice trigger), Patients, the
Prisma schema, and shared types.

- Confirmed `billing`/`insurance` modules were still 3-line no-op
  scaffolds, and `Invoice`/`InvoiceItem`/`Payment`/`InsuranceClaim` (from
  the original scaffolding commit) were completely unused.
- **Schema** (migration `20260802202302_billing_management`, applied to
  both `medicore_dev`/`medicore_test`): new `ServiceCatalogItem`,
  `Charge` (the reusable Charge Engine entity), `Refund` models;
  `Invoice` gained `encounterId` + a full discount-approval-workflow
  field set + `finalizedAt`/`cancelledAt`/`cancelReason`. New enums:
  `ChargeSourceModule`, `ChargeStatus`, `DiscountType`,
  `DiscountApprovalStatus`, `RefundStatus`. Recorded **ADR-0015**.
- **RBAC**: no `seed.ts` changes needed — `billing.manage` was already
  seeded and already excluded from `Cashier` (only `Hospital Admin`'s
  wildcard includes it), so the discount/refund approval workflow's
  "separate requester from approver" need was already satisfied.
- **Backend** (`apps/api/src/modules/billing/`, rebuilt from scratch):
  `ServiceCatalogService`/`Controller`, `ChargesService`/`Controller`,
  `InvoicesService`/`Controller` (create/add-item/discount workflow/
  finalize/cancel/PDF), `PaymentsService`/`Controller` (record payment +
  receipt PDF — repeat calls cover split/partial payment),
  `RefundsService`/`Controller` (request/approve/reject),
  `BillingDashboardService`, `AppointmentInvoiceListener` (auto-invoice
  from a completed appointment, priced from `Doctor.consultationFee` +
  org GST rate, idempotent via `Invoice.appointmentId`'s unique
  constraint). Pure math in `billing-calculations.ts`.
- **Audit integration**: `audit.listener.ts` gained 12 new `@OnEvent`
  handlers for charge/invoice/payment/refund lifecycle events.
- **Tests**: 46 new unit tests (8 spec files) + 29 new e2e tests
  (`apps/api/test/billing.e2e-spec.ts`). All passing (359 unit / 199 e2e
  total across the whole API, zero failures).
- **Frontend**: `apps/web/src/lib/api/billing.ts` + 4 new pages
  (`/dashboard/billing` dashboard, `/invoices` list+create,
  `/invoices/[invoiceId]` detail, `/payments`, `/refunds`) — the
  sidebar's pre-existing "Billing" link needed no changes.
- **Full verification, all green**: `pnpm --filter @medicore/database
  db:generate`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (313 api unit
  + 6 web), `pnpm test:e2e` (199/199), `pnpm build` (all 6 packages).
- **Browser-verified end to end**: killed stale dev processes on ports
  3000/4000 and restarted fresh both before and after the verification
  build (TD-0004). Logged in as `admin@medicore.demo`, drove the full
  golden path for a real patient: created an invoice (₹800 + 18% GST =
  ₹944), applied a 10% discount (auto-approved, ₹864), finalized it,
  recorded two ₹400 cash payments (→ Paid), requested and completed a
  ₹200 refund (→ Refunded, balance due ₹64), and confirmed the
  Payments/Refunds/Invoices lists and dashboard all reflect it. 17
  screenshots under `docs/screens/`. **Two real bugs found and fixed**:
  the New-invoice dialog never navigated to the created invoice (missing
  `router.push`), and the dashboard's 7-day collection-trend bars never
  rendered any height (a CSS percentage-height-without-a-definite-parent
  bug — fixed by giving each day column an explicit `h-32`).
- Updated `.ai/NEXT.md`: replaced entirely with **Milestone 11 —
  Insurance Management**.

### Files modified/created
- Schema: `packages/database/prisma/schema.prisma`,
  `packages/database/prisma/migrations/20260802202302_billing_management/`.
- Shared types: `packages/types/src/enums.ts` (5 new enums, plus
  previously-missing `InvoiceType`/`PaymentStatus`),
  `packages/types/src/billing.ts` (rewritten — full interface/zod-schema
  set for catalog/charges/invoices/payments/refunds/dashboard).
- Backend: `apps/api/src/modules/billing/*` (new: `billing-calculations
  .ts`(+spec), `billing-invoice-pdf.ts`, `billing-receipt-pdf.ts`,
  `service-catalog.service.ts`(+spec)+`.controller.ts`,
  `charges.service.ts`(+spec)+`.controller.ts`, `invoices.service.ts`
  (+spec)+`.controller.ts`, `payments.service.ts`(+spec)+`.controller
  .ts`, `refunds.service.ts`(+spec)+`.controller.ts`,
  `billing-dashboard.service.ts`(+spec),
  `appointment-invoice.listener.ts`(+spec), `dto/*`; rewrote
  `billing.module.ts`/`billing.controller.ts`; deleted the old
  `billing.service.ts` placeholder),
  `apps/api/src/modules/audit/audit.listener.ts`,
  `apps/api/test/billing.e2e-spec.ts`.
- Frontend: `apps/web/src/lib/api/billing.ts` (new),
  `apps/web/src/app/dashboard/billing/page.tsx` (new),
  `apps/web/src/app/dashboard/billing/invoices/page.tsx` (new),
  `apps/web/src/app/dashboard/billing/invoices/[invoiceId]/page.tsx`
  (new), `apps/web/src/app/dashboard/billing/payments/page.tsx` (new),
  `apps/web/src/app/dashboard/billing/refunds/page.tsx` (new).
- Docs: `docs/roadmap.md` (Milestone 10 split, 11–16 renumbered to
  12–17), `docs/screens/billing-*.png` (17 new), all `.ai/*` files.

### Architectural decisions
See **ADR-0015** in `DECISIONS.md` for the full reasoning — Charge Engine
design, invoice discount/refund approval workflow, `Invoice.encounterId`,
split/partial payments needing no schema change, the QR-placeholder
decision, and the Milestone 10/11 roadmap split.

### Known issues
- TD-0024: no standalone Service Catalog/Charges admin UI (only the
  invoice-creation flow's sweep-and-ad-hoc surface).
- TD-0025: no DB-level protection against concurrent-write races on
  Invoice/Payment/Refund totals (same accepted-for-now class as
  TD-0012/TD-0021).
- TD-0026: `InvoiceStatus.OVERDUE` is never automatically set (no cron
  infra in this repo).
- TD-0027 (tracking only): invoice/receipt QR is a disclosed placeholder,
  not a real payment gateway — credential-blocked, not faked.

### Recommended next task
**Milestone 11 — Insurance Management** (see `.ai/NEXT.md`): insurance
policy management, TPA/cashless claim workflow, claim status tracking,
frontend claim management — building on the pre-existing
`InsuranceClaim` model and `Invoice.insuranceClaim` relation (both
unused since the original scaffolding commit, confirmed again this
session).

### Estimated completion
Overall: ~63% (10 of 17 roadmap milestones fully complete: Foundation
through Billing, minus the still-provisional cross-cutting items tracked
in TD-0001). Billing module: 100% for Milestone 10's scope (Insurance
explicitly excluded, tracked as its own milestone).

---

## Session: 2026-08-03 (Milestone 9 — Pharmacy Management, complete)

### What was completed
Ran in Auto Mode. Explicit instruction reordered the roadmap ahead of
`.ai/NEXT.md`'s plan: build Pharmacy Management now (not Billing &
Insurance), labeled "Milestone 9," with Billing/Insurance and general
(non-drug) inventory explicitly out of scope. Recorded as **ADR-0014** —
a reorder-and-split of `docs/roadmap.md` (see Architectural decisions
below) rather than silently overriding `NEXT.md`. Per the reading policy,
work touched Pharmacy, Prescriptions, Encounters, Patients, the Prisma
schema, and shared pharmacy types.

- Confirmed `apps/api/src/modules/pharmacy/` was still the 3-line no-op
  scaffold, and that `Medication`/`InventoryItem` (from the original
  scaffolding commit) were completely unused.
- **Schema** (migration `20260802183901_pharmacy_management`, applied to
  both `medicore_dev`/`medicore_test`): `Medication` renamed/extended
  into `Drug` (one row = one batch — batch number/expiry are catalog
  fields, not a separate table); new `DispenseStatus` enum; new
  `DispenseOrder` (one per prescription), `DispenseItem` (mirrors a
  `PrescriptionItem` 1:1), `DrugReturn` models. Recorded **ADR-0014**.
- **RBAC**: `pharmacy.*` stays all-scope for every role (staff-facing,
  like billing/insurance — no doctor own-scope). Pharmacist role gained
  `prescriptions.update` so completing a dispense can complete the source
  prescription. Re-ran `pnpm db:seed`; `syncRolePermissions` synced it
  with zero manual intervention.
- **Backend** (`apps/api/src/modules/pharmacy/`, rebuilt from scratch):
  `DrugCatalogService`/`Controller` (CRUD, stock adjustment, low-stock/
  expiring filters) and `DispenseService`/`Controller` — create from a
  prescription, batch selection (reserves stock), mark ready, partial/
  complete dispense (converts reserved → deducted, completes the
  prescription), reject/cancel (releases reservations), medicine returns
  (restocks, moves to `RETURNED`), dashboard stats.
- **Audit integration**: `audit.listener.ts` gained 4 new `@OnEvent`
  handlers (`dispense_order.created`/`status_changed`/
  `partially_dispensed`, `drug_return.created`).
- **Tests**: 25 new unit tests + 20 new e2e tests
  (`apps/api/test/pharmacy.e2e-spec.ts`). All passing (267 unit / 170
  e2e total, zero failures — no pre-existing flakes hit this run).
- **Frontend**: `apps/web/src/lib/api/pharmacy.ts` + 5 new pages
  (`/dashboard/pharmacy` dashboard, `/catalog`, `/dispense` queue,
  `/stock`, `/[dispenseId]` detail) + a "Dispense" button on the
  encounter detail page's Prescriptions tab.
- **Full verification, all green**: `pnpm --filter @medicore/database
  db:generate`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (267 api unit +
  6 web), `pnpm test:e2e` (170/170), `pnpm build` (all 6 packages).
- **Browser-verified end to end**: killed stale dev processes and
  restarted fresh (TD-0004). Logged in as `admin@medicore.demo`, created
  fixture patient/encounter/prescriptions via the API, then drove every
  Pharmacy page through the browser: added drug batches (including a
  low-stock/near-expiry one), created a dispense order, selected batches,
  marked ready, partially dispensed, completed the dispense (confirmed
  the source prescription flipped to "Completed"), recorded a return
  (order moved to "Returned"), and rejected a second order with a reason.
  19 screenshots under `docs/screens/`. Fixed one real bug found during
  this pass: "Dispensed today" excluded orders that had since moved to
  `RETURNED` — now counts by `dispensedAt` regardless of current status.
- Updated `.ai/NEXT.md`: replaced entirely with **Milestone 10 — Billing
  & Insurance**.

### Files modified/created
- Schema: `packages/database/prisma/schema.prisma`,
  `packages/database/prisma/migrations/20260802183901_pharmacy_management/`,
  `packages/database/prisma/seed.ts` (Pharmacist `prescriptions.update`).
- Shared types: `packages/types/src/enums.ts` (`DispenseStatus`),
  `packages/types/src/pharmacy.ts` (new).
- Backend: `apps/api/src/modules/pharmacy/*` (new:
  `drug-catalog.service.ts` + `.controller.ts` + `.spec.ts`,
  `dispense.service.ts` + `.controller.ts` + `.spec.ts`, `dto/*`;
  rewrote `pharmacy.module.ts`; deleted the old `pharmacy.controller.ts`/
  `.service.ts` placeholders), `apps/api/src/modules/audit/audit.listener.ts`,
  `apps/api/test/pharmacy.e2e-spec.ts`.
- Frontend: `apps/web/src/lib/api/pharmacy.ts` (new),
  `apps/web/src/app/dashboard/pharmacy/page.tsx` (new),
  `apps/web/src/app/dashboard/pharmacy/catalog/page.tsx` (new),
  `apps/web/src/app/dashboard/pharmacy/dispense/page.tsx` (new),
  `apps/web/src/app/dashboard/pharmacy/stock/page.tsx` (new),
  `apps/web/src/app/dashboard/pharmacy/[dispenseId]/page.tsx` (new),
  `apps/web/src/app/dashboard/medical-records/[encounterId]/page.tsx`
  (Dispense button on the Prescriptions tab).
- Docs: `.ai/DECISIONS.md` (ADR-0014), `.ai/TECH_DEBT.md` (TD-0021,
  TD-0022, TD-0023), `.ai/PROGRESS.md`, `.ai/CHANGELOG.md`,
  `.ai/MODULE_STATUS.md`, `.ai/PROJECT_CONTEXT.md`, `docs/roadmap.md`
  (reordered/renumbered), `.ai/NEXT.md` (replaced), 19 new
  `docs/screens/pharmacy-*.png`.

### Architectural decisions made
See **ADR-0014** in `DECISIONS.md`: Milestone 9 reordered to Pharmacy
Management ahead of Billing & Insurance (roadmap split into Pharmacy/
Billing & Insurance/General Inventory, former 11–15 shift to 12–16),
`Drug`/`DispenseOrder`/`DispenseItem`/`DrugReturn` schema shape
(batch-per-catalog-row design), the `DispenseStatus` state-machine
semantics (partial vs. complete dispense, reject vs. cancel, returned),
application-level stock reservation, and all-scope `pharmacy.*` RBAC.

### Known issues
- **TD-0021** (Medium): drug stock reservation/deduction has no DB-level
  concurrency protection — same class of gap as TD-0012 (appointment
  booking), not new. Low probability, worth fixing before multi-
  pharmacist concurrent production use.
- **TD-0022** (Low): `lowStockOnly` catalog filter runs in application
  code (paginates in JS) rather than as a DB-level query, since it
  compares two columns on the same row.
- **TD-0023** (tracking only): completing a dispense best-effort-
  completes the source prescription via a swallowed cross-module call —
  same pattern already used elsewhere in this codebase, not a new gap.
- No new bugs discovered this session beyond the "Dispensed today" stat
  bug caught and fixed during browser verification (see above).

### Recommended next task
**Milestone 10 — Billing & Insurance**, per `.ai/NEXT.md` — a larger
milestone bundling two sub-domains (service catalog/invoicing/payments/
GST and insurance claims/TPA workflow); check whether a checkpoint split
is warranted once the actual shape of the work is clearer, per the
precedent in ADR-0005/0006/0009/0011 (but don't split preemptively —
Laboratory, Radiology, and now Pharmacy were each completed in one
session despite looking similarly sized on paper).

### Estimated completion
- **Overall project**: ~60% (9 of 16 roadmap milestones fully complete:
  Doctors, Scheduling, Appointments, Medical Records/EMR, Prescriptions,
  Laboratory, Radiology, and now Pharmacy — all backend+frontend+tests+
  docs; everything else still provisional/unaudited). Roadmap grew from
  15 to 16 milestones this session (General Inventory split out as its
  own Milestone 11 — see ADR-0014).
- **Pharmacy module**: 100% for Milestone 9's scope (general inventory
  and pharmacy↔billing integration are explicitly out of scope, deferred
  to Milestones 11 and 10 respectively).

---

## Session: 2026-08-02 (Milestone 8 — Radiology Management, complete)

### What was completed
Ran in Auto Mode with an explicit, detailed instruction for Milestone 8
that asked for a full Radiology Information System — materially more
than `.ai/NEXT.md`'s narrower framing (no catalog, no versioned reports).
Per `CLAUDE.md`'s guidance on new information contradicting a settled
decision, this was recorded as a scope-expansion ADR (ADR-0013) rather
than silently overridden or re-asked about. Per the reading policy, work
touched Radiology, Encounter (consultation-order link), Patients,
Doctors, and shared types; Pharmacy/Billing/Insurance/AI were not
touched.

- Confirmed `apps/api/src/modules/radiology/` was still the 3-line no-op
  scaffold, and that `RadiologyOrder`/`RadiologyStatus`/`Priority`
  already existed in `schema.prisma` from the original scaffolding
  commit with no `encounterId` and no catalog concept — matching what
  `NEXT.md` flagged.
- **Schema** (migration `20260801202731_radiology_management`, applied
  to both `medicore_dev`/`medicore_test`): new `RadiologyCatalogItem`
  model; `RadiologyOrder` gained `encounterId`, `catalogItemId`, full
  scheduling fields, and report fields (`technique`/`recommendations`/
  `verifiedByUserId`/`verifiedAt`/`releasedByUserId`/`releasedAt`);
  `RadiologyStatus` gained `REJECTED`; new append-only `RadiologyReport`
  model (mirrors `ClinicalNote`); new `RadiologyAttachment` model +
  `RadiologyAttachmentType` enum (`IMAGE`/`PDF`/`EXTERNAL_IMAGING`/
  `DICOM_PLACEHOLDER`). Recorded **ADR-0013**.
- **Own-scope decision**: `radiology.read`/`create`/`update` changed
  from all-scope to own-scope for the Doctor role, mirroring ADR-0012.
  Added a new **Radiology Technician** role to `seed.ts`'s `ROLE_SPECS`
  (`SystemRole.RADIOLOGY_TECHNICIAN` already existed unused in the
  schema enum). Nurse gained `radiology.read`. Re-ran `pnpm db:seed`;
  `syncRolePermissions` synced everything with zero manual intervention.
- **Backend** (`apps/api/src/modules/radiology/`, rebuilt from scratch):
  `RadiologyCatalogService`/`Controller` and `RadiologyOrdersService`/
  `Controller` — order CRUD, scheduling (dedicated action, supports
  reschedule), start/complete study, versioned report authoring
  (`COMPLETED`-only) with a sequential verify → release workflow
  (release requires verification), external report-file upload, a
  structured `pdfkit` PDF, file/external attachment actions, dashboard
  stats, a fixed `ALLOWED_TRANSITIONS` state machine, and
  `assertOwnScopeOk` (same idiom as `LabTestsService`).
- **Audit integration**: `audit.listener.ts` gained 3 new `@OnEvent`
  handlers (`radiology_order.ordered`/`status_changed`/`report_drafted`);
  `AuditService.listForDoctor`'s resource list grew to include
  `RadiologyOrder`.
- **Tests**: 34 new unit tests (`radiology-catalog.service.spec.ts`,
  `radiology-orders.service.spec.ts`) + 29 new e2e tests
  (`apps/api/test/radiology.e2e-spec.ts` — full lifecycle, catalog CRUD,
  external report-file path, rejection/cancellation, dashboard stats,
  own-scope enforcement). All passing (242 unit / 150 e2e total — the
  one other failure, `appointments.e2e-spec.ts`'s walk-in test, is the
  pre-existing unrelated TD-0017 midnight flake, confirmed by re-running
  it in isolation outside the ~23:30–23:59 window).
- **Frontend**: `apps/web/src/lib/api/radiology.ts` + 4 new pages
  (`/dashboard/radiology` dashboard, `/dashboard/radiology/orders`
  queue, `/dashboard/radiology/catalog`, `/dashboard/radiology/[orderId]`
  detail with Scheduling/Report/Attachments tabs) + a Radiology tab on
  the encounter detail page + a "Recent imaging" panel on the patient
  timeline.
- **AI image interpretation and real PACS/DICOM integration: explicitly
  out of scope** (**TD-0019**, by instruction, not credential-blocked).
- **Full verification, all green**: `pnpm --filter @medicore/database
  db:generate`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (242 api unit +
  6 web), `pnpm test:e2e` (149/150, 1 pre-existing unrelated flake),
  `pnpm build` (all 6 packages, `turbo run build --force`).
- **Browser-verified end to end**: two stale `pnpm dev` processes from
  before this session were killed and restarted first (TD-0004).
  `chromium-cli` still not available (TD-0010); installed
  `playwright@1.62.1` ad hoc into the session scratch dir. Logged in as
  `admin@medicore.demo`, added an "X-Ray Chest" catalog item, created a
  real radiology order from a real patient's encounter, scheduled it,
  started and completed the study, authored a full report, verified and
  released it (genuinely reached "Reported" status), downloaded a real
  PDF (`file` confirmed "PDF document, version 1.3, 1 pages"), uploaded
  a real image attachment and a metadata-only external/DICOM-placeholder
  attachment, and confirmed both the org-wide queue and the patient-
  timeline "Recent imaging" panel render correctly. 19 screenshots saved
  under `docs/screens/`.
- Updated `.ai/NEXT.md`: replaced entirely with **Milestone 9 — Billing
  & Insurance**.

### Files modified/created
- Schema: `packages/database/prisma/schema.prisma`,
  `packages/database/prisma/migrations/20260801202731_radiology_management/`,
  `packages/database/prisma/seed.ts` (own-scope grants, new Radiology
  Technician role).
- Shared types: `packages/types/src/enums.ts` (`RadiologyStatus`,
  `RadiologyAttachmentType`), `packages/types/src/radiology.ts` (new).
- Backend: `apps/api/src/modules/radiology/*` (new:
  `radiology-orders.service.ts` + `.controller.ts` + `.spec.ts`,
  `radiology-catalog.service.ts` + `.controller.ts` + `.spec.ts`,
  `radiology-report-pdf.ts`, `dto/*`; rewrote `radiology.module.ts`;
  deleted the old `radiology.controller.ts`/`.service.ts` placeholders),
  `apps/api/src/modules/audit/audit.listener.ts` +
  `audit.service.ts`/`.spec.ts`, `apps/api/test/radiology.e2e-spec.ts`.
- Frontend: `apps/web/src/lib/api/radiology.ts` (new),
  `apps/web/src/app/dashboard/radiology/page.tsx` (new),
  `apps/web/src/app/dashboard/radiology/orders/page.tsx` (new),
  `apps/web/src/app/dashboard/radiology/catalog/page.tsx` (new),
  `apps/web/src/app/dashboard/radiology/[orderId]/page.tsx` (new),
  `apps/web/src/app/dashboard/medical-records/[encounterId]/page.tsx`
  (Radiology tab), `apps/web/src/app/dashboard/medical-records/page.tsx`
  (Recent imaging panel).
- Docs: `.ai/DECISIONS.md` (ADR-0013), `.ai/TECH_DEBT.md` (TD-0019,
  TD-0020), `.ai/PROGRESS.md`, `.ai/CHANGELOG.md`, `.ai/MODULE_STATUS.md`,
  `.ai/PROJECT_CONTEXT.md`, `.ai/NEXT.md` (replaced), 19 new
  `docs/screens/radiology-*.png` + `medical-records-recent-imaging.png`.

### Architectural decisions made
See **ADR-0013** in `DECISIONS.md`: expanded Milestone 8 scope per
explicit instruction (full RIS, not the minimal version), catalog shape,
`RadiologyOrder` scheduling/report field additions, versioned-report +
verify/release design, attachment model shape (incl. DICOM-placeholder
extension point), and own-scope `radiology.*` for Doctor + a newly
activated Radiology Technician role.

### Known issues
- **TD-0019** (tracking only): AI image interpretation and real
  PACS/DICOM integration are explicitly out of scope by instruction —
  not a defect.
- **TD-0020** (Low): no technician-picker UI (raw user ID field only) —
  no staff-directory endpoint exists yet for any module to build one on.
- No new bugs discovered this session. TD-0017 (appointment walk-in
  midnight flake) remains open and unrelated to this module.

### Recommended next task
**Milestone 9 — Billing & Insurance**, per `.ai/NEXT.md` — a larger
milestone bundling two sub-domains (service catalog/invoicing/payments/
GST and insurance claims/TPA workflow); check whether a checkpoint split
is warranted once the actual shape of the work is clearer, per the
precedent in ADR-0005/0006/0009/0011 (but don't split preemptively —
Laboratory and Radiology were each completed in one session despite
looking similarly sized on paper).

### Estimated completion
- **Overall project**: ~53% (8 of 15 roadmap milestones fully complete:
  Doctors, Scheduling, Appointments, Medical Records/EMR, Prescriptions,
  Laboratory, and now Radiology — all backend+frontend+tests+docs;
  everything else still provisional/unaudited).
- **Radiology module**: 100% for Milestone 8's scope (AI interpretation/
  PACS explicitly and only excluded by instruction, tracked in TD-0019).
- **Billing/Insurance modules**: 0% — not started, next up.

---

## Session: 2026-08-02 (Milestone 7 — Laboratory Management, complete)

### What was completed
Picked up `.ai/NEXT.md` exactly as left by the prior session (explicit
user go-ahead to resume). Completed **all** of Milestone 7 (Laboratory
Management) in one session — no checkpoint split was needed. Per the
reading policy, scope stayed to Laboratory, Encounter (consultation-order
link), Patients, and shared types; Radiology (`apps/api/src/modules/radiology/`,
any `Radiology*` Prisma model, radiology frontend) was not touched, per
the explicit exclusion in `NEXT.md`/ADR-0011.

- Audited `apps/api/src/modules/laboratory/` first — confirmed it was
  still the 3-line no-op scaffold (same pattern hit before every prior
  milestone's module), and that `LabTest`/`LabTestItem` already existed
  in `schema.prisma` from the original scaffolding commit but had no
  `encounterId` and no catalog concept, matching what `NEXT.md` flagged
  as needing verification.
- **Schema** (migration `20260801191909_lab_management`, applied to both
  `medicore_dev`/`medicore_test`): added `LabTest.encounterId` +
  `Encounter.labTests` back-relation; added new `LabTestCatalogItem`
  model (numeric range + text range + optional critical bounds,
  org-scoped); added denormalized `catalogItemId`/`referenceRangeLow/High`/
  `criticalLow/High` to `LabTestItem`. Recorded **ADR-0012** for these
  three decisions plus the own-scope call (see below).
- **Own-scope decision**: `laboratory.read`/`create`/`update` changed
  from all-scope to own-scope for the Doctor role in `seed.ts`
  (`OWN_SCOPE_PERMISSIONS` + `ROLE_SPECS`), mirroring `prescriptions.*`
  exactly. Lab Technician/Nurse deliberately left all-scope (unchanged)
  — they need to see every order in the queue, not just ones a specific
  doctor placed. Re-ran `pnpm db:seed` against `medicore_dev`; `
  syncRolePermissions` (TD-0011's fix) topped up the role correctly with
  zero manual intervention, same as every session since it landed.
- **Backend** (`apps/api/src/modules/laboratory/`, rebuilt from scratch):
  `LabTestsService`/`Controller` (order CRUD, sample collection, result
  entry with server-computed abnormal flagging, external report upload,
  structured PDF generation, a `CANCELLED`-only generic status route,
  own-scope enforcement) and `LabCatalogService`/`Controller` (catalog
  CRUD, no own-scope check). `abnormal-flagging.ts` is a pure function
  with the exact flagging rule disclosed in a code comment (numeric-only;
  explicit-or-derived-20%-multiplier critical bounds). `lab-report-pdf.ts`
  mirrors `prescription-pdf.ts`'s `pdfkit` approach.
- **Audit integration**: `audit.listener.ts` gained 3 new `@OnEvent`
  handlers (`lab_test.ordered`/`status_changed`/`results_entered`);
  `AuditService.listForDoctor`'s resource list grew to include `LabTest`
  (`audit.service.spec.ts` updated to match).
- **Tests**: 33 new unit tests (`abnormal-flagging.spec.ts`,
  `lab-catalog.service.spec.ts`, `lab-tests.service.spec.ts`) + 19 new
  e2e tests (`apps/api/test/laboratory.e2e-spec.ts`) — full order
  lifecycle, catalog CRUD, own-scope enforcement, abnormal-value cases
  (normal/HIGH/LOW/CRITICAL_HIGH/CRITICAL_LOW/non-numeric), invalid
  status transitions. All passing (208 unit / 121 e2e total, no flakes).
- **Frontend**: `apps/web/src/lib/api/laboratory.ts` + a Lab Orders tab
  on the encounter detail page + a "Recent lab orders" panel on the
  patient timeline + a new `/dashboard/laboratory` org-wide queue page
  with a catalog-management dialog.
- **AI-powered lab report summarization: explicitly deferred**
  (**TD-0018**, credential-blocked) — verified no code anywhere reads
  `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`/`AI_PROVIDER` despite those names
  existing as unset placeholders in `.env.example`; `apps/api/src/modules/ai/`
  is still a 3-file no-op scaffold. Not faked, per `CLAUDE.md`.
- **Full verification, all green**: `pnpm --filter @medicore/database
  db:generate`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (208 api unit +
  6 web), `pnpm test:e2e` (121/121 across 9 suites), `pnpm build` (all 6
  packages, `turbo run build --force`).
- **Browser-verified end to end**: two stale `pnpm dev` processes were
  running from before this session's build (TD-0004 addendum) — killed
  the port-4000/3000 listeners and restarted `pnpm dev` fresh before
  driving the browser check. `chromium-cli` is not available in this
  environment (checked, per TD-0010); installed `playwright@1.62.1` ad
  hoc into the session scratch dir (reusing the already-cached Chromium
  binary from a prior session) and drove it with a small Node script
  instead. Logged in as `admin@medicore.demo`, added a catalog item,
  created a real lab order from an existing patient's encounter,
  collected the sample, entered an abnormal result (250 mg/dL against a
  70–110 range) and confirmed a "Critical high" badge rendered correctly,
  downloaded a genuine PDF report. 9 screenshots under `docs/screens/`
  (`lab-*.png`).
- Updated `.ai/NEXT.md`: replaced entirely with **Milestone 8 —
  Radiology Management**.

### Files modified/created
- Schema: `packages/database/prisma/schema.prisma`,
  `packages/database/prisma/migrations/20260801191909_lab_management/`,
  `packages/database/prisma/seed.ts` (own-scope grants).
- Shared types: `packages/types/src/enums.ts` (`AbnormalType`),
  `packages/types/src/laboratory.ts` (full rewrite: catalog + order DTOs).
- Backend: `apps/api/src/modules/laboratory/*` (new: `lab-tests.service.ts`
  + `.controller.ts` + `.spec.ts`, `lab-catalog.service.ts` + `.controller.ts`
  + `.spec.ts`, `abnormal-flagging.ts` + `.spec.ts`, `lab-report-pdf.ts`,
  `dto/*`; rewrote `laboratory.module.ts`; deleted the old
  `laboratory.controller.ts`/`.service.ts` placeholders),
  `apps/api/src/modules/audit/audit.listener.ts` +
  `audit.service.ts`/`.spec.ts`, `apps/api/test/laboratory.e2e-spec.ts`.
- Frontend: `apps/web/src/lib/api/laboratory.ts` (new),
  `apps/web/src/app/dashboard/laboratory/page.tsx` (new),
  `apps/web/src/app/dashboard/medical-records/[encounterId]/page.tsx`
  (Lab Orders tab), `apps/web/src/app/dashboard/medical-records/page.tsx`
  (Recent lab orders panel).
- Docs: `.ai/DECISIONS.md` (ADR-0012), `.ai/TECH_DEBT.md` (TD-0018),
  `.ai/PROGRESS.md`, `.ai/CHANGELOG.md`, `.ai/MODULE_STATUS.md`,
  `.ai/PROJECT_CONTEXT.md`, `.ai/NEXT.md` (replaced), 9 new
  `docs/screens/lab-*.png`.

### Architectural decisions made
See **ADR-0012** in `DECISIONS.md`: `LabTest.encounterId` addition,
`LabTestCatalogItem`'s numeric+text hybrid shape with denormalization
onto `LabTestItem` at order time, and own-scope `laboratory.*` for the
Doctor role (Lab Technician/Nurse stay all-scope).

### Known issues
- **TD-0018** (tracking only): AI-powered lab report summarization is
  genuinely credential-blocked, not implemented. Pick up once the user
  supplies LLM provider credentials.
- No new bugs discovered this session. TD-0017 (appointment walk-in
  midnight flake) remains open and unrelated to this module.

### Recommended next task
**Milestone 8 — Radiology Management**, per `.ai/NEXT.md` (radiology
order creation from consultation, report upload/viewing, frontend order
queue) — a smaller milestone than Laboratory, likely completable in one
session by reusing the Laboratory module's exact patterns
(`RadiologyOrder` already exists in `schema.prisma` from the original
scaffolding commit, alongside `RadiologyStatus`/`Priority`).

### Estimated completion
- **Overall project**: ~46% (7 of 15 roadmap milestones fully complete:
  Doctors, Scheduling, Appointments, Medical Records/EMR, Prescriptions,
  and now Laboratory — all backend+frontend+tests+docs; everything else
  still provisional/unaudited).
- **Laboratory module**: 100% for Milestone 7's scope (AI summarization
  explicitly and only excluded, tracked in TD-0018).
- **Radiology module**: 0% — not started, explicitly out of scope this
  session.

---

## Session: 2026-08-01 (Post-Milestone-6 stop instruction: autonomous loop paused, Milestone 7 rescoped)

### What was completed
Immediately after Checkpoint 6.2 (below) was marked complete and the
autonomous loop had scheduled its next wakeup to auto-continue into
Milestone 7, the user explicitly instructed: **stop after Milestone 6,
do not automatically begin Milestone 7.** The scheduled loop wakeup was
cancelled (`ScheduleWakeup stop:true`) — no further milestones will be
started without explicit user instruction to resume.

The user also asked for `NEXT.md` to point to "Milestone 7 — Laboratory
Management" — since `docs/roadmap.md`'s existing Milestone 7 was titled
"Laboratory & Radiology" (bundling both sub-domains), this was flagged
back to the user rather than guessed at (title-only rename vs. an actual
scope split). The user chose to **narrow scope**: Laboratory and
Radiology are now separate milestones.

- Recorded **ADR-0011**: `docs/roadmap.md`'s Milestone 7 split into
  **Milestone 7 — Laboratory Management** (Week 8: lab catalog, orders
  from consultation, sample tracking, result entry + PDF, abnormal-value
  flagging, AI summarization, frontend order list/result form) and a new
  **Milestone 8 — Radiology Management** (Week 9: radiology order
  creation, report upload/viewing, frontend order queue). Milestones 8–14
  (Billing & Insurance through Production Hardening) renumbered to 9–15,
  Week labels bumped by one each — the same insert-and-renumber pattern
  ADR-0006 used when Appointment Management was inserted as Milestone 5.
- Rewrote `.ai/NEXT.md`: now describes **Milestone 7 — Laboratory
  Management only**, explicitly excludes Radiology deliverables/module/
  Prisma models from this task's scope, and carries a standing-override
  note that the autonomous loop is paused pending explicit user
  instruction to resume.
- Updated `.ai/PROJECT_CONTEXT.md`'s Milestone 6 section to reference the
  new Milestone 7/8 split and the paused loop, instead of the old
  "Laboratory & Radiology" single-milestone reference.
- **No application code changed in this step** — this was purely a
  roadmap/documentation reconciliation plus stopping the autonomous loop.

### Files modified/created
- Modified: `docs/roadmap.md` (Milestone 7 split into 7/8, 8–14 renumbered
  to 9–15), `.ai/DECISIONS.md` (ADR-0011), `.ai/NEXT.md` (rewritten for
  Laboratory-only scope + stop notice), `.ai/PROJECT_CONTEXT.md` (Milestone
  6 section's "next" pointer updated), `.ai/SESSION_LOG.md` (this entry).

### Known issues
None new. See the Checkpoint 6.2 entry below for TD-0016/TD-0017.

### Recommended next task
**Do not start automatically.** When the user gives explicit go-ahead,
pick up **Milestone 7 — Laboratory Management** per `.ai/NEXT.md`.

### Estimated completion
Unchanged from the Checkpoint 6.2 entry below — Milestone 6 fully
complete; Milestone 7 (now Laboratory-only) and Milestone 8 (new,
Radiology) both at 0%, not started.

---

## Session: 2026-08-01 (Milestone 6, Checkpoint 6.2 — Orders & Prescriptions, completed; Milestone 6 fully complete; autonomous loop iteration)

### What was completed
This is the `/loop`'s next automatic iteration (dynamic self-pacing, woken
by the standing autonomous-continuation instruction), continuing directly
from the Checkpoint 6.1 session below with no user interaction in between.
Per `CLAUDE.md`'s reading policy, only the Prescription model (+its FK to
Encounter), Patient, and shared types were inspected — no Laboratory/
Pharmacy/Billing/Radiology/AI modules were touched.

- Recorded **ADR-0010**: reuse the pre-existing `Prescription`/
  `PrescriptionItem` Prisma models from the original scaffolding commit
  (confirmed zero rows before changing anything) rather than redesigning
  — their shape already matched the requirement. `Prescription.status`
  converted from a plain `String @default("ACTIVE")` to a proper
  `PrescriptionStatus` enum (migration
  `20260801175600_prescription_status_enum`), matching the
  `EncounterStatus`/`AppointmentStatus` convention.
- **Self-caught bug** (found while designing own-scope enforcement, before
  writing any tests): `seed.ts`'s `Doctor` role was never granted
  `medical_records.update` or `prescriptions.update` at `own` scope — a
  real `doctor@medicore.demo` login could not transition their own
  encounter's or prescription's status, despite the Checkpoint 6.1 API
  correctly supporting it. e2e tests didn't catch this because they grant
  permissions directly rather than through `seed.ts`. Fixed in `seed.ts`
  and verified the fix synced correctly via a real `pnpm db:seed` run.
- **Backend** (`apps/api/src/modules/prescriptions/`, rebuilt from a
  3-line no-op scaffold): `PrescriptionsService`/`Controller` — create
  (derives patient/doctor from the encounter, generates
  `RX-<orgPrefix>-<year>-NNNNNN` via the same advisory-lock pattern as
  `Appointment.appointmentNumber`), paginated/filterable list, get-by-id,
  status transitions (`ACTIVE` → `COMPLETED`/`DISCONTINUED`, both
  terminal), PDF generation (new `pdfkit` dependency, streamed via
  `@Res()`/`FastifyReply`), and `assertOwnScopeOk` (same idiom as
  `EncountersService`).
- **Basic drug-interaction check** (`drug-interactions.ts`): ~10 bundled
  well-known interaction pairs, matched case-insensitively across a new
  prescription's items and the patient's other active prescriptions.
  Non-blocking, explicitly labeled "basic, non-exhaustive" in the API
  response and UI — no real terminology service exists in this repo
  (documented as TD-0016).
- **Tests:** 19 new unit tests (`drug-interactions.spec.ts` +
  `prescriptions.service.spec.ts`) + 14 new e2e tests
  (`prescriptions.e2e-spec.ts`: create with/without warnings, empty-items
  rejection, list, get-by-id, PDF headers, status transitions, own-scope
  enforcement, 401). 175 unit + 102 e2e total; all passing except one
  **pre-existing, unrelated** time-of-day flake in the appointments
  walk-in e2e test (documented as TD-0017 — its all-hours schedule
  fixture caps at 23:45, so no slot remains when the suite runs between
  ~23:30–23:59 local time; out of this checkpoint's scope to fix).
- **Frontend:** `apps/web/src/lib/api/prescriptions.ts` (incl. a
  blob-download helper for the PDF), a Prescriptions tab on the encounter
  detail page (multi-item prescribe form, interaction-warning alert,
  PDF-download/status actions), and a "Recent prescriptions" panel on the
  medical-records patient-timeline list page.
- **Full verification, all green:** `pnpm lint`, `pnpm typecheck`, `pnpm
  test` (175 api unit + 6 web), `pnpm test:e2e` (101/102, one unrelated
  pre-existing flake), `pnpm build` (all 6 packages).
- **Browser-verified end to end** (Playwright + Chromium in the session
  scratch dir): created a 2-item prescription (Aspirin + Warfarin) that
  correctly surfaced a real "severe" interaction warning on-screen,
  created a second unrelated prescription, downloaded and confirmed a
  genuine PDF (`file` command: "PDF document, version 1.3, 1 pages"),
  discontinued a prescription and watched its badge update, and confirmed
  the patient-timeline panel renders correctly with deep-links to the
  originating encounter. 6 screenshots under `docs/screens/`.
- **Hit the same TD-0004-pattern stale-dev-server issue a third time**:
  restarted both `pnpm dev` processes after the verification build,
  before the browser walkthrough — by now a well-understood, quick fix.
- Checkpoint 6.2 is genuinely complete per every item in `CLAUDE.md`'s
  Milestone Completion Checklist. Since Checkpoint 6.1 was already
  complete, **Milestone 6 (Clinical: Medical Records) is now fully
  complete.** `NEXT.md` replaced with **Milestone 7 — Laboratory &
  Radiology**.

### Files modified/created
- New: `packages/database/prisma/migrations/20260801175600_prescription_status_enum/`,
  `packages/types/src/prescription.ts`,
  `apps/api/src/modules/prescriptions/` (service+controller+DTOs+
  drug-interactions+prescription-pdf+specs, replacing the 3-line scaffold),
  `apps/api/test/prescriptions.e2e-spec.ts`,
  `apps/web/src/lib/api/prescriptions.ts`, 6 screenshots under
  `docs/screens/`.
- Modified: `packages/database/prisma/schema.prisma` (`PrescriptionStatus`
  enum, `Prescription.status`/`updatedAt`), `packages/database/prisma/seed.ts`
  (own-scope permission fix), `packages/types/src/enums.ts`
  (`PrescriptionStatus`, `MedicationRoute`), `packages/types/src/index.ts`,
  `apps/api/src/app.module.ts` (already had `PrescriptionsModule`
  registered from scaffolding), `apps/api/src/modules/audit/audit.listener.ts`
  (+2 `@OnEvent` handlers), `apps/api/src/modules/audit/audit.service.ts`
  (+`Prescription` to `listForDoctor`'s resource list) and its spec,
  `apps/web/src/app/dashboard/medical-records/[encounterId]/page.tsx`
  (Prescriptions tab), `apps/web/src/app/dashboard/medical-records/page.tsx`
  ("Recent prescriptions" panel), `.ai/*`.
- Database: applied migration `20260801175600_prescription_status_enum` to
  both `medicore_dev`/`medicore_test`. Created 2 real prescriptions via the
  browser walkthrough (Aspirin+Warfarin — Active; Cetirizine —
  Discontinued) against the existing demo patient/encounter — left in
  place as demo data.

### Known issues (not blocking, out of scope for this checkpoint)
- TD-0016: drug-interaction check is a small bundled list, not a real
  terminology service — disclosed, non-blocking.
- TD-0017: appointments walk-in e2e test flakes in a narrow ~30-minute
  window near midnight — pre-existing, unrelated to this checkpoint.

### Recommended next task
**Milestone 7 — Laboratory & Radiology**, per `.ai/NEXT.md`.

### Estimated completion
Overall project: still provisional outside audited modules (see
`MODULE_STATUS.md`), but Doctors, Scheduling, Appointments, and now all of
Clinical: Medical Records (Encounters/Clinical Notes/Vitals/Diagnoses/
Procedures/Attachments/Prescriptions) are 100% complete for their
checkpoints. Prescriptions module: 100% for Checkpoint 6.2. Milestone 6:
100% (both checkpoints complete).

---

## Session: 2026-08-01 (Milestone 6, Checkpoint 6.1 — Electronic Medical Records / EMR Foundation, completed)

### What was completed
Explicit, detailed instruction scoped this session to the EMR foundation
only: Encounter, Clinical Notes (versioned), Vitals, Diagnosis, Procedures,
Attachments — explicitly excluding Laboratory/Pharmacy/Billing/Radiology/AI,
and, within Clinical itself, deferring Prescriptions/Orders to Checkpoint
6.2. Per the reading-policy restriction, only the Patient/Doctor/Appointment
modules, the Prisma schema, and shared types were inspected.

- Recorded **ADR-0008**: replaced the flat `MedicalRecord` scaffold with
  `Encounter` as the central EMR entity, with every clinical facet as its
  own child table (`ClinicalNote`, `Vital`, `Diagnosis`, `Procedure`,
  `EncounterAttachment`) rather than flat columns/JSON blobs — the old
  model's shape genuinely couldn't represent versioned notes or
  multiple-diagnoses-per-encounter, unlike `Appointment` in Milestone 5
  which was reusable as-is. `ClinicalNote` is append-only by construction
  (no update method exists at the service layer) to satisfy "never
  overwrite historical notes." ICD-10 is an explicit placeholder field, not
  a validated lookup (no terminology service configured in this repo).
- Recorded **ADR-0009**: Milestone 6 split into Checkpoint 6.1 (this
  session) / 6.2 (Orders & Prescriptions, next) — same pattern as
  Milestone 4 (ADR-0005) and Milestone 5 (ADR-0006).
- New migration `20260801171211_emr_foundation`, applied to both
  `medicore_dev`/`medicore_test`. Renamed `Prescription.medicalRecordId` →
  `encounterId` and the `Patient`/`Doctor`/`Organization` back-relations
  (`medicalRecords` → `encounters`) — confirmed via grep the blast radius
  was contained to one `patients.service.ts` summary-count query plus its
  test mock before making the change.
- **Backend** (`apps/api/src/modules/medical-records/`, rebuilt from a
  3-line no-op scaffold): `EncountersService`/`Controller` (create,
  paginated/filterable list, get-by-id, status transitions via a fixed
  `ALLOWED_TRANSITIONS` map), `ClinicalNotesService`/`Controller`
  (append-only versioning), `VitalsService`/`Controller` (server-computed
  BMI, cross-encounter trend query via the `encounter` relation — `Vital`
  has no direct `organizationId`/`patientId` column), `DiagnosesService`/
  `ProceduresService`/`Controller`s (typed CRUD), `EncounterAttachmentsService`/
  `Controller` (mirrors the existing `DoctorDocument` pattern exactly,
  reuses `StorageService`). A shared `assertOwnScopeOk` helper in
  `EncountersService` is reused by every sibling controller so own/all-scope
  enforcement isn't duplicated per resource. Full REST + Swagger + RBAC +
  audit + pagination/filtering.
- **Self-caught security fix** (found while writing the e2e test, not
  reported by anyone): `EncountersController.getById` initially had zero
  own-scope enforcement — any `.own`-scoped doctor could read any
  encounter by ID regardless of whose patient it was. Fixed with the same
  `assertOwnScopeOk` check already used elsewhere in the module.
- **Tests:** 30 new unit tests (6 service spec files) + 21 new e2e tests
  (`medical-records.e2e-spec.ts`) covering encounter CRUD, clinical-note
  versioning (v1→v2 without overwrite, history, current), vitals + BMI +
  patient-level trend, diagnoses, procedures, attachment upload/list/
  delete, valid/invalid status transitions, own-scope 403s, and 401
  without a token. 156 unit + 88 e2e total, all passing.
- **Frontend:** new `apps/web/src/lib/api/medical-records.ts` client, and
  two pages — `/dashboard/medical-records` (patient timeline: filters,
  weight-trend chart, new-encounter dialog) and
  `/dashboard/medical-records/[encounterId]` (SOAP-style tabs: Subjective
  — clinical notes with 2s-debounced autosave + version history dialog;
  Objective — vitals form + live BMI preview + BMI trend chart +
  attachments; Assessment — diagnoses; Plan — procedures + read-only
  encounter notes — plus a header status-transition action). No debounce
  hook existed in the codebase; used inline `useEffect`/`setTimeout`
  rather than introducing one for a single call site.
- **Full verification, all green:** `pnpm lint`, `pnpm typecheck`, `pnpm
  test` (156 api unit + 6 web), `pnpm test:e2e` (88/88, 7 suites), `pnpm
  build` (all 6 packages).
- **Browser-verified end to end** (Playwright + Chromium in the session
  scratch dir per TD-0010): real encounter creation, clinical note v1
  autosave → version history → v2 amend, vitals recording with correct
  BMI computation (170cm/68kg → 23.5, confirmed on-screen), diagnosis with
  ICD-10 placeholder, procedure, attachment upload, and the full In
  Progress → Completed status transition. 11 screenshots under
  `docs/screens/`.
- **Hit and resolved a TD-0004-pattern issue twice in the same session**:
  running the full-monorepo `turbo run build --force` while `pnpm dev` was
  still running clobbered both the running `apps/web` (`next dev`) and
  `apps/api` (`nest start --watch`) processes' compiled output in place —
  the frontend served mismatched dev/prod chunks and the API 404'd on
  every brand-new `/encounters` route until both dev servers were killed
  and restarted. No code changes were needed; documented as a TD-0004
  addendum with the recommended order-of-operations fix.
- Checkpoint 6.1 is genuinely complete per every item in `CLAUDE.md`'s
  Milestone Completion Checklist (backend, frontend, tests, lint,
  typecheck, build, docs, screenshots). `NEXT.md` replaced with
  **Checkpoint 6.2 — Orders & Prescriptions**.

### Files modified/created
- New: `packages/database/prisma/migrations/20260801171211_emr_foundation/`,
  `packages/types/src/encounter.ts`,
  `apps/api/src/modules/medical-records/` (encounters/clinical-notes/
  vitals/diagnoses/procedures/encounter-attachments services+controllers+
  DTOs+specs, `medical-records.module.ts`),
  `apps/api/test/medical-records.e2e-spec.ts`,
  `apps/web/src/lib/api/medical-records.ts`,
  `apps/web/src/app/dashboard/medical-records/page.tsx`,
  `apps/web/src/app/dashboard/medical-records/[encounterId]/page.tsx`,
  11 screenshots under `docs/screens/`.
- Deleted: `packages/types/src/medical-record.ts` (superseded by
  `encounter.ts`; confirmed nothing else referenced it).
- Modified: `packages/database/prisma/schema.prisma` (`Encounter` +
  5 child models replacing `MedicalRecord`, `Prescription.encounterId`
  rename), `packages/types/src/enums.ts` (`EncounterType`/`EncounterStatus`/
  `DiagnosisType`/`EncounterAttachmentType`), `packages/types/src/index.ts`,
  `apps/api/src/modules/audit/audit.listener.ts` (3 new `@OnEvent`
  handlers), `apps/api/src/modules/audit/audit.service.ts` (+`Encounter`
  to `listForDoctor`'s resource list) and its spec,
  `apps/api/src/modules/patients/patients.service.ts` (+spec) (`medicalRecord`
  → `encounter` in the summary-count query), `.ai/*`.
- Database: applied migration `20260801171211_emr_foundation` to both
  `medicore_dev`/`medicore_test`. Created one real encounter (patient
  Anita Desai / Dr. Ravi Kumar) via the browser walkthrough — left in
  place as demo data, now `Completed` with a full note/vitals/diagnosis/
  procedure/attachment trail.

### Known issues (not blocking, out of scope for this checkpoint)
- A background `POST /api/v1/auth/refresh` fires on initial page load and
  403s with `Invalid or missing CSRF token`; login still succeeds
  immediately after. Not investigated — auth module is out of scope per
  this session's reading-policy restriction. See TECH_DEBT TD-0004
  addendum.
- ICD-10 is free-text (placeholder field), no terminology lookup — by
  design per ADR-0008, future scope noted there.

### Recommended next task
**Checkpoint 6.2 — Orders & Prescriptions**, per `.ai/NEXT.md`.

### Estimated completion
Overall project: still provisional outside audited modules (see
`MODULE_STATUS.md`), but Doctors, Scheduling, Appointments, and now the EMR
Foundation are 100% complete for their checkpoints. Medical-records module:
100% for Checkpoint 6.1 (prescriptions/orders deferred to 6.2).

---

## Session: 2026-08-01 (Milestone 5, Checkpoint 5.2 — Queue & Recurring, completed; Milestone 5 fully complete; autonomous loop iteration)

### What was completed
This is the `/loop`'s second automatic iteration (dynamic self-pacing,
woken by its own `ScheduleWakeup`), continuing directly from the Checkpoint
5.1 session below with no user interaction in between.

- Recorded **ADR-0007**: `Appointment.isWalkIn: Boolean` (not a new
  `AppointmentType`) + `Appointment.recurrenceGroupId: String?` (independent
  rows per occurrence, no rule-expansion table) — a real design choice this
  checkpoint needed, resolved with reasonable defaults rather than stopping
  to ask, per the loop's instructions.
- New migration `20260731195629_appointment_walkin_recurrence`
  (`isWalkIn`/`recurrenceGroupId` columns), applied to both databases.
- Backend: extracted `AppointmentsService.create`'s booking logic into a
  shared private `bookSlot` helper, then built `createWalkIn` (auto-assigns
  the next available slot at/after right now, today) and `createRecurring`
  (books N occurrences sharing one group id, reporting conflicts as
  `failed[]` rather than aborting or silently dropping them) on top of it.
  Two new endpoints: `POST /appointments/walk-in`,
  `POST /appointments/recurring`.
- Tests: 4 new unit tests (16 total in the appointments spec, using
  `jest.useFakeTimers` to make "now" deterministic for the walk-in test),
  5 new e2e tests (17 total) including a dedicated all-hours/all-week
  doctor fixture so the walk-in e2e test doesn't depend on what day/time
  the suite happens to run. 126 unit + 67 e2e total, all passing.
- Frontend: walk-in quick-book dialog + a "Recurring booking" toggle in the
  existing booking dialog + Walk-in/Recurring badges in the queue table.
- Full verification green (lint/typecheck/test/test:e2e/build) and
  browser-verified: booked a walk-in for a demo all-hours doctor (correctly
  auto-slotted relative to real wall-clock time — this session ran at
  01:39 AM IST on a Saturday, so a real schedule wouldn't have had any
  availability; created a throwaway demo doctor with a 00:00–23:45/7-day
  schedule specifically so the walkthrough would succeed regardless of
  when it ran) and booked a 4-occurrence weekly recurring series (all 4
  succeeded). 5 new screenshots under `docs/screens/`.
- **SMS confirmations were not attempted** — no SMS provider configured
  anywhere in this repo, called out as credential-blocked per the loop's
  own instructions (CLAUDE.md prohibits faking clinical/billing/auth logic
  to "make it work," and a fake SMS send would be exactly that). Recorded
  as TD-0015 (tracking only, not a defect) rather than silently dropped.
- Also recorded TD-0014 (recurring series can't be bulk-edited/cancelled —
  a real but low-severity usability gap, `recurrenceGroupId` already
  supports building this later).
- **Confirmed TD-0011's fix holds up**: `pnpm db:seed` for this checkpoint
  required zero manual follow-up script, unlike the two prior times this
  came up.
- **Reconciled `docs/roadmap.md`'s milestone-numbering mismatch**, flagged
  in `NEXT.md` twice across the last two sessions without being acted on:
  inserted "Milestone 5 — Appointment Management" as the roadmap's actual
  Milestone 5 (with Checkpoint 5.1/5.2 status filled in), and renumbered
  the old Milestones 5–13 to 6–14 (bumping their Week labels by one each).
  `NEXT.md` and `docs/roadmap.md` no longer disagree.
- Since Checkpoint 5.2's non-blocked scope is genuinely complete and
  verified, and SMS is explicitly documented as deferred rather than
  silently dropped, **Milestone 5 as a whole is now marked complete.**
  `NEXT.md` replaced with **Milestone 6 — Clinical: Medical Records**.

### Files modified/created
- New: `packages/database/prisma/migrations/20260731195629_appointment_walkin_recurrence/`,
  `apps/api/src/modules/appointments/dto/create-walk-in-appointment.dto.ts`,
  `apps/api/src/modules/appointments/dto/create-recurring-appointment.dto.ts`,
  5 screenshots under `docs/screens/appointments-{walkin,recurring}-*.png`.
- Modified: `packages/database/prisma/schema.prisma` (`isWalkIn`,
  `recurrenceGroupId` on `Appointment`), `packages/types/src/appointment.ts`
  (new schemas/types), `packages/types/src/enums.ts`
  (`RecurrenceFrequency`), `apps/api/src/modules/appointments/appointments.service.ts`
  (`bookSlot` extraction, `createWalkIn`, `createRecurring`),
  `apps/api/src/modules/appointments/appointments.controller.ts` (2 new
  routes), `apps/api/src/modules/appointments/appointments.service.spec.ts`
  (+4 tests, `buildAvailability` made date-parameterized),
  `apps/api/test/appointments.e2e-spec.ts` (+5 tests, new all-hours doctor
  fixture), `apps/web/src/lib/api/appointments.ts` (2 new client
  functions), `apps/web/src/app/dashboard/appointments/page.tsx` (walk-in
  dialog, recurring toggle, badges), `docs/roadmap.md` (Milestone 5
  inserted, 5–13 renumbered to 6–14), `.ai/*`.
- Database: applied migration `20260731195629_appointment_walkin_recurrence`
  to both `medicore_dev`/`medicore_test`. Created one demo doctor ("Ravi
  Kumar", all-hours schedule) via the API for browser verification — left
  in place as demo data.

### Architectural decisions
- ADR-0007 (see above) — the only new one this iteration.

### Known issues
- TD-0014 (recurring series bulk edit/cancel not supported, Low) and
  TD-0015 (SMS deferred, tracking-only) are new.
- All previously open TDs remain open except TD-0011 (confirmed fixed,
  again, this session) — see `TECH_DEBT.md` for the full list.

### Recommended next task
See `.ai/NEXT.md`: **Milestone 6 — Clinical: Medical Records** (SOAP notes,
vitals, diagnosis/ICD-10, prescriptions). The autonomous loop remains
active and will continue into it automatically absent a genuine blocker.

### Estimated project completion percentage
- Overall: still unaudited outside Doctors/Scheduling/Appointments
  (TD-0001 unresolved for every other module).
- **Milestone 4 (Doctor Management & Scheduling): 100% complete.**
- **Milestone 5 (Appointment Management): 100% complete** (SMS explicitly
  deferred/credential-blocked, not counted against completion per the same
  standard applied elsewhere — a feature requiring external credentials
  the user hasn't supplied is out of scope, not "incomplete work").

---

## Session: 2026-08-01 (Milestone 5, Checkpoint 5.1 — Appointment Core Booking, completed; autonomous milestone loop)

### What was completed
This session began with an explicit instruction to continue implementing
milestones automatically, one after another, following CLAUDE.md's
read → implement → verify → document → replace-NEXT.md workflow, without
stopping between milestones. Set up via the `/loop` skill in dynamic
(self-pacing) mode.

- Recorded **ADR-0006**: appointment booking reuses `AvailabilityService`
  directly (no changes to its public shape — confirming the design intent
  its own comment anticipated back in Checkpoint 4.2); Milestone 5 split
  into Checkpoint 5.1 (this session) and 5.2 (deferred: walk-in queue
  reorg, recurring appointments, SMS). This also resolved TD-0009's
  dangling "ADR-0006" reference.
- Discovered the `appointments` module was a 3-line no-op scaffold, but
  the `Appointment` Prisma model, `AppointmentType`/`AppointmentStatus`
  enums, and most of `packages/types/src/appointment.ts` already existed
  unused from the original scaffolding commit — reused them as-is per
  CLAUDE.md's "code is ground truth" rule rather than redesigning.
- Implemented full backend: conflict-aware booking, a validated status
  state machine, available-slots endpoint, email confirmation (reusing
  `EmailService`'s existing console-fallback behavior — not
  credential-blocked), own-scope permission for doctors, and audit
  integration (both capture and the existing per-doctor audit-timeline
  query). See `PROGRESS.md` 2026-08-01 for full file-level detail.
- Wrote 12 unit tests + 13 e2e tests, all passing alongside the full
  existing suite (122 unit total, 63 e2e total across 6 suites).
- Built the full frontend (day-view queue + booking dialog with live slot
  selection) at `apps/web/src/app/dashboard/appointments/page.tsx`.
- Full verification green: lint, typecheck, test, test:e2e, build.
  Browser-verified end to end (Playwright, reusing the scratch-dir setup
  from the previous session) — booked a real appointment, watched slots
  update live, walked the status machine through 3 transitions. 5 new
  screenshots under `docs/screens/`.
- **Actually fixed TD-0011** (previously just worked around): added
  `syncRolePermissions()` to `seed.ts`, called after every role upsert.
  Verified the fix by reproducing the exact original bug (deleted a
  `RolePermission` row, confirmed a normal `pnpm db:seed` run restored it)
  rather than only asserting it in the abstract. This was a real,
  independently-valuable fix, not scope creep — TD-0011 had already bitten
  twice (this session and the previous one) and would keep costing every
  future session that needs local browser verification.
- Recorded two new tech-debt items found during verification: **TD-0012**
  (appointment booking has no DB-level protection against a concurrent
  double-booking race — app-level check only, same limitation class as
  the pre-existing `DoctorLeaveService` overlap check) and **TD-0013** (the
  local `pnpm dev` API server's log file didn't show request-completed or
  email-fallback lines the way e2e test runs do — an observability gap in
  ad hoc verification, not a product defect; not investigated further).
- Updated `.ai/NEXT.md`: replaced with Checkpoint 5.2.

### Files modified/created
- New: `apps/api/src/modules/appointments/{appointments.service.ts,
  appointments.controller.ts, appointments.service.spec.ts,
  dto/create-appointment.dto.ts, dto/update-appointment-status.dto.ts}`,
  `apps/api/test/appointments.e2e-spec.ts`,
  `apps/web/src/lib/api/appointments.ts`,
  `apps/web/src/app/dashboard/appointments/page.tsx`, 5 screenshots under
  `docs/screens/appointments-*.png`.
- Modified: `apps/api/src/modules/appointments/appointments.module.ts`
  (was a no-op, now imports `SchedulingModule`), `packages/types/src/appointment.ts`
  (`UpdateAppointmentStatusDto` type export, new `AppointmentWithDetails`),
  `apps/api/src/common/email/email.templates.ts`
  (`appointmentConfirmedTemplate`), `apps/api/src/modules/audit/audit.listener.ts`
  (2 new event handlers), `apps/api/src/modules/audit/audit.service.ts`
  (`Appointment` added to `listForDoctor`'s resource list, +
  `audit.service.spec.ts` updated to match), `packages/database/prisma/seed.ts`
  (new `appointments.update` own-scope permission + the `syncRolePermissions`
  fix), `.ai/*`.
- Database: no new migration (the `Appointment` model already existed).
  Re-ran `pnpm db:seed` against `medicore_dev` (picked up the new
  permission row and, after the TD-0011 fix, correctly synced it onto the
  `Doctor` role without any manual follow-up script this time). Created
  one demo patient (`Anita Desai`) via the API for browser verification —
  left in place as demo data, consistent with prior sessions' doctor demo
  data.

### Architectural decisions
- ADR-0006 (see above) — the only new one. No other architecture questions
  came up; existing decisions (permission own/all-scope pattern,
  one-checkpoint-per-session discipline) covered everything else.

### Known issues
- TD-0012 (booking race condition, Medium) and TD-0013 (dev-server log
  visibility gap, Low) are new and open.
- TD-0009 (dangling ADR-0006 reference) is now Resolved — this session's
  ADR-0006 gave it something real to point to.
- TD-0001, TD-0002, TD-0004, TD-0008, TD-0010, TD-0012, TD-0013 remain open.

### Recommended next task
See `.ai/NEXT.md`: Checkpoint 5.2 (walk-in queue flow, recurring
appointments — SMS remains credential-blocked). The autonomous loop is
still active (self-pacing `/loop`, no fixed interval) and will continue
into it automatically absent a genuine blocker.

### Estimated project completion percentage
- Overall: still unaudited outside Doctors/Scheduling/Appointments
  (TD-0001 unresolved for every other module).
- **Milestone 4 (Doctor Management & Scheduling): 100% complete.**
- **Milestone 5 (Appointment Management): Checkpoint 5.1 — 100% complete.**
  Checkpoint 5.2 — 0% (not started).

---

## Session: 2026-07-31 (Checkpoint 4.2 — Doctor Scheduling, completed)

### What was completed
Continuation of the same-day audit session (below) — implemented the 3
missing deliverables it found, then fully verified. **Milestone 4 is now
complete; `NEXT.md` has been replaced with Milestone 5.**

- Backend: `DoctorDocument` model/migration/service/controller (mirrors
  `PatientDocument`+`StorageService`), `AuditService.listForDoctor()` +
  `GET /doctors/:id/audit-timeline` (reuses existing `AuditLog`, no
  duplicated capture logic — 2 new `@OnEvent` handlers added to
  `audit.listener.ts` for document events), new `doctors.documents`
  permission resource in `seed.ts`.
- Tests: `doctor-document.service.spec.ts` (9), `audit.service.spec.ts` (3,
  new file), `apps/api/test/doctor-documents.e2e-spec.ts` (12) — all
  passing, on top of the already-passing scheduling suite.
- Frontend: 5 new tabs (Schedule, Leave, Availability, Documents, Audit) on
  `apps/web/src/app/dashboard/doctors/[id]/page.tsx`, new
  `apps/web/src/lib/api/scheduling.ts` client. No new frontend test files
  (the `patients` module reuse-template has none either) — stated
  explicitly per `CLAUDE.md` rather than silently skipped.
- Full verification: `pnpm lint`, `pnpm typecheck`, `pnpm test` (110 api + 6
  web), `pnpm test:e2e` (50/50, 5 suites), `pnpm build` (all 6 packages) —
  all green.
- Manual browser verification: installed Playwright + Chromium into the
  session scratch dir (not a project dependency), ran both dev servers,
  logged in as `admin@medicore.demo`, and drove the real golden path —
  created a schedule version, applied+approved a leave, checked
  availability, uploaded a document, confirmed all 3 event types in the
  audit timeline. 9 screenshots saved to `docs/screens/` (also closing out
  TD-0003's long-standing gap for Checkpoint 4.1's own screenshots).
- Discovered and locally fixed (data-only, not code) a **real bug**: the
  `medicore_dev` `Hospital Admin`/`Doctor` roles predated several
  permission resources and were never backfilled, because `seed.ts`'s
  `role.upsert` no-ops for a role that already exists. Recorded as
  **TD-0011 (High)** — a genuine `seed.ts` defect, not fixed this session
  (out of scope; only local dev data was patched to unblock verification).
- Also hit and documented (TD-0004 addendum): a long-running `nest
  start --watch` process served a stale route table, 404ing the brand-new
  audit-timeline endpoint until the dev server was restarted — not a code
  bug.
- Resolved TD-0003, TD-0005, TD-0006, TD-0007 (all marked Resolved in
  `TECH_DEBT.md`). Added TD-0010 (no committed browser-verification
  tooling) and TD-0011 (seed.ts permission-sync bug) as new open items.

### Files modified/created
- New: `packages/database/prisma/migrations/20260731152146_doctor_documents/`,
  `packages/types/src/doctor-document.ts`,
  `packages/types/src/doctor-audit-timeline.ts`,
  `apps/api/src/modules/scheduling/doctor-document.service.ts` (+`.spec.ts`),
  `apps/api/src/modules/scheduling/doctor-document.controller.ts`,
  `apps/api/src/modules/audit/audit.service.spec.ts`,
  `apps/api/test/doctor-documents.e2e-spec.ts`,
  `apps/web/src/lib/api/scheduling.ts`,
  `docs/screens/doctors-list.png`, `docs/screens/doctors-registration-form.png`,
  `docs/screens/doctor-profile-tabs-overview.png`,
  `docs/screens/doctor-schedule-tab.png`,
  `docs/screens/doctor-schedule-new-version-dialog.png`,
  `docs/screens/doctor-leave-tab.png`, `docs/screens/doctor-availability-tab.png`,
  `docs/screens/doctor-documents-tab.png`, `docs/screens/doctor-audit-tab.png`.
- Modified: `packages/database/prisma/schema.prisma` (`DoctorDocumentType`
  enum, `DoctorDocument` model, `Doctor.documents` relation),
  `packages/database/prisma/seed.ts` (`doctors.documents` permission
  resource + role grants), `packages/types/src/enums.ts`
  (`DoctorDocumentType`), `packages/types/src/index.ts`,
  `apps/api/src/modules/audit/audit.service.ts` (`listForDoctor`),
  `apps/api/src/modules/audit/audit.listener.ts` (2 new handlers),
  `apps/api/src/modules/doctors/doctors.controller.ts` (audit-timeline
  route), `apps/api/src/modules/doctors/doctors.module.ts` (imports
  `AuditModule`), `apps/api/src/modules/scheduling/scheduling.module.ts`
  (registers `DoctorDocumentController`/`Service`, exports `DoctorRefService`),
  `apps/web/src/app/dashboard/doctors/[id]/page.tsx` (5 new tabs), `.ai/*`.
- Database: applied migration `20260731152146_doctor_documents` to both
  `medicore_dev` and `medicore_test`; manually granted missing
  `RolePermission` rows to `medicore_dev`'s `Hospital Admin`/`Doctor` roles
  (see TD-0011 — a data fix, not a schema/migration change).

### Architectural decisions
- None new. The audit-timeline endpoint was deliberately placed on the
  existing `DoctorsController` (not a new controller/resource) and gated
  behind the existing `doctors.read` permission rather than inventing a new
  one — a routine implementation choice, not an ADR-worthy decision.

### Known issues
- TD-0009 (dangling `ADR-0006` reference in `availability.service.ts`'s
  comments) remains open — untouched, as planned.
- TD-0010 (no committed browser-verification tooling) and TD-0011 (seed.ts
  permission-sync bug, High severity) are new and open — see
  `TECH_DEBT.md`.
- TD-0001, TD-0002, TD-0004, TD-0008 (from prior sessions) remain open and
  unrelated to this session's scope.

### Recommended next task
See `.ai/NEXT.md`: **Milestone 5 — Appointment Management** (patient-facing
appointment booking, deferred since ADR-0005). Before starting, a future
session should ideally fix TD-0011 (`seed.ts` permission sync) since it will
keep causing confusing 403s on any local dev database.

### Estimated project completion percentage
- Overall: still unaudited outside Doctors/Scheduling (TD-0001 unresolved
  for every other module).
- **Milestone 4 (Doctor Management & Scheduling): 100% complete** — both
  checkpoints done, verified, documented, and screenshotted.

---

## Session: 2026-07-31 (Checkpoint 4.2 — Doctor Scheduling, audit)

### What was completed
- Per user instruction, audited (did not implement) Checkpoint 4.2 work
  found in `git status` at session start but never recorded in `.ai/`:
  `apps/api/src/modules/scheduling/` (schedule/leave/availability
  controllers, services, DTOs, `doctor-ref.service.ts`),
  `apps/api/test/scheduling.e2e-spec.ts`, two Prisma migrations
  (`20260731090000_provider_scheduling`,
  `20260731091500_doctor_schedule_unique_effective_from`), and three new
  `packages/types` files (`doctor-schedule.ts`, `doctor-leave.ts`,
  `doctor-availability.ts`).
- Read every file in the scheduling module, the migrations, the schema
  diff, and the cross-module wiring (`app.module.ts`, `doctors.module.ts`,
  `doctors.service.ts`, `audit.listener.ts`, `seed.ts` permissions).
- Ran the full Definition of Done suite: `pnpm lint` (failed cold with 1029
  errors from a never-generated Prisma client — fixed by running
  `pnpm --filter @medicore/database db:generate`, then clean),
  `pnpm typecheck` (clean), `pnpm test` (101 api + 6 web passing),
  `pnpm test:e2e` (38/38 across 4 suites, including the new 20-test
  `scheduling.e2e-spec.ts`), `pnpm build` (all 6 packages clean via
  `turbo run build --force` for unbuffered output).
- Determined Checkpoint 4.2 is **partially complete**: the backend
  scheduling engine (weekly schedules, leave management, availability,
  dashboard stats, audit event capture) is done and verified; doctor
  documents, a queryable per-doctor audit timeline, and the entire
  frontend are not started.
- Updated `.ai/NEXT.md` to list only the 3 remaining deliverables (not
  Milestone 5 — the checkpoint isn't done).
- Added TD-0005 (doctor documents missing), TD-0006 (audit timeline has no
  query surface), TD-0007 (no frontend for 4.2), TD-0008 (Prisma-client
  generation trap), TD-0009 (dangling ADR-0006 reference in code comment)
  to `TECH_DEBT.md`.
- Updated `PROGRESS.md`, `CHANGELOG.md`, `MODULE_STATUS.md` (added a
  `scheduling` module row; added a "Doctor scheduling UI" frontend row),
  and `PROJECT_CONTEXT.md` (Checkpoint 4.2 status line).

### Files modified/created
- Modified (`.ai/` only — no application code changed this session):
  `NEXT.md`, `PROGRESS.md`, `CHANGELOG.md`, `MODULE_STATUS.md`,
  `TECH_DEBT.md`, `PROJECT_CONTEXT.md`, `SESSION_LOG.md` (this file).
- Database: no schema change; applied no new migrations (both scheduling
  migrations were already deployed to `medicore_test`, unlike the drift
  found in the 4.1 session).

### Architectural decisions
- None made this session — audit and documentation only. Flagged (did not
  resolve) a dangling reference to a not-yet-written "ADR-0006" inside
  `availability.service.ts`'s comments (TD-0009).

### Known issues
- TD-0005: doctor documents (upload/list/delete) not implemented.
- TD-0006: audit event capture exists but has no per-doctor query/view.
- TD-0007: zero frontend UI for any of Checkpoint 4.2.
- TD-0008: a stale/never-generated Prisma client makes `pnpm lint` fail
  with ~1000 unrelated errors — regenerate with
  `pnpm --filter @medicore/database db:generate` before trusting a lint
  failure count.
- TD-0009: `availability.service.ts` references a nonexistent ADR-0006.
- TD-0001 through TD-0004 (from prior sessions) remain open and unrelated
  to this session's scope.

### Recommended next task
See `.ai/NEXT.md`: finish Checkpoint 4.2 — doctor documents (reuse the
`patients`/`PatientDocument`/`StorageService` pattern), an audit-timeline
query endpoint, and the full frontend for schedule/leave/availability
/documents, plus their tests and a screenshot. Only then mark 4.2 complete
and move on to Milestone 5.

### Estimated project completion percentage
- Overall: still unaudited outside Doctors/Scheduling (TD-0001 unresolved
  for every other module).
- Milestone 4 / Doctor Scheduling (Checkpoint 4.2): **~60% —** backend
  engine complete and verified; documents, audit-timeline view, and
  frontend remain.

---

## Session: 2026-07-31 (Checkpoint 4.1 — Doctor Management)

### What was completed
- Discovered, at session start, that `.ai/` contained no record of any work
  beyond governance scaffolding, yet the actual repo (git status) had
  substantial undocumented in-progress work: a full `doctors` module, a
  generic `StaffOnboardingService`, a Prisma migration, and frontend doctor
  pages. Per `CLAUDE.md`'s "code is ground truth" rule, audited that code
  against the user's Checkpoint 4.1 requirement list instead of re-asking
  or re-implementing.
- Confirmed Checkpoint 4.1 (Doctor CRUD, professional profile, linked-user
  onboarding, search, filters, dashboard, doctor profile page) was already
  functionally complete in both backend and frontend.
- Ran full verification and fixed every real issue it surfaced:
  - Fixed 2 lint violations (import order in `doctors.controller.ts`;
    unescaped apostrophe in the doctor detail page).
  - `typecheck` and unit `test` (api + web) were already clean — 76 tests
    passing.
  - Set up local e2e environment for the first time this session
    (`apps/api/.env`, JWT keypair via `keys:generate`, pointed at the
    already-running `medicore-postgres`/`medicore-redis` containers on
    ports 5434/6381). Found and fixed two real bugs during e2e: the
    `medicore_test` database was missing a migration (applied it), and one
    e2e assertion expected the wrong HTTP status from `/auth/login` (fixed
    the test, not the endpoint — the endpoint's `200` is correct REST
    practice for login). All 14 e2e tests pass afterward.
  - `pnpm build` — clean across all packages.
- Wrote `docs/modules/04-doctor-management.md`.
- Updated `docs/roadmap.md` to split Milestone 4 into Checkpoint 4.1 (done)
  / 4.2 (next); moved original appointment-booking deliverables to a
  "Deferred beyond Milestone 4" section.
- Recorded ADR-0005 (Milestone 4 scope split; `StaffOnboardingService` kept
  generic for reuse by Nurse/Pharmacist/Lab Technician/Receptionist).
- Updated `PROGRESS.md`, `CHANGELOG.md`, `MODULE_STATUS.md`,
  `PROJECT_CONTEXT.md`, `TECH_DEBT.md` (added TD-0003, TD-0004), and this
  file.

### Files modified/created
- New: `docs/modules/04-doctor-management.md`
- Modified: `apps/api/src/modules/doctors/doctors.controller.ts` (lint fix),
  `apps/web/src/app/dashboard/doctors/[id]/page.tsx` (lint fix),
  `apps/api/test/doctors.e2e-spec.ts` (test assertion fix),
  `docs/roadmap.md`, `.ai/DECISIONS.md`, `.ai/PROGRESS.md`,
  `.ai/CHANGELOG.md`, `.ai/MODULE_STATUS.md`, `.ai/PROJECT_CONTEXT.md`,
  `.ai/TECH_DEBT.md`, `.ai/SESSION_LOG.md`, `.ai/NEXT.md`
- Local-only, not committed: `apps/api/.env` (generated from
  `.env.example`, with RS256 keys and adjusted DB/Redis ports for this
  machine's containers) — required for anyone else to run `test:e2e`
  locally; see TD-0004.
- Database: applied the pending `20260730220227_doctor_professional_profile`
  migration to the `medicore_test` database (was already applied to
  `medicore_dev`).

### Architectural decisions
- ADR-0005: Milestone 4 redefined as "Doctor Management & Scheduling," split
  into Checkpoint 4.1 (this session, complete) and 4.2 (next session).
  Appointment booking deferred beyond Milestone 4. `StaffOnboardingService`
  confirmed as the standing generic onboarding primitive for all future
  staff-profile modules.

### Known issues
- TD-0003: no screenshot exists for this milestone — no browser/UI access
  in this session.
- TD-0004: local e2e setup (`.env`, JWT keys, keeping `medicore_dev` and
  `medicore_test` migrations in sync) is manual and undocumented outside
  this session log; a schema change applied to one DB and not the other
  will misleadingly look like an application bug.
- Everything outside the `doctors` module and `common/onboarding/` remains
  unaudited (TD-0001) — this session deliberately did not expand scope
  beyond Checkpoint 4.1, per `CLAUDE.md` cost-optimization rules and the
  user's explicit instruction to stop after this checkpoint.

### Recommended next task
See `.ai/NEXT.md`: Checkpoint 4.2 (Doctor Scheduling) — weekly schedules,
leave management, availability, dashboard availability stats, doctor
documents, audit timeline, remaining tests. Do not start it in the same
session as this one (already used) — start fresh.

### Estimated project completion percentage
- Overall: still unaudited outside of Doctors (TD-0001 unresolved for every
  other module).
- Milestone 4 / Doctor Management module: **Checkpoint 4.1 — 100%
  complete.** Checkpoint 4.2 — 0% (not started).

---

## Session: 2026-07-31 (Project governance scaffolding)

### What was completed
- Created `CLAUDE.md` at repo root: mission statement, mandatory startup
  reading order, `.ai/` file responsibilities, post-task update rules,
  documentation rules, session handoff rules, "never re-ask a settled
  architecture question" rule, screenshot rule, testing/definition-of-done
  rule, and completion-tracking rule.
- Created `.ai/` directory with all eight required files, each initialized
  with real content derived from the actual repo state (not empty
  templates): `PROJECT_CONTEXT.md`, `PROGRESS.md`, `NEXT.md`,
  `DECISIONS.md`, `TECH_DEBT.md`, `SESSION_LOG.md`, `MODULE_STATUS.md`,
  `CHANGELOG.md`.
- Created `docs/screens/` directory for future milestone screenshots.
- Surveyed the repo (README, package.json, `apps/api/src/modules/`,
  `apps/web/src/`, `packages/`) to seed `PROJECT_CONTEXT.md` and
  `MODULE_STATUS.md` with accurate structural facts.

### Files modified/created
- `CLAUDE.md` (new)
- `.ai/PROJECT_CONTEXT.md` (new)
- `.ai/PROGRESS.md` (new)
- `.ai/NEXT.md` (new)
- `.ai/DECISIONS.md` (new)
- `.ai/TECH_DEBT.md` (new)
- `.ai/SESSION_LOG.md` (new, this file)
- `.ai/MODULE_STATUS.md` (new)
- `.ai/CHANGELOG.md` (new)
- `docs/screens/` (new, empty directory)

### Architectural decisions
- Recorded ADR-0001 through ADR-0004 in `DECISIONS.md`, reconstructing the
  monorepo, NestJS module-per-domain, and permissions-over-roles decisions
  retroactively from existing code, plus formally adopting the `.ai/` +
  `CLAUDE.md` governance system itself (ADR-0004).
- No code behavior was changed in this session — governance/documentation
  only.

### Known issues
- Module implementation depth is unaudited (TD-0001) — every backend module
  is marked "In Progress / Unaudited" in `MODULE_STATUS.md` pending a real
  review.
- CI has not been verified to actually pass lint/typecheck/test/build
  end-to-end against current code (TD-0002).
- Note: there is a large pre-existing set of staged/uncommitted changes in
  git status (many new modules: auth, audit, email, permissions, redis,
  etc., plus deleted `roles.guard.ts`/`roles.decorator.ts`) that predate this
  session and were not created by it — a future session should confirm
  whether these are intended to be committed and whether `MODULE_STATUS.md`
  needs a refresh once they land.

### Recommended next task
See `.ai/NEXT.md`: audit real module completeness under
`apps/api/src/modules/` and `apps/web/src/`, then update `MODULE_STATUS.md`
and `PROJECT_CONTEXT.md` with verified (not estimated) completion state.

### Estimated project completion percentage
- Overall: **unaudited** — do not trust a number until `MODULE_STATUS.md`
  is populated from a real per-module review (see TD-0001).
- Governance/documentation layer (`CLAUDE.md` + `.ai/`): **100% for this
  session's scope** (files created and populated; will need periodic upkeep).
