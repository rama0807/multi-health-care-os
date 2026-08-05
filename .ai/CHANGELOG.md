# CHANGELOG.md

> Human-readable log of notable changes. Newest entry on top. This is the
> narrative counterpart to `PROGRESS.md` (which is more granular/session-by-session).

## [Unreleased]

### Design System V2 — Phase 1: the reusable UI foundation (2026-08-06)

**Design language only. No feature page, dashboard, API, business rule or test
was changed** — by instruction. See **ADR-0031**.

- **Token layer rewritten** (`apps/web/src/app/globals.css`). Every colour in
  the application now resolves through a semantic token: four surface elevation
  steps, three text emphasis levels, borders, a seven-role brand family, the
  sidebar's own surface family, five status families, an eight-colour chart
  ramp, elevation, radius and shell geometry — in a light and a fully
  re-derived dark theme. `tailwind.config.ts` contains **no colour values at
  all**, only token references.
- **White-label branding now actually reaches the UI.** `Organization.branding`
  has been editable since Milestone 16 but had never affected a pixel. A new
  `BrandingProvider` injects a tenant stylesheet, so a configured colour flows
  to buttons, links, focus rings, the sidebar's active item, badges, progress
  fills and chart series — in both themes.
- **Accessibility is derived, not assumed.** `lib/branding/color.ts` moves every
  derived role until it clears WCAG AA: button text 4.5:1 on its fill, pill text
  4.5:1 on its own tint, and in dark mode the fill itself 3:1 against the
  surface. A near-white, near-black or desaturated brand colour is nudged into a
  usable band instead of rendering an invisible button. **43 new unit tests**
  assert this across seven adversarial colours in both modes — one of which
  caught a real defect: a mid-grey fill admits no readable foreground at all.
- **`accentColor`/`secondaryColor` write their own token family**, not
  `--accent`/`--secondary`, which are neutral hover surfaces — branding those
  turns every dropdown hover into an unreadable saturated block.
- **Status colour is centralised and deliberately not brandable.**
  `<StatusBadge>` maps ~120 status strings across twenty domain vocabularies to
  five meanings, ending the era of "Cancelled" being grey in Pharmacy and red in
  Billing.
- **Tables rebuilt**: sticky headers that actually work (scroll now belongs to
  the shell's `<main>`; the old wrapper could never scroll), two densities,
  selection as a first-class row state, keyboard-reachable hover actions,
  pinned columns, and a docked bulk-action bar that does not shift rows when it
  appears.
- **New primitives**: `PageLayout`, `PageHeader`, `Breadcrumb`, `SectionHeader`,
  `StatCard`, `EmptyState` (empty vs. filtered-empty vs. error, plus `EmptyValue`
  — a missing measurement renders as an em dash, never `0`), `Skeleton`/
  `TableSkeleton`/`StatCardSkeleton`, `FilterBar`, `SearchInput`,
  `BulkActionBar`, `Timeline`, `ActivityFeed`, `EntityCell`, `StackedCell`,
  `Sheet` (drawer), `Progress`, `Kbd`, and `useChartTheme`.
- **Sidebar rebuilt**: collapsible with a persisted preference and tooltips when
  collapsed, nested disclosure groups that auto-open on the route they own,
  tenant logo and display name, permission-filtered quick-create, and an active
  indicator that does not rely on colour alone.
- **Top bar rebuilt**: hospital selector, global ⌘K palette (now searching
  patients, pages **and** create actions from one shared nav config), tasks, AI,
  notifications, a light/dark toggle, and the account menu.
- **Primitives refined onto the tokens**: button (new `soft`/`danger`/`success`
  variants, `loading` state, denser sizes), badge (tinted rather than solid, with
  a non-colour dot), card (16px padding, `text-base` titles, `CardToolbar`),
  input/select (36px, surface-backed), tabs (an underline rail rather than a
  pill tray), dialog/dropdown/tooltip/toast onto a named z-index scale.
- Global focus treatment, `prefers-reduced-motion` handling that also stops
  Radix keyframe animations, and tabular numerals everywhere numbers are
  compared.

**Every pre-V2 export, variant and prop name was preserved**, which is why all
existing pages still build and pass: lint, typecheck, build, **785 API unit
tests, 49 web unit tests (up from 6) and 431 e2e tests across 22 suites** all
green.

**Disclosed gaps, not hidden:** branding reaches only users holding
`organizations.read` (TD-0074 — the endpoint is gated that way and Phase 1 could
not change APIs); the hospital selector remembers a choice but does not yet
filter data, and says so on screen (TD-0075); `/dashboard/settings` is a
pre-existing 404 in the navigation, left behaving exactly as before rather than
silently re-pointed (TD-0076); feature pages have not been migrated to the new
primitives, which is Phase 2 (TD-0077).

### Added
- **Milestone 19 — Production Hardening & Enterprise Readiness (complete):**
  see ADR-0028, ADR-0029, ADR-0030. Stability, security, observability and
  operability — **no new HMS features**, and the audit that opened the
  milestone left most of the existing security and query code alone because it
  was already correct.
  - **19.1 Security.** `@fastify/helmet` with an API-shaped CSP
    (`default-src 'none'`, relaxed for inline script/style **only when Swagger
    is mounted**), HSTS in production, `frameguard: deny`,
    `crossOriginResourcePolicy: same-site`, and
    `Content-Disposition: attachment` on served uploads. `CORS_ORIGINS` accepts
    a list and refuses `*`. New **startup environment validation** that
    **aborts the boot** on an unsafe production setting — the shipped default
    cookie secret, a missing RS256 keypair, no Redis — and *warns without
    aborting* on a log-only SMS driver, an `http://` origin, container-local
    document storage, or AI enabled against a third-party provider (TD-0042).
    Per-endpoint throttling on the seven credential routes via a per-route
    override rather than a second named tier. `TRUST_PROXY`, off by default.
    Constant-time CSRF comparison.
  - **19.2 Performance.** `CacheService` over the existing Redis connection —
    read-through, structurally tenant-scoped, `SCAN`-based invalidation (never
    `KEYS`, which blocks the server for every tenant), and a cache miss rather
    than an error when Redis is down. Applied to notification template
    resolution. Prisma **slow-query logging** above `DB_SLOW_QUERY_MS`,
    carrying the causing request id and the parameterised SQL only — never the
    bound values. **No schema change**: the N+1 shapes were already batched and
    the 205 existing indexes cover the hot filters.
  - **19.3 Background processing.** `BackgroundTaskService` — deliberately not
    a second queue — moved six blocking outbound emails off the request path.
    Registration could previously return 500 because of a mail provider, for an
    account that had in fact been created; appointment confirmations swallowed
    every failure with `.catch(() => undefined)`. Failures are now logged with
    the scheduling request's correlation ids and counted.
  - **19.4 Observability.** `AsyncLocalStorage` request context; one derivation
    rule for the request id shared by Fastify, pino and the middleware; W3C
    `traceparent` propagation; log redaction of `authorization`/`cookie`/
    `x-csrf-token`/`set-cookie`; separate **liveness** (checks nothing
    external, by design) and **readiness** probes at both version-neutral and
    `/v1` paths; and a Prometheus `/api/metrics` endpoint, bearer-authenticated
    and **404 in production when `METRICS_TOKEN` is unset**. No metric carries
    a patient, user or tenant label, and routes are labelled by matched pattern
    rather than URL.
  - **19.5 Deployment.** Graceful shutdown that flips readiness to 503 before
    it stops serving. `docker-compose.prod.yml` gained the `postgres` and
    `redis` services it had always referenced but never defined. nginx gained a
    **real HTTPS server block** — certificates were mounted and 443 published,
    but nothing had ever listened on it. The API image now runs unprivileged.
  - **19.6 CI.** `build` is gated on the test jobs, and a single `CI` job exists
    to require in branch protection.
  - **19.7 Docs.** `docs/operations/`: Deployment, Operations, Monitoring,
    Disaster Recovery, Runbook, Production Checklist, and an annotated
    `production.env.example`.

### Fixed
- The container `HEALTHCHECK` polled `/api/health`, which did not exist — health
  was mounted at `/api/v1/health` only, so every deployment reported unhealthy.
  Probes are now version-neutral **and** versioned.
- `docker-compose.prod.yml` declared `depends_on: [postgres, redis]` against
  services the file never defined, so the production stack could not start.
- `HttpExceptionFilter` echoed the raw inbound `x-request-id` or minted a fresh
  `nanoid`, so the id a user quoted from a failed request matched nothing in the
  logs.
- nginx set security headers without `always`, omitting them from exactly the
  error responses an attacker provokes.
- Appointment confirmation emails swallowed every failure silently.

### Deferred (recorded, not hidden)
- **TD-0070 — there is no backup automation.** The disaster-recovery procedure
  is specified in full; none of it is implemented, because backup scheduling
  belongs to the target infrastructure. A deployment following the guide
  exactly has no backups. Highest-severity gap in the milestone.
- TD-0067 rate limiting is per-process; TD-0068 every instance runs the
  notification worker; TD-0069 trace context is propagated but no OpenTelemetry
  SDK exports spans; TD-0071 a second instance may serve a stale notification
  template for up to 300s; TD-0072 `pnpm format` has never worked (its Prettier
  plugins are not installed), which is why it was not added to CI.

## [Milestone 18 and earlier]

### Added
- **Milestone 18 — Communication & Notification Platform (complete):** see
  ADR-0027. One surface every module notifies through. The
  `notifications` module was an **empty stub** before this milestone; the
  `Notification` table existed but had never been written to.
  - **Checkpoint 18.1 — Notification platform.** `NotificationsService`
    (the single `notify()` entry point — resolves recipients by id or
    role, renders the template, enqueues one delivery per channel, and
    dedupes on an `eventKey` so a duplicated event produces one
    notification), `NotificationTemplateService`,
    `NotificationPreferenceService`, `NotificationHistoryService`,
    `NotificationQueueService`, `NotificationDispatcherService`,
    `NotificationSchedulerService`, plus five channel adapters behind one
    `NotificationChannelProvider` interface. Priorities Critical / High /
    Normal / Low / Silent, with a default channel set per priority.
  - **The delivery table is the queue.** `bullmq` was available and was
    deliberately not used: delivery history must be durable and queryable
    anyway, and two stores would eventually disagree about whether a
    message was sent. A row whose `nextAttemptAt` has elapsed *is* a
    queued job; claiming is a compare-and-set, so concurrent workers
    cannot double-send.
  - **Checkpoint 18.2 — Browser push (FCM).** FCM HTTP v1 spoken directly
    with a `node:crypto`-signed service-account JWT (no `firebase-admin`),
    per-token fan-out with automatic deactivation of tokens FCM reports
    unregistered, a `UserDevice` registry supporting several devices per
    user (idempotent on the token, never returns a token to the client),
    a dependency-free service worker handling `push` and
    `notificationclick` with deep-link routing, and a permission-request
    flow. **The browser cannot mint an FCM token in this deployment** (no
    Firebase SDK, no project) — this is reported explicitly everywhere it
    matters and never faked (TD-0058).
  - **Checkpoint 18.3 — Notification centre.** A real bell replacing the
    scaffold's static dot, plus a full centre: unread / read / archived /
    pinned / critical, search, category filter, pagination, mark read,
    mark all read, pin, archive, delete, and a day-grouped timeline.
  - **Checkpoint 18.4 — Event integration.** Twenty handlers over events
    the modules **already emitted** — appointments (booked / confirmed /
    cancelled, plus a reminder scheduled at booking time and cancelled
    with the appointment), EMR, laboratory (a critical abnormal flag
    escalates the notification to `CRITICAL` priority), radiology,
    billing, insurance, pharmacy, inventory, IPD, staff, reports and
    platform. No clinical, billing or inventory business logic was
    touched; four events that genuinely did not exist were added as one
    `emit` line each.
  - **Checkpoint 18.5 — Preferences.** Preferred channels, quiet hours
    (IANA-zone, midnight-wrapping), email frequency, and per-category
    mute plus per-category channel selection. **`CRITICAL` bypasses all of
    it** — a critical result reaching nobody because it was 23:00 is not
    an acceptable failure mode — and the preferences page says so.
  - **Checkpoint 18.6 — Admin consoles.** Organization: templates
    (bundled defaults plus append-only versioned overrides, with preview
    and roll-back), history, failed deliveries with per-channel reasons,
    retry, scheduled sends with cancel, and delivery statistics. Platform
    Owner: cross-tenant analytics, per-organization usage, queue
    monitoring and provider configuration, behind `PlatformGuard` plus
    new `platform.notifications.*` permissions.
  - New `notifications` permissions (`read` / `send` / `manage`) gate the
    **org-wide** console only; a user's own centre, preferences and
    devices are deliberately ungated, exactly as `/auth/me` is.
  - New schema (all additive): `NotificationCategory`,
    `NotificationPriority`, `NotificationDeliveryStatus`,
    `EmailDigestFrequency`, `DevicePlatform` enums; an extended
    `Notification` model; and `NotificationDelivery`,
    `NotificationTemplate`, `NotificationPreference` and `UserDevice`.

### Fixed
- **TD-0053 resolved — scheduled reports are now dispatched.** Milestone
  17 persisted and cron-validated `SavedReport.scheduleEnabled` /
  `scheduleCron` / `scheduleRecipients` with nothing reading them.
  `ScheduledReportsDispatcher` now runs the report through the existing
  registry, exports it through the same `ReportExportService` the
  on-screen button uses, emails every recipient, and raises a
  `SCHEDULED_REPORT_READY` notification to the report's owner. It hangs
  off the notification worker's `notifications.tick` rather than
  introducing a second scheduler, and claims each run by compare-and-set
  on `lastRunAt` so overlapping ticks cannot double-send. A new
  dependency-free `cron-match.util.ts` does the matching, bounded so a
  long outage replays at most one day of missed runs.

### Changed
- `NotificationChannel` moved from `packages/types/src/enums.ts` to the
  new `packages/types/src/notification.ts` alongside the rest of the
  platform's vocabulary. Both are re-exported from the package root, so
  no import path changed.
- The header's notification bell is now functional rather than
  decorative.

### Added
- **Milestone 17 — Reports & Analytics (complete):** see ADR-0026. A
  read-only projection layer over the eleven modules that already own the
  data — it writes to exactly one new table (`SavedReport`) and
  re-implements no business rule.
  - **Checkpoint 17.1 — Operational reports.** Eleven report services,
    one endpoint each under `GET /reports/*`: Patients (daily
    registrations, active/new/returning, age + gender distribution),
    Appointments (daily volume, doctor utilisation against real
    `DoctorSchedule` availability, no-show and walk-in analysis),
    Doctors (OPD/IPD load, consultations, follow-up ratio, orders
    raised), Laboratory (volume, pending, turnaround, revenue by test),
    Radiology (investigations, pending reports, modality mix, machine
    load), Pharmacy (dispensed volume, top medicines, low-stock,
    expiring/expired), Inventory (consumption from the movement ledger,
    purchase trends, vendor performance, stock valuation), Billing
    (invoiced revenue *and* collections kept separate, outstanding
    ageing, discounts, refunds, per-slab GST), Insurance (claims,
    settlement ratio, approval time, payer performance), IPD
    (admissions, average stay, live and bed-days occupancy, per-ward
    breakdown), Staff (attendance, overtime via the rostered-shift rule,
    leave trends, department strength).
  - **Checkpoint 17.2 — Executive dashboards.** CEO, Medical Director,
    Operations, Finance and Department dashboards, each with KPIs
    (period-over-period change), trend charts, comparisons and filters —
    composed from the 17.1 services, not re-queried.
  - **Checkpoint 17.3 — Report builder.** A registry of 23 runnable
    reports driving one generic run endpoint, saved reports (private or
    shared, storing the filters and never the results), and CSV / Excel /
    PDF export through a single code path. Excel is a genuine OOXML
    workbook from a dependency-free ~150-line writer over `node:zlib`.
    Scheduled reports are a **disclosed placeholder** — persisted and
    cron-validated, dispatched by nothing (TD-0053).
  - **Checkpoint 17.4 — Frontend.** `/dashboard/reports` (dashboards),
    `/dashboard/reports/operational` (per-module) and
    `/dashboard/reports/builder`, with line, bar, pie, area and heatmap
    charts on the pre-existing `recharts` dependency. The dormant
    `reports.read`-gated sidebar link now resolves to a real page.
  - Honest gaps recorded as **TD-0051 … TD-0057** — notably: appointment
    "waiting time" is a scheduling delay because no arrival timestamp
    exists (TD-0051), radiology machine "utilisation" is relative load
    with no capacity model (TD-0052), and lab revenue-by-test is an
    evenly-allocated figure because the laboratory module raises no
    charges and has no per-test price (TD-0055).
  - Verification: `pnpm lint`, `typecheck`, `test`, `test:e2e` and
    `build` all pass — **663 API unit tests** (+48) and **378 e2e tests
    across 20 suites** (+43). Not browser-verified, by instruction.

- **Milestone 3 — Patient Management (complete):** see ADR-0024. AI
  development (Milestone 15) was explicitly paused after Checkpoint
  15.1; this closes the last three unchecked deliverables on the
  pre-existing (unaudited) Patient module — CRUD, UHID generation,
  search, timeline, documents, emergency contacts, and duplicate
  *detection* already existed and were already tested.
  - Family linkage — link/unlink a patient under a head of family
    (`Patient.headOfFamilyId`, one level deep by design), view the
    resolved family group from either the head or a member.
  - Patient merge — merge a confirmed duplicate into a survivor;
    reassigns every other module's `patientId` column (16 models) plus
    any family dependents inside one transaction, then soft-deletes
    the source with a new `mergedIntoId` pointer. `restore()` now
    refuses a merged record.
  - CSV import — bulk-register patients from an uploaded CSV (up to
    500 rows), reusing the same validation/UHID-generation/phone-
    conflict path as a manual registration; per-row success/failure
    report, no fabricated rows on a bad file.
  - New `patients.manage` permission gating merge and CSV import
    (admin-only by default, mirrors `billing.manage`).
  - Frontend: a "Family" tab and a "Merge" dialog on the patient detail
    page; an "Import CSV" dialog on the patient list page.
  - 20 new API unit tests (578 total) + 4 new e2e tests (299 total,
    18 suites); lint/typecheck/test/build all clean. Not browser-
    verified — explicit instruction this session (no Playwright, no
    screenshots).
- **Milestone 14 — Staff & Attendance (complete):** see ADR-0022 for
  the full design (scope, schema, RBAC). Non-doctor staff only —
  doctors keep their existing dedicated scheduling/leave system.
  - Staff directory — employment records (employment type/status,
    reporting hierarchy, department/hospital), documents, onboarding
    with a real provisioned login (reuses `StaffOnboardingService`).
  - Shift catalog + weekly/rotating/night shift roster (per staff, per
    date), with a bulk staff-assignment action.
  - Attendance — clock in/out with server-derived Present/Late/
    Half-Day/Week-Off, manual marking, corrections, a monthly
    calendar, and a dashboard.
  - Leave management — per-org leave-type quotas, apply/approve/
    reject/cancel, a computed leave balance, and a holiday calendar.
  - Payroll Preparation — attendance/leave/overtime summary and a CSV
    export (no pay-run processing — explicitly out of scope).
  - Staff Dashboard — headcount, attendance, leave, and shift-coverage
    stats.
  - RBAC: `staff`/`staff.documents`/`attendance`/`leave`/`shifts`/
    `shifts.roster`, with genuine own-scope self-service for every
    non-doctor role.
  - Frontend: `/dashboard/staff` (dashboard), `/directory`,
    `/[staffId]` (profile), `/shifts`, `/roster`, `/attendance`,
    `/leave`, `/payroll` — 7 routes, reusing the pre-existing dormant
    sidebar "Staff" link unchanged.
  - 513 API unit / 278 e2e tests passing; lint/typecheck/build clean.
    Not browser-verified this session (TD-0036, explicit instruction).
- **Milestone 13 — General Inventory (complete):** see ADR-0020 (backend
  design, recorded retroactively) and ADR-0021 (frontend decisions).
  Backend landed in commit `e7f4abb`; frontend built across two
  sessions (2026-08-05 Checkpoint 1, then this session).
  - Inventory Dashboard (12 stat tiles) linking to every sub-page.
  - Item Master — searchable/filterable/paginated catalog table plus a
    create/edit dialog; Categories & Lookups — tabbed CRUD for the five
    item-master lookup tables.
  - Stores — CRUD + a per-store manager-assignment dialog.
  - Stock — levels (filters, opening stock, adjust, reorder/min/max
    levels) and Transfers (create/dispatch/receive/cancel) as tabs on
    one page.
  - Vendors — CRUD + a star-rating dialog.
  - The procurement chain: Purchase Requests (submit/approve/reject/
    cancel) → Purchase Orders (create ad hoc or from an approved
    request via a `?fromPr=` deep link; submit/approve/send/cancel) →
    Goods Receipt (create against a Sent PO via a `?fromPo=` deep link,
    per-item batch/expiry entry; complete updates stock) → Vendor
    Invoices (create, record payment, verify/dispute).
  - Store Requisitions — create, approve/reject, issue/receive
    (partial-fulfillment-capable), cancel.
  - Stock Audits — create (snapshots current stock), start, record
    per-item counts, complete (applies variances to stock), cancel.
  - Assets & Maintenance — register/edit an asset, assign to a
    user/department/store, log and complete maintenance records.

### Fixed
- **`GET /api/v1/doctors/stats/dashboard` returned 500 on every call**,
  breaking the main Dashboard's Total/Active Doctors tiles. The demo
  seed wrote `DoctorScheduleDay.shifts` with `start`/`end` keys while
  the whole application reads the canonical `startTime`/`endTime`
  (`ScheduleShiftSchema`), so `toMinutes(shift.startTime)` threw
  `Cannot read properties of undefined (reading 'split')`. `shifts` is
  an untyped `Json` column and the seed cast its literal straight to
  `Prisma.InputJsonValue`, so nothing — not TypeScript, not Prisma —
  caught the mismatch. The seed now parses the literal through
  `ScheduleShiftSchema` before writing, which fails the seed loudly on
  any future drift; `@medicore/types` added as a `devDependency` of
  `@medicore/database` for it. Re-running `pnpm db:seed:demo` repairs
  already-seeded databases. The same bad data was silently breaking
  every other schedule read (`/availability`, `/availability/today`,
  slot generation) — all verified working after the fix. See TD-0040.
- Sidebar's Inventory nav item was gated on a nonexistent permission
  (`inventory.read`), making it unreachable for every role. Corrected
  to `inventory.items.read` (Checkpoint 1).
- Four backend test spec files (`assets`/`purchase-orders`/
  `requisitions`/`stock.service.spec.ts`) failed `pnpm lint`'s
  `require-await` rule (`jest.fn(async (cb) => cb(prisma))` with no
  `await` inside) — removed the unnecessary `async`, no behavior
  change.

### Added
- **Demo-data seed (`pnpm db:seed:demo`) — developer tooling, not a
  milestone.** `prisma/seed.ts` deliberately creates no clinical data
  ("No fake patients were created"), which left every module's UI empty
  on a fresh database. A second, additive seed now layers a realistic
  working dataset on top of it, scoped to the `demo-hospital`
  organization:
  - `prisma/seed-demo.ts` (orchestrator) plus `prisma/demo/`:
    `helpers.ts` (deterministic LCG PRNG, date offsets, shared document
    numbering, and the clinical computations the services perform —
    BMI, Morse fall-risk banding, Braden banding, Charge Engine line
    maths, lab abnormal flagging), `reference-data.ts` (static
    catalogs), `reset.ts` (FK-ordered wipe), and the `foundation.ts` /
    `clinical.ts` / `ipd.ts` / `inventory.ts` seeders.
  - Seeds 7 further doctors (8 total) with weekly schedules and leave,
    48 patients, the lab/radiology/service/drug catalogs, 6 wards →
    rooms → 67 beds, 4 insurers with plans and per-patient coverage,
    ~235 appointments spanning the last 30 and next 14 days, ~156
    completed OPD encounters with notes/vitals/diagnoses/procedures,
    prescriptions, lab and radiology orders, dispensing, charges →
    invoices → payments/refunds, insurance pre-auths and claims, 24
    admissions (14 current) with nursing/MAR/discharge documentation,
    and the full inventory chain (item master, multi-store stock with
    batches, PR → PO → GRN → vendor invoice, requisitions, transfers,
    33 serialised assets with maintenance history, stock audits).
  - Document numbers match the API's own generators exactly
    (`APT-MED-2026-000001`, `PO-2026-000001`, …); statuses are spread
    across each state machine so queues, dashboards and filters have
    real rows; and money, stock and clinical values are internally
    consistent rather than arbitrary.
  - Re-runnable and deterministic: it wipes what it created first, and
    the PRNG is fixed-seed, so the same dataset comes back each run.
- **Milestone 12, Checkpoint 12.2 — Nursing, Medication Administration
  & Discharge (complete):** see ADR-0019. **Milestone 12 is now fully
  complete.**
  - Nursing documentation (`GET/POST /ipd/admissions/:id/nursing-notes|
    nursing-assessments|intake-output`) — notes (general/shift-
    handover/assessment/incident + an escalation flag), assessments
    (pain score, fall risk + server-derived level, Braden score +
    server-derived pressure-ulcer level, GCS eye/verbal/motor + a
    server-computed total), and an intake/output chart with
    server-computed total intake/output/balance.
  - IPD Orders (`GET/POST /ipd/admissions/:id/orders`, `PATCH .../:id/
    discontinue`) — diet/fluid/activity/oxygen/isolation, doctor-placed.
  - Nursing Tasks (`GET/POST /ipd/admissions/:id/nursing-tasks`,
    org-wide queue at `GET /ipd/nursing-tasks`, `PATCH /ipd/
    nursing-tasks/:id/status`) — optionally spawned from an order.
  - Medication Administration Record (`GET /ipd/admissions/:id/mar`,
    `POST .../generate-scheduled|ad-hoc`, `PATCH .../:id/administer|
    missed|refused|held|delayed`) — scheduled/PRN/STAT doses against a
    `PrescriptionItem`, barcode-ready fields, a required nurse
    signature on every action.
  - Discharge workflow (`POST /ipd/admissions/:id/discharge/approve|
    complete`, `GET/PATCH .../discharge/checklist(/:itemKey)`,
    `GET/PUT .../discharge/summary`, `GET .../discharge/summary/pdf`) —
    doctor approval seeds an 8-item nursing checklist; finalize
    requires the checklist complete + a summary with a final
    diagnosis, then vacates the bed, raises a real per-stay room
    `Charge` (`days-stayed × Room.chargesPerDay` via the existing
    Charge Engine — closes TD-0030), closes the linked encounter, and
    sets `AdmissionStatus.DISCHARGED`. A structured, system-generated
    discharge-summary PDF is downloadable once finalized.
  - IPD dashboard (`GET /ipd/dashboard`) gained real `inpatients`/
    `occupancyPercent`/`pendingDischarge`/`pendingNursingTasks` stats.
  - Frontend: four new tabs on the Admission Detail page (Nursing,
    Orders & Tasks, MAR, Discharge), `/dashboard/ipd/discharges`
    (pending/discharged queue), `/dashboard/nursing` (dashboard),
    `/dashboard/nursing/tasks` (org-wide queue), `/dashboard/nursing/
    patients` (patient census). New "Nursing" sidebar nav item.
  - RBAC: `ipd.nursing`/`ipd.orders`/`ipd.tasks`/`ipd.mar` (all-scope),
    `ipd.discharge` split into `create`/`update`/`manage`.
  - Deferred, disclosed, not faked: no per-nurse ward-assignment model
    (TD noted in-page); discharge RBAC is all-scope, not doctor-
    own-scoped (TD-0032); MAR's barcode-ready fields have no real
    scanner hardware (TD-0033).
- **Milestone 12, Checkpoint 12.1 — IPD Admission, Wards & Bed
  Management (complete):** see ADR-0018.
  - Ward/Room/Bed inventory CRUD (`GET/POST/PATCH/DELETE
    /ipd/wards|rooms|beds`) — floor/block/type/status for wards,
    capacity/charges-per-day for rooms, a 6-state bed status machine
    (`AVAILABLE`/`RESERVED`/`OCCUPIED`/`CLEANING`/`MAINTENANCE`/
    `BLOCKED`); `DELETE` soft-deactivates, blocked for an `OCCUPIED`
    bed.
  - Admission workflow (`GET/POST/PATCH /ipd/admissions`, `.../:id/
    cancel`) — Emergency/Scheduled/Insurance/Transfer-from-OPD via one
    code path; auto-creates a fresh IPD encounter or reuses a
    passed-in one; sequential `ADM-<prefix>-<year>-<seq>` numbering.
  - Bed Allocation workflow (`POST /ipd/admissions/:id/allocate|
    reserve|cancel-reservation|vacate|transfer`, `GET .../allocations|
    transfers`) — full audit + transfer history; a vacated/
    transferred-from bed lands in `CLEANING`, not `AVAILABLE`.
  - IPD dashboard (`GET /ipd/dashboard`) — available/occupied beds,
    ICU occupancy, admissions/transfers today, and a discharges-today
    stat that's real but always 0 this checkpoint (discharge is
    Checkpoint 12.2).
  - Frontend: `/dashboard/ipd` (dashboard), `/dashboard/ipd/wards`,
    `/dashboard/ipd/rooms`, `/dashboard/ipd/beds` (color-coded bed
    grid), `/dashboard/ipd/admissions` (queue + 5-step Admit Patient
    wizard), `/dashboard/ipd/[admissionId]` (allocation/transfer
    actions + merged history timeline). Sidebar's dormant "Wards &
    Beds" item replaced with "IPD & Beds". New Patient "Admissions"
    tab (current admission + history, encounter link).
  - RBAC: `ipd.wards`/`ipd.rooms`/`ipd.beds`/`ipd.transfer`
    (all-scope), `ipd.admissions` (own-scope-capable, mirrors
    `medical_records`/`prescriptions`).
  - Deferred, disclosed, not faked: Nursing Notes, Medication
    Administration, Discharge Summary (Checkpoint 12.2 by
    instruction); IPD billing integration deferred alongside
    discharge (TD-0030); ward/room deactivation doesn't check for
    occupied beds inside it (TD-0031).
- **Milestone 11 — Insurance Management (complete):** see ADR-0016.
  - Insurance Provider management (`GET/POST /insurance/providers`,
    `PATCH /insurance/providers/:id`) — Insurance Company/TPA/Corporate,
    org-scoped, unique code.
  - Insurance Plan management (`GET/POST /insurance/plans`, `PATCH
    /insurance/plans/:id`) — coverage %/co-pay %/deductible/annual
    limit/per-visit limit/network type, per provider.
  - Per-patient coverage (`GET/POST /insurance/patients/:patientId/
    coverages`, `PATCH .../:id`) — primary/secondary, member ID/policy
    number/effective+expiry dates; one active coverage per type
    enforced at the application layer.
  - Cashless/TPA pre-authorization workflow (`POST /insurance/preauth`,
    `.../:id/submit`, `.../review`, `.../decide`, `.../cancel`,
    `.../attachments`) — Draft → Submitted → Under Review → Approved/
    Partially Approved/Rejected/Cancelled, clinical notes + file
    attachments via the existing `StorageService`.
  - Claims workflow plus settlement (`POST /insurance/claims`, `.../
    submit`, `.../review`, `.../decide`, `.../settle`, `.../close`,
    `.../documents`) — Draft → Submitted → Under Review → Approved/
    Partially Approved/Rejected → Settled/Partially Settled → Closed;
    settling a claim records a real `Payment` (`paymentMode:
    INSURANCE`) against the linked invoice via the existing
    `PaymentsService`.
  - Automatic claim-document attachment — Invoice, Prescription, Lab
    Report, and Radiology Report PDFs are auto-attached by reusing each
    module's existing PDF generator, plus a new Encounter Summary
    generator; manual uploads also supported. A generator failure is
    logged and skipped rather than blocking claim creation.
  - Insurance dashboard (`GET /insurance/dashboard-stats` — today's
    claims, pending approval, rejected, settled, insurance revenue,
    outstanding claims).
  - All-scope RBAC split into `insurance.providers`/`plans`/`claims`/
    `preauth`/`settlement` (the last gated `.manage`-only, mirroring
    `billing.manage`'s requester/approver separation), audit-trail
    integration.
  - Frontend: an Insurance dashboard, Providers/Plans list pages,
    a Pre-Authorization queue, a Claims queue, a claim detail page
    (settlement/timeline/documents), a real Patient Insurance tab, and
    a new Encounter Insurance tab.
- **Milestone 10 — Billing (complete):** narrowed to Billing only per
  explicit instruction — Insurance carved out to its own Milestone 11
  (see ADR-0015).
  - Charge Engine (`GET/POST /billing/charges`, `POST
    /billing/charges/:id/void`) — the reusable entity any clinical
    module (or a manual cashier action) bills a patient through, via a
    `sourceModule`/`sourceId` pair rather than a hard FK.
  - Service catalog with pricing (`GET/POST /billing/catalog`, `PATCH
    /billing/catalog/:id`), org-scoped.
  - Invoice creation (`POST /billing/invoices`) from manual line items
    and/or by sweeping a patient's existing pending charges; manual
    line-item addition to a draft (`POST /billing/invoices/:id/items`).
  - Discount management — flat or percentage, with an approval workflow
    (`POST /billing/invoices/:id/discount`, `.../discount/approve`,
    `.../discount/reject`) — a `billing.manage` holder's request is
    auto-approved, anyone else's lands pending.
  - GST-compliant invoicing — per-item and invoice-level tax breakdown,
    reusing `Organization.settings.gstRate`.
  - Multiple payment modes (cash, card, UPI, bank transfer/NEFT/RTGS,
    cheque) via `POST /billing/invoices/:id/payments` — split and
    partial payments both work by calling it more than once.
  - Refunds — partial or full (`POST /billing/invoices/:id/refunds`,
    `.../refunds/:id/approve`, `.../reject`), same approval-workflow
    shape as discounts.
  - Invoice and payment-receipt PDF generation (`GET
    /billing/invoices/:id/pdf`, `GET /billing/payments/:id/receipt/pdf`)
    — hospital branding, itemized GST breakdown, a disclosed QR
    placeholder (no payment gateway is configured in this repo).
  - Auto-invoice generation from a completed appointment — a
    consultation charge priced from the doctor's consultation fee,
    swept into a new draft invoice.
  - Revenue dashboard (`GET /billing/dashboard-stats` — today's revenue,
    pending invoices, outstanding balance, refunds today, pending
    discount/refund approvals, 7-day collection trend).
  - All-scope RBAC on `billing.*` (staff-facing, no doctor own-scope),
    pagination/filtering, audit-trail integration.
  - Frontend: a Billing dashboard, an Invoices list + create dialog +
    detail page (discount/payment/refund actions, PDF download), a
    Payments list, and a Refunds list.
- **Milestone 9 — Pharmacy Management (complete):** reordered ahead of
  Billing & Insurance per explicit instruction — see ADR-0014.
  - Drug catalog, org-scoped (`GET/POST /pharmacy/catalog`, `PATCH
    /pharmacy/catalog/:id`, `POST /pharmacy/catalog/:id/adjust-stock`) —
    one row per batch (generic/brand name, strength, dosage form,
    manufacturer, batch number, expiry, price, tax, active,
    current/reserved/available stock, minimum stock, reorder level).
    Replaces the unused `Medication` model from the original scaffolding
    commit.
  - Dispensing workflow (`POST /pharmacy/dispense` from a prescription,
    `.../prepare` batch selection, `.../ready`, `.../dispense-partial`,
    `.../dispense-complete`, `.../reject`, `.../cancel`) — full
    `PENDING → PREPARING → READY → DISPENSED` state machine plus
    `CANCELLED`/`RETURNED`. Completing a dispense reuses
    `PrescriptionsService.updateStatus` to mark the source prescription
    `COMPLETED`.
  - Medicine returns (`POST/GET /pharmacy/dispense/:id/returns`) —
    restocks the drug and moves the order to `RETURNED`, fully audited.
  - Dashboard stats (`GET /pharmacy/dispense/dashboard-stats` — pending,
    ready, dispensed today, low stock, expiring medicines).
  - All-scope RBAC on the `pharmacy.*` permission resource (staff-facing,
    like billing/insurance — no doctor own-scope), pagination/filtering/
    sorting, audit-trail integration.
  - Frontend: a Pharmacy dashboard, drug catalog management page, a
    dispensing queue with a "New dispense" picker, a dispense detail page
    (batch selection, workflow actions, returns), a stock page (low-stock/
    expiring filters, inline stock adjustment), and a "Dispense" button on
    an encounter's Prescriptions tab.
- **Milestone 8 — Radiology Management (complete):**
  - Radiology catalog, org-scoped (`GET/POST /radiology/catalog`,
    `PATCH /radiology/catalog/:id`) — name/code/category/modality/body
    part/contrast-required/price/estimated-duration.
  - Radiology order creation from an encounter (`POST /radiology`),
    catalog-sourced or ad hoc. Order numbers follow
    `RAD-<orgPrefix>-<year>-NNNNNN`. Full status state machine
    (`ORDERED → SCHEDULED → IN_PROGRESS → COMPLETED → REPORTED`,
    `CANCELLED` from any non-terminal state, `REJECTED` from `ORDERED`).
  - Scheduling (`POST /radiology/:id/schedule`) — appointment date/time,
    room, machine, technician, radiologist, duration; supports
    rescheduling.
  - Versioned radiology reports (clinical indication, technique,
    findings, impression, recommendations) with a sequential
    verify → release workflow (`POST /radiology/:id/reports`,
    `.../reports/verify`, `.../reports/release`) — release requires
    verification first.
  - Image/external/DICOM-placeholder attachments (`POST
    /radiology/:id/attachments/file`, `.../attachments/external`) — real
    file uploads for images/PDFs via `StorageService`, metadata-only
    references (accession number / external URL / study instance UID)
    for imaging held in an outside PACS. No real PACS/DICOM integration
    exists — this is the designed extension point for one.
  - A structured, system-generated PDF report (`GET
    /radiology/:id/report/pdf`, `pdfkit`) and an independent external
    report-file upload path (`POST /radiology/:id/report-file`).
  - Dashboard stats (`GET /radiology/dashboard-stats` — today's studies,
    pending reporting, completed, cancelled, urgent).
  - Own/all-scope RBAC on the `radiology.*` permission resource (Doctor
    is own-scoped; a new Radiology Technician role and Nurse remain
    all-scope), audit-trail integration.
  - Frontend: a Radiology dashboard, an org-wide orders queue, a catalog
    management page, an order detail page (Scheduling/Report/Attachments
    tabs), a Radiology tab on the encounter detail page, and a "Recent
    imaging" panel on the patient timeline.
  - AI-powered image interpretation and real PACS/DICOM server
    integration are explicitly out of scope by instruction (see
    TECH_DEBT TD-0019), not faked.
- **Milestone 7 — Laboratory Management (complete):**
  - Lab test catalog, org-scoped (`GET/POST /laboratory/catalog`,
    `PATCH /laboratory/catalog/:id`) — supports numeric reference ranges,
    text reference ranges (for qualitative tests), or both, plus optional
    explicit critical thresholds.
  - Lab order creation from an encounter (`POST /laboratory`), each item
    either picked from the catalog (auto-populating name/code/category/
    reference range) or entered ad hoc. Order numbers follow
    `LAB-<orgPrefix>-<year>-NNNNNN`.
  - Sample collection tracking (`POST /laboratory/:id/collect-sample`)
    and a full status state machine (`ORDERED → SAMPLE_COLLECTED →
    IN_PROGRESS → COMPLETED → REPORTED`, `CANCELLED` from any non-terminal
    state).
  - Structured, per-item result entry (`POST /laboratory/:id/results`)
    with server-computed abnormal-value flagging (HIGH/LOW/CRITICAL_HIGH/
    CRITICAL_LOW) — numeric results are auto-flagged against the item's
    reference range (with a disclosed, documented critical-threshold
    rule); qualitative results are never auto-flagged and instead support
    a manual override.
  - Two independent report paths: an uploaded external report file
    (`POST /laboratory/:id/report`, any lab-tech-sourced PDF/image) and a
    structured, system-generated PDF (`GET /laboratory/:id/report/pdf`,
    `pdfkit`) built directly from the order's own result data.
  - Own/all-scope RBAC on the `laboratory.*` permission resource (Doctor
    is own-scoped; Lab Technician/Nurse remain all-scope), audit-trail
    integration.
  - Frontend: a Lab Orders tab on the encounter detail page, a "Recent lab
    orders" panel on the patient timeline, and a new `/dashboard/laboratory`
    org-wide queue page with a catalog-management dialog.
  - AI-powered lab report summarization explicitly deferred
    (credential-blocked — no AI/LLM provider is configured anywhere in
    this repo; see TECH_DEBT TD-0018) rather than faked.
  - Recorded ADR-0012 for the catalog schema shape, the `LabTest.encounterId`
    addition, and the own-scope decision for the Doctor role.
- **Milestone 6, Checkpoint 6.2 — Orders & Prescriptions (complete); Milestone 6 fully complete:**
  - Prescription CRUD from an encounter (`POST/GET /prescriptions`,
    `GET /prescriptions/:id`), reusing the pre-existing `Prescription`/
    `PrescriptionItem` Prisma models from the original scaffolding commit.
    `Prescription.status` converted to a proper `PrescriptionStatus` enum
    (`ACTIVE`/`COMPLETED`/`DISCONTINUED`) to match the rest of the
    codebase's status-field convention.
  - Basic, bundled drug-interaction warnings (non-blocking, explicitly
    labeled "basic, non-exhaustive") checked across a new prescription's
    items and the patient's other active prescriptions.
  - Prescription PDF generation and download (`GET /prescriptions/:id/pdf`,
    `pdfkit`).
  - Own/all-scope RBAC on the existing `prescriptions.*` permission
    resource, audit-trail integration.
  - Self-caught fix: the `Doctor` role in `seed.ts` was never granted
    `medical_records.update`/`prescriptions.update` at own scope — a real
    doctor login could not transition their own encounter or prescription
    status. Fixed in `seed.ts`.
  - Frontend: a Prescriptions tab on the encounter detail page (multi-item
    prescribe form, interaction warnings, PDF download, status actions)
    and a "Recent prescriptions" panel on the patient timeline list page.
  - Recorded ADR-0010 for the reuse/enum-conversion/interaction-check/PDF
    decisions.
- **Milestone 6, Checkpoint 6.1 — Electronic Medical Records (EMR Foundation) (complete):**
  - `Encounter` replaces the flat `MedicalRecord` scaffold as the central
    per-consultation entity (OPD/Teleconsultation/Follow-up/Emergency/
    Walk-in type; In Progress → Completed → Amended status state machine).
  - Append-only, versioned Clinical Notes (`POST /encounters/:id/clinical-notes`
    always inserts a new version — historical notes are never overwritten)
    covering chief complaint, HPI, past medical/family/surgical/social
    history, allergies, and current medications.
  - Vitals with server-computed BMI and a cross-encounter trend query
    (`GET /vitals?patientId=`), Diagnoses (primary/secondary/differential +
    an ICD-10 placeholder field), Procedures, and Attachments (reuses the
    existing `StorageService` exactly like patient/doctor documents).
  - Full REST + Swagger + RBAC (own/all-scope) + audit-trail integration +
    pagination/filtering on the encounter list endpoint.
  - Frontend: `/dashboard/medical-records` (patient timeline: filterable
    encounter list + weight-trend chart + new-encounter dialog) and
    `/dashboard/medical-records/[encounterId]` (SOAP-style tabs — Subjective:
    clinical notes editor with debounced autosave + version history;
    Objective: vitals form + BMI trend chart + attachments; Assessment:
    diagnoses; Plan: procedures).
  - Recorded ADR-0008 (`Encounter` schema design) and ADR-0009 (Milestone 6
    split into Checkpoint 6.1/6.2, mirroring the Milestone 4/5 pattern).
  - Prescriptions/orders explicitly deferred to Checkpoint 6.2.
- **Milestone 5 — Appointment Management: fully complete** (Checkpoint 5.1
  + 5.2; SMS confirmations explicitly deferred — credential-blocked):
  - Walk-in booking (`POST /appointments/walk-in`) — auto-assigns the
    doctor's next available slot today, no time picker needed.
  - Recurring appointments (`POST /appointments/recurring`) — books N
    weekly/daily occurrences sharing one group id; a conflicting occurrence
    is reported, not silently dropped.
  - Frontend: walk-in quick-book dialog, a "Recurring booking" toggle in
    the booking dialog, and Walk-in/Recurring badges in the queue.
  - `docs/roadmap.md` reconciled: "Appointment Management" is now the
    roadmap's actual Milestone 5 (previously an unnumbered "deferred"
    section), with every subsequent milestone renumbered accordingly.
- **Milestone 5, Checkpoint 5.1 — Appointment Core Booking (complete):**
  - Conflict-aware appointment booking (`POST /appointments`) — combines
    the existing schedule/leave availability engine with a check against
    existing bookings, generates a unique appointment number, and emails a
    confirmation to the patient.
  - Full appointment status state machine (scheduled → confirmed → arrived
    → in-consultation → completed, with cancel/no-show from any non-terminal
    state), enforced server-side.
  - `GET /appointments/available-slots`, `GET /appointments`,
    `GET /appointments/:id`.
  - Frontend: a day-view appointments queue with filters and inline status
    actions, and a booking dialog with live slot selection.
  - Doctor audit timelines (from Checkpoint 4.2) now include appointment
    activity.
- **Milestone 4, Checkpoint 4.2 — Doctor Scheduling (complete):**
  - Weekly, versioned doctor schedules (`DoctorSchedule`/`DoctorScheduleDay`),
    leave management (`DoctorLeave`, apply/approve/reject/cancel), and an
    availability engine (bookable slots + today-status) combining schedule
    and approved leave (`apps/api/src/modules/scheduling/`).
  - Dashboard availability stats (`availableToday`/`onLeaveToday`
    /`offDutyToday`/`upcomingLeave`) added to `GET /doctors/stats/dashboard`.
  - Doctor documents — upload/list/delete (`DoctorDocument` model,
    `GET/POST /doctors/:doctorId/documents`,
    `DELETE .../documents/:documentId`), reusing the existing global
    `StorageService`.
  - Per-doctor audit timeline (`GET /doctors/:id/audit-timeline`), reusing
    the existing `AuditLog`/`AuditService` — no new capture mechanism.
  - Full frontend: 5 new tabs (Schedule, Leave, Availability, Documents,
    Audit) on the doctor profile page, backed by a new
    `apps/web/src/lib/api/scheduling.ts` client.
  - Unit + e2e tests for all of the above; browser-verified end to end
    against the local dev servers with screenshots under `docs/screens/`.
- **Milestone 4, Checkpoint 4.1 — Doctor Management** (backend + frontend
  already existed from a prior undocumented session; this session verified,
  fixed, and closed it out):
  - `Doctor` CRUD, professional profile, search/filters, dashboard stats,
    `/doctors/me` self-profile lookup (`apps/api/src/modules/doctors/`).
  - Linked-user onboarding via the generic, role-agnostic
    `StaffOnboardingService` (`apps/api/src/common/onboarding/`), reused by
    future staff modules (Nurse, Pharmacist, Lab Technician, Receptionist).
  - Frontend: doctors list (search/filters/sort/bulk-deactivate/stats),
    multi-step registration form with draft recovery, doctor profile page
    (editable profile + live clinical-record statistics).
  - `docs/modules/04-doctor-management.md`.
- `CLAUDE.md` project constitution at repo root, establishing mandatory
  startup workflow, documentation rules, and definition of done for all
  future Claude Code sessions.
- `.ai/` project memory directory: `PROJECT_CONTEXT.md`, `PROGRESS.md`,
  `NEXT.md`, `DECISIONS.md`, `TECH_DEBT.md`, `SESSION_LOG.md`,
  `MODULE_STATUS.md`, `CHANGELOG.md`.

### Fixed
- `apps/api/src/modules/doctors/doctors.controller.ts`: import-order lint
  violation.
- `apps/web/src/app/dashboard/doctors/[id]/page.tsx`: unescaped apostrophe
  (`react/no-unescaped-entities`).
- `apps/api/test/doctors.e2e-spec.ts`: one assertion expected `201` from
  `POST /auth/login`, which by design returns `200` (`@HttpCode(HttpStatus.OK)`
  in `auth.controller.ts`) — corrected to `200`.

### Changed
- `docs/roadmap.md`: Milestone 4 retitled "Doctor Management & Scheduling"
  and split into Checkpoint 4.1 (done) / 4.2 (next); original appointment-
  booking deliverables moved to "Deferred beyond Milestone 4." See ADR-0005.

---

## [0.1.0] — Initial monorepo setup

### Added
- Monorepo scaffolding (pnpm + Turborepo) with `apps/api` (NestJS) and
  `apps/web` (Next.js), plus shared `packages/{config,database,types,ui}`.
- Backend domain modules scaffolded: auth, users, roles, organizations,
  hospitals, departments, staff, patients, appointments, medical-records,
  prescriptions, laboratory, radiology, pharmacy, inventory, billing,
  insurance, notifications, audit, ai, health.
- Common backend infra: JWT auth guard, permissions guard/service, CSRF
  guard, audit listener/service, email module, Redis module.
- CI workflow, Docker Compose (dev + prod), commitlint + Husky hooks.

## 2026-08-05 — Milestone 15, Checkpoint 15.1: AI Clinical Assistant

### Added — AI platform layer (`apps/api/src/common/ai/`)

- **Provider abstraction** over four real vendors behind one
  `AiProviderAdapter` interface, selected by config — mirrors
  `StorageService`'s driver pattern (ADR-0023):
  - `OpenAiProvider` — `POST {base}/chat/completions`, SSE streaming
    with `stream_options.include_usage`.
  - `AnthropicProvider` — `POST {base}/messages`, lifts the system
    prompt to the top-level `system` field, joins `message_start`
    input tokens with `message_delta` output tokens when streaming.
  - `GeminiProvider` — `generateContent`/`streamGenerateContent`,
    `systemInstruction` mapping, assistant→`model` role rename, API
    key sent as a header so it never lands in an access log.
  - `OllamaProvider` — self-hosted, no API key, newline-delimited JSON
    stream rather than SSE.
- `AiClientService` — the only thing domain modules inject. Owns
  feature flags, exponential-backoff retry over retryable failures
  only, request timeouts, token accounting, cost derivation, and
  provider-error → HTTP mapping that never echoes raw provider text.
- `ai.config.ts` — config-driven provider/model/limits/retry/costs.
  Treats placeholder credentials (`sk-xxxxxxxxxxxx`) as **absent**.

### Added — AI domain layer (`apps/api/src/modules/ai/`)

- Seven clinical generators over data the repo already stores: **SOAP
  Note**, **Clinical Note Summarization**, **Lab Result
  Summarization**, **Radiology Report Summarization**, **Prescription
  Explanation**, **Discharge Summary**, **Referral Letter**.
- `ClinicalContextService` — read-only prompt-context assembly reusing
  the existing EMR, Laboratory, Radiology, Prescriptions and IPD
  modules (current clinical-note version only, lab flags repeated from
  the laboratory module rather than recomputed, radiology summarization
  refused when no report has been released).
- Prompt templates — bundled defaults (shared clinical guardrails:
  use only supplied context, never invent findings, draft for
  clinician review) plus org-scoped, append-only versioned overrides.
- `POST /ai/generate` and `POST /ai/generate/stream` (SSE over POST,
  bypassing the response envelope), `GET /ai/status`,
  `GET /ai/conversations[/:id]`, `GET /ai/usage[/summary]`,
  and prompt-template read/create-version/activate endpoints.
- Conversation logging (`AiConversation`/`AiMessage`), usage +
  token accounting (`AiUsageLog`, including **failed** dispatches), and
  audit integration that records the metadata without copying
  generated clinical text into the audit row.

### Added — Schema

Migration `20260804231008_ai_clinical_assistant`: `AiConversation`,
`AiMessage`, `AiUsageLog`, `AiPromptTemplate`, plus the
`AiProviderType`/`AiFeature`/`AiMessageRole`/`AiRequestStatus` enums.

### Added — RBAC

New `ai` resource (`read`/`generate`/`manage`) and `ai.templates`
(`read`/`manage`). `ai.read`/`ai.generate` are own-scope capable —
Doctor is own-scoped (own patients only), Nurse is all-scope, and
org-wide usage reporting is `ai.manage`-gated.

### Added — Frontend

- `apps/web/src/components/ai/` — a streaming `AiAssistDialog` (live
  deltas, editable draft, copy, stop, regenerate, disclaimer, token/
  latency/attempt metadata) and a permission-gated `AiAssistButton`.
- `/dashboard/ai` — Assistant / Conversations / Usage tabs plus a
  provider-status card, with a new `ai.read`-gated sidebar item.
- "AI SOAP note" and "AI summary" on the Encounter detail header;
  "AI draft" on the IPD Discharge tab, which drafts into the hospital-
  course field for the clinician to edit (never auto-saved).

### Not delivered — disclosed, not faked

No AI provider credential exists in this environment, so every
generation endpoint returns **503 with an explicit reason** and no
clinical text is produced (**TD-0041**). PHI is sent to a third-party
provider with no BAA by default; `AI_INCLUDE_PATIENT_IDENTIFIERS=false`
and self-hosted Ollama are the two built-in mitigations (**TD-0042**).

### Verification

`pnpm lint`, `pnpm typecheck`, `pnpm test` (558 unit, 75 suites),
`pnpm build` all green. E2E: 18 AI e2e tests pass; the full serial
suite's one pre-existing `doctor-documents` failure was confirmed
against a pristine HEAD worktree and is unrelated to this work.

## Milestone 16 — Platform & Multi-Tenant Administration (2026-08-05)

MediCore becomes a SaaS platform: multiple organizations, each with multiple
hospitals, administered by an isolated platform-owner console. See ADR-0025.

### Added
- **Organization Dashboard** (`/dashboard/organization`) with eight tabs:
  Overview, Hospitals, Users, Subscription, Usage, Branding, Settings,
  Audit Logs.
- **Platform Owner console** (`/platform`) — its own isolated route group and
  layout: Overview, Organizations, Hospitals, Audit log, Search.
- **Hospital onboarding wizard** — one transactional call creating a hospital,
  its departments, and optionally its administrator (reuses
  `StaffOnboardingService`). Plus hospital **activation** to match the
  existing deactivation.
- **Tenant lifecycle** — suspend (reason required), reinstate, enable/disable.
  Suspension reuses `Organization.isActive`, which auth already enforces.
- **`Subscription` model** — one per organization: plan, status, four
  nullable limits, price. Read by the tenant, written only by the platform
  owner.
- **Usage metering** — `ApiUsageService` (Redis, rolling 30-day window) and
  `StorageUsageService` (sums `fileSizeBytes` across five models). AI usage
  reports real `AiUsageLog` data.
- **Organization settings** — branding/theme/logo, address, tax, contact,
  timezone, currency, language, working hours, feature flags; holidays reuse
  Milestone 14's `Holiday` calendar.
- **Tenant context** — `resolveTenantContext`/`@Tenant()` resolve
  Platform / Organization / Hospital from the existing JWT; `PlatformGuard`
  isolates the console.
- **Audit log filtering + pagination**, org-scoped and cross-tenant.
- 49 new API unit tests, 36 new e2e tests.

### Changed
- `JwtPayload` and `AuthenticatedUser` gained a required `isPlatform` field.
- `JwtStrategy.validate` now re-checks platform membership against the
  database on every request.
- `RolesService.createDefaultOrgAdminRole` and `seed.ts`'s Hospital Admin
  role no longer grant the `platform.*` permission family.
- `docs/roadmap.md` renumbered: Reports & Analytics 16→17, Notifications
  17→18, Production Hardening 18→19.

### Fixed
- `doctor-documents.e2e-spec.ts` upserted `doctors.read.all` but granted its
  Doctor role `doctors.read.own`, so the suite passed only against a
  pre-seeded database. Now self-sufficient.
- `.ai/NEXT.md` documented the local test containers as ports 5434/6381; they
  are `medicore_postgres` on 5432 and `medicore_redis` on 6379.

### Known limitations (see TECH_DEBT TD-0044 … TD-0050)
- Not browser-verified (by instruction).
- No platform organization *detail* page, though its endpoints exist.
- API metering does not survive a Redis flush and is not a billing ledger.
- Storage usage reflects recorded sizes, not actual bucket contents.
- No payment gateway; subscription limits are reported but **not enforced**.
- Global search excludes patients and clinical records by design.
