# TECH_DEBT.md

> Every deferred feature, known shortcut, and discovered-but-unfixed bug goes
> here. Nothing gets silently dropped. Mark items Resolved (with date) rather
> than deleting them, so the history of what was deferred and why stays
> intact.

Format per entry:

```
## TD-NNNN: <Title>
Opened: YYYY-MM-DD
Status: Open | In Progress | Resolved (YYYY-MM-DD)
Severity: Low | Medium | High

Description: what's deferred/shortcut/broken and why
Impact: what breaks or is at risk if left unaddressed
Resolution plan: how it should eventually be fixed (if known)
```

---

## TD-0001: Module implementation depth unverified

Opened: 2026-07-31
Status: Open
Severity: Medium

**Description:** `MODULE_STATUS.md` currently lists all backend/frontend
modules as unaudited. The single init commit scaffolds directories for every
domain but no session has yet verified line-by-line completeness (tests,
validation, docs) per module.

**Impact:** Completion percentages in `PROJECT_CONTEXT.md` cannot be trusted
until this audit happens; risk of assuming a module is done when it's a
stub.

**Resolution plan:** See `.ai/NEXT.md` — audit each module, update
`MODULE_STATUS.md` with verified state.

---

## TD-0002: CI pipeline not yet verified against current module set

Opened: 2026-07-31
Status: Open
Severity: Medium

**Description:** `.github/workflows/ci.yml` exists but has not been
confirmed to actually run lint/typecheck/test/build cleanly against the
current codebase state as part of this governance setup task.

**Impact:** CI could be green due to skipped/misconfigured steps rather than
genuinely passing checks.

**Resolution plan:** Run `pnpm lint && pnpm typecheck && pnpm test && pnpm
build` locally and compare against what CI actually executes; fix any gap.

---

## TD-0003: No screenshot for Doctor Management milestone

Opened: 2026-07-31
Status: **Resolved (2026-07-31)**
Severity: Low

**Description:** `CLAUDE.md` requires a screenshot under `docs/screens/`
for every completed user-facing milestone. Checkpoint 4.1 (Doctor
Management) is functionally complete and e2e-verified at the API level, but
this and all prior sessions have had no browser/UI access to capture one.

**Impact:** Documentation completeness gap only — no functional risk.

**Resolution:** A later session in this same day obtained browser access
(Playwright + Chromium, installed to a scratch dir — see TD-0010) and
captured `docs/screens/doctors-list.png` and
`docs/screens/doctors-registration-form.png`, linked from
`PROJECT_CONTEXT.md`.

---

## TD-0004: Local dev/e2e environment needs one-time manual setup (documented, not automated)

Opened: 2026-07-31
Status: Open
Severity: Low

**Description:** Running `pnpm test:e2e` locally requires `apps/api/.env`
(not committed, generated from `.env.example`), a generated JWT RSA
keypair (`pnpm --filter @medicore/api keys:generate`), and both the
`medicore_dev` and `medicore_test` Postgres databases to have all
migrations applied (`prisma migrate deploy` against each
`DATABASE_URL`) — the two databases can drift independently, as
`medicore_test` had (see PROGRESS.md 2026-07-31: it was missing the
`20260730220227_doctor_professional_profile` migration, causing every
doctor-related e2e test to fail with a Prisma "column does not exist"
error until applied). None of this is scripted.

**Impact:** Any session starting fresh must rediscover this setup before
e2e tests can run; a schema change applied to `medicore_dev` but not
`medicore_test` (or vice versa) will produce a confusing runtime error that
looks like an application bug rather than a stale test database.

**Resolution plan:** Add an `pnpm db:migrate:test` (or similar) script that
runs `prisma migrate deploy` against `medicore_test`, and document the full
one-time local setup (or automate it) in a root-level dev-setup doc.

**Addendum (2026-07-31):** a long-running `nest start --watch` process left
over from earlier in a session can serve a route from a stale compile —
one new endpoint (`GET /doctors/:id/audit-timeline`) 404'd (at the Fastify
router level, before auth) against an old `pnpm dev` process despite being
correctly implemented and passing all tests; killing port 4000 and
restarting `pnpm dev` fixed it immediately with no code change. If a brand
new endpoint 404s in the dev server despite `pnpm build`/tests passing,
restart the dev server before assuming it's a real bug.

**Addendum (2026-08-01):** running a full `turbo run build --force` (both
`nest build` and `next build`) while a `pnpm dev` instance is still running
for that same app clobbers the running dev process's compiled output in
place — `apps/web`'s `next dev` started serving mismatched dev/production
chunks (RSC payload version-mismatch console errors, 404s on
`_next/static/*`) until its process was killed and restarted with a fresh
`.next`; `apps/api`'s running dev process kept serving its pre-build route
table entirely (new Checkpoint 6.1 routes 404'd) until restarted the same
way. Order of operations that avoids this: run the verification build
*before* starting (or after stopping) any dev server used for the
browser walkthrough, or simply restart both dev servers immediately after
a full build and before driving the browser check. Also observed in this
session (not investigated, out of scope for Checkpoint 6.1 — auth module):
the browser makes a background `POST /api/v1/auth/refresh` on initial page
load that 403s with `FORBIDDEN — Invalid or missing CSRF token`; login
still succeeds immediately after, so it isn't blocking, but it's worth a
look next time the auth module is in scope.

---

## TD-0005: Doctor documents not implemented

Opened: 2026-07-31
Status: **Resolved (2026-07-31)**
Severity: Medium

**Description:** Checkpoint 4.2 (ADR-0005) requires upload/list/delete for a
doctor's own documents (certificates, ID proofs). No `DoctorDocument`
model, migration, service, or controller exists — confirmed by grepping the
`scheduling`/`doctors` modules and `schema.prisma` for any doctor-document
reference.

**Impact:** Checkpoint 4.2 cannot be marked complete until this lands.

**Resolution:** Implemented following the `patients` module's existing
pattern (`PatientDocument` model + `StorageService`), not a new one:
`DoctorDocumentType` enum + `DoctorDocument` model (migration
`20260731152146_doctor_documents`), `doctor-document.service.ts` +
`.controller.ts` in `apps/api/src/modules/scheduling/`
(`GET/POST /doctors/:doctorId/documents`,
`DELETE .../documents/:documentId`), new `doctors.documents` permission
resource (`read`/`manage`, `all`+`own` scope) in `seed.ts`. Unit-tested
(`doctor-document.service.spec.ts`) and e2e-tested
(`doctor-documents.e2e-spec.ts`).

---

## TD-0006: Audit timeline has no per-doctor query surface

Opened: 2026-07-31
Status: **Resolved (2026-07-31)**
Severity: Low

**Description:** `audit.listener.ts` captures and persists all
schedule/leave lifecycle events, but `AuditController`
(`apps/api/src/modules/audit/audit.controller.ts`) only exposes
`GET /audit-logs?limit=` — an org-wide recent list with no `doctorId` or
`resource` filter. There is no way to actually view "a per-doctor timeline
of audit events" as ADR-0005 requires, even though the data exists.

**Impact:** Checkpoint 4.2's audit-timeline deliverable is capture-only, not
user-facing.

**Resolution:** Added `AuditService.listForDoctor(organizationId, doctorId,
limit)` — reuses the existing `AuditLog` table with an `OR` filter (direct
`Doctor` events by `resourceId`, plus `DoctorSchedule`/`DoctorLeave`/
`DoctorDocument` events by a `doctorId` field inside their `after` JSON
payload) and maps to a humanized `{id, title, action, resource,
occurredAt}` shape. Exposed as `GET /doctors/:id/audit-timeline` on the
existing `DoctorsController`, gated behind `doctors.read` with the same
own/all-scope enforcement as the scheduling controllers. `audit.listener.ts`
gained 2 more `@OnEvent` handlers for document upload/delete, mirroring the
existing schedule/leave handlers — no capture logic was duplicated.
Unit-tested (`audit.service.spec.ts`) and e2e-tested (asserts all three
event sources appear correctly, and that another doctor's events are
excluded).

---

## TD-0007: No frontend for Checkpoint 4.2 (schedule/leave/availability/documents)

Opened: 2026-07-31
Status: **Resolved (2026-07-31)**
Severity: Medium

**Description:** All Checkpoint 4.2 backend endpoints (schedule CRUD, leave
workflow, availability, dashboard stats) are implemented and e2e-tested,
but zero frontend UI consumes them. The doctor profile page
(`apps/web/src/app/dashboard/doctors/[id]/page.tsx`) is byte-for-byte
unchanged from Checkpoint 4.1's version — confirmed via `pnpm build`'s
route list, which shows no new routes.

**Impact:** Checkpoint 4.2 is not user-facing yet and cannot be marked
complete per `CLAUDE.md`'s Milestone Completion Checklist (frontend
implemented is a required item). No screenshot can be taken until this
exists (see TD-0003 for the same standing gap on 4.1's screenshot).

**Resolution:** Added 5 tabs (Schedule, Leave, Availability, Documents,
Audit) to `apps/web/src/app/dashboard/doctors/[id]/page.tsx`, reusing the
patients module's `DocumentsTab`/`TimelineTab` patterns near-verbatim and a
new `apps/web/src/lib/api/scheduling.ts` client. Manually verified end to
end in a real browser against the local dev servers and seeded demo
accounts: created a schedule version, applied and approved a leave request,
checked availability, uploaded a document, and confirmed all of it appears
in the audit timeline. Screenshots captured under `docs/screens/`.

---

## TD-0008: Prisma client must be regenerated after schema changes, or lint fails misleadingly

Opened: 2026-07-31
Status: Open
Severity: Low

**Description:** Running `pnpm lint` in a fresh checkout (or after pulling
schema changes) without first running
`pnpm --filter @medicore/database db:generate` produces ~1000
`@typescript-eslint/no-unsafe-*` errors scattered across unrelated files
(`users.service.ts`, `prisma.service.ts`, every Prisma-backed service) —
because every Prisma Client call types as `any`/`error` until the client is
generated against the current schema. This looks like a massive regression
but is purely a stale-generated-artifact issue; running `db:generate`
resolves it immediately with zero code changes.

**Impact:** Wastes significant time misdiagnosing a phantom regression;
could cause a future session to start "fixing" 1000 fake lint errors.

**Resolution plan:** Either add a `postinstall`/pretest hook that runs
`prisma generate` automatically, or at minimum document this explicitly as
step 0 of the session startup checklist alongside the `.env`/JWT-key setup
in TD-0004.

---

## TD-0009: Code comment references ADR-0006, which doesn't exist yet

Opened: 2026-07-31
Status: **Resolved (2026-08-01)**
Severity: Low

**Description:** `apps/api/src/modules/scheduling/availability.service.ts`
has a comment stating appointment-conflict subtraction is deferred to
"Milestone 5's job (see ADR-0006)" — but `DECISIONS.md` only goes up to
ADR-0005. Either the ADR was never written, or the reference is aspirational
placeholder text from whoever wrote the availability engine.

**Impact:** Low — purely a documentation-consistency gap; the underlying
architectural intent (availability engine doesn't know about `Appointment`
records yet) is sound and matches Checkpoint 4.2's scope.

**Resolution:** ADR-0006 was recorded during Milestone 5, Checkpoint 5.1 —
the comment's reference now resolves to something real, and the design it
anticipated (appointments subtract conflicts on top of the unmodified
`AvailabilityService`) is exactly what was built.

**Resolution plan:** When Milestone 5 (appointment booking) is actually
scoped, record that decision as ADR-0006 so the comment's reference resolves
to something real; until then, leave the comment as-is rather than editing
unrelated working code.

---

## TD-0010: No project skill for browser verification; Playwright not a project dependency

Opened: 2026-07-31
Status: Open
Severity: Low

**Description:** Verifying the Checkpoint 4.2 frontend required a real
browser. No project skill or committed tooling exists for this — Playwright
+ Chromium were installed ad hoc into the session's scratch directory
(`npm install playwright@1.62.1` there; Chromium itself was already cached
at `~/Library/Caches/ms-playwright` from a prior session). Nothing was
added to `apps/web`'s own dependencies.

**Impact:** The next session needing a real browser check will have to
rediscover this same setup (or reuse the cache if it survives) rather than
running a documented command.

**Resolution plan:** If browser verification becomes routine, add
`@playwright/test` as a dev dependency of `apps/web` and commit a small
smoke-test script, or generate a project-specific run skill (the `run`
skill's own suggestion) so `chromium-cli`/Playwright setup doesn't need
rediscovering each time.

---

## TD-0011: `seed.ts`'s `role.upsert` never syncs permissions for a role that already exists

Opened: 2026-07-31
Status: **Resolved (2026-08-01)**
Severity: **High**

**Description:** Discovered while browser-verifying Checkpoint 4.2:
logging in as `admin@medicore.demo` against the local `medicore_dev`
database produced 403s on `doctors.read` and every other doctor-related
permission, even though `RESOURCE_ACTIONS`/`ROLE_SPECS` in `seed.ts` clearly
grant the Hospital Admin role every permission. Root cause:
`prisma.role.upsert({ where: {...}, update: {}, create: { ...,
rolePermissions: { create: [...] } } })` — the `update: {}` branch does
**nothing** when a role with that name already exists in that org. The
`demo-hospital` org's `Hospital Admin`/`Doctor` roles were created in an
early session (before the `doctors`, `doctors.schedule`, `doctors.leave`,
`doctors.documents` resources existed) and have never been touched by any
later `pnpm db:seed` run since — every resource/permission added since
Checkpoint 4.1 silently never reached these roles' actual
`RolePermission` rows, no matter how many times `db:seed` is rerun.

**Impact:** Any local dev database seeded before a given resource was added
to `seed.ts` will silently lack that permission for its demo accounts. This
is not cosmetic — it produces confusing 403s that look like application
bugs. This session worked around it by directly granting the missing
`RolePermission` rows to `medicore_dev`'s `Hospital Admin` (+17) and
`Doctor` (+6) roles via a one-off script — a **local data fix only**, not a
code change. `medicore_test` is unaffected (each e2e suite creates a fresh
org via `/auth/register`, which always grants the *current* full
permission catalog to its admin role via
`RolesService.createDefaultOrgAdminRole`).

**Resolution:** Added `syncRolePermissions()` to `seed.ts`, called after
every role upsert (Super Admin + every `ROLE_SPECS` role) — diffs the
role's current `RolePermission` rows against what it should have and adds
whatever's missing, without touching or removing anything already there.
Verified by reproducing the exact bug (deleted one `RolePermission` row,
confirmed a normal `pnpm db:seed` run restored it) rather than just
asserting the fix in the abstract.

---

## TD-0012: Appointment booking has no DB-level protection against a double-booking race

Opened: 2026-08-01
Status: Open
Severity: Medium

**Description:** `AppointmentsService.create` checks for conflicts by
querying existing appointments and computing overlap in application code,
then creates the row in a separate step — there is no Postgres exclusion
constraint or equivalent preventing two concurrent requests from both
passing the conflict check for the same slot before either commits. This
mirrors a pre-existing limitation in `DoctorLeaveService`'s overlap check
(same class of issue, not introduced fresh here).

**Impact:** Low probability in practice (requires two near-simultaneous
booking requests for the exact same doctor+slot), but a genuine correctness
gap — the system's advertised guarantee ("a slot shown as available is
actually bookable") can be violated under concurrent load.

**Resolution plan:** Add a Postgres exclusion constraint on
(doctorId, tstzrange(scheduledAt, scheduledAt + durationMinutes)) via a raw
migration (Prisma doesn't express `EXCLUDE USING gist` natively), or wrap
booking in a `SELECT ... FOR UPDATE`-guarded transaction scoped to the
doctor+date. Worth fixing before this ships to any multi-receptionist
production deployment; not blocking for a single-session demo.

---

## TD-0013: Local `pnpm dev` API server doesn't log request lines the way e2e tests do

Opened: 2026-08-01
Status: Open
Severity: Low

**Description:** While browser-verifying Checkpoint 5.1, the dev API
server's redirected log file (`pnpm dev > file.log 2>&1 &`) contained zero
`"request completed"` lines and zero visible email dev-fallback log lines,
even though the requests demonstrably succeeded (confirmed via the browser
screenshots and via direct `curl` checks). e2e test runs show these lines
reliably. Root cause not investigated — plausibly a log-level or
pino-transport difference between the `test` and `development` NestJS
environments, or a buffering artifact of backgrounding `pnpm dev` with
shell redirection specifically.

**Impact:** Low — purely an observability gap in ad hoc local verification,
not a product defect (the endpoints work; this only affects how easily a
session can tail the dev server's log for confirmation instead of relying
on curl/browser network responses).

**Resolution plan:** If this recurs and blocks debugging, compare
`NODE_ENV`/logger configuration between `apps/api/src/main.ts` (or
wherever Pino/Nest logging is configured) in dev vs test bootstrap, or just
default to checking responses directly (curl/browser) rather than tailing
the dev server's log file.

---

## TD-0014: Recurring appointment series can't be bulk-edited or bulk-cancelled

Opened: 2026-08-01
Status: Open
Severity: Low

**Description:** Per ADR-0007, a recurring booking materializes N
independent `Appointment` rows sharing one `recurrenceGroupId` — there is
no endpoint to act on "the whole series" (e.g. "cancel all remaining
occurrences" or "move every future occurrence to a new time"). Each row
must be updated individually via the existing single-appointment status
endpoint.

**Impact:** Low — a real usability gap for a receptionist managing a
patient's recurring series, but not a correctness issue; the grouping id
already exists to build this on top of later.

**Resolution plan:** Add `GET /appointments?recurrenceGroupId=` (trivial —
`AppointmentQuery` would need one more filter field) for viewing the whole
series, and consider a `PATCH /appointments/recurring/:groupId/cancel-remaining`
(or similar) if/when a real usability need for bulk actions comes up. Not
worth building speculatively ahead of that need.

---

## TD-0015 (tracking only, not a defect): SMS confirmations deferred, credential-blocked

Opened: 2026-08-01
Status: Open — expected to stay open until the user supplies credentials
Severity: N/A (not a bug — an intentionally deferred feature)

**Description:** Milestone 5's original scope (`docs/roadmap.md`) included
SMS appointment confirmations. No SMS provider (Twilio, Fast2SMS, or
otherwise) is configured anywhere in this repo — unlike email, which had
`EmailService`'s existing console-fallback to build on, there is no
equivalent SMS scaffolding to reuse. Per `CLAUDE.md`'s prohibition on
faking clinical/billing/auth logic to "make it work," this was not stubbed
with a fake send.

**Impact:** None currently — email confirmation covers the same product
need for any patient with an email on file. Patients without an email get
no automated confirmation of any kind, which is a real (but pre-existing,
not newly introduced) gap.

**Resolution plan:** Pick up when the user supplies SMS provider
credentials (e.g. `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/
`TWILIO_FROM_NUMBER`, or an equivalent). At that point, mirror
`EmailService`'s structure (a thin service wrapping the provider SDK,
graceful degradation without credentials) rather than designing something
new.

---

## TD-0016: Drug interaction check is a small bundled list, not a real terminology service

Opened: 2026-08-01
Status: Open
Severity: Medium (clinical-safety-adjacent, but explicitly labeled non-authoritative in the UI)

**Description:** Checkpoint 6.2's drug interaction warning
(`apps/api/src/modules/prescriptions/drug-interactions.ts`) matches
medication names against a hardcoded list of ~10 well-known interaction
pairs (warfarin+aspirin, etc.), case-insensitive substring matching. No
real drug-interaction terminology service or dataset is configured
anywhere in this repo. The API response and the frontend both label this
"basic, non-exhaustive" and it never blocks prescribing — per ADR-0010,
this was a deliberate, disclosed simplification rather than a silently
incomplete "real" check.

**Impact:** A prescriber could reasonably (and incorrectly) treat the
absence of a warning as clinical clearance. The frontend explicitly
disclaims this, but the disclaimer's visibility depends on a warning
actually firing at least once for a given session — if no interaction
matches, no disclaimer is shown at all.

**Resolution plan:** Integrate a real drug-interaction data source (e.g.
RxNorm/DDInter or a licensed clinical database) when one becomes
available, or expand the bundled list materially and always render a
persistent "basic check only" notice on the prescriptions tab regardless
of whether a warning fired.

---

## TD-0017: Appointment walk-in e2e test flakes near midnight (schedule fixture caps at 23:45)

Opened: 2026-08-01
Status: Open
Severity: Low

**Description:** `apps/api/test/appointments.e2e-spec.ts`'s "all-hours
doctor" fixture (added in the Milestone 5 session to make walk-in booking
deterministic regardless of real wall-clock time) uses a single shift
`00:00`–`23:45` with 15-minute slots, so the last bookable slot each day
starts at `23:30`. Observed failing with a `409 Conflict` ("no available
slot") when the suite happens to run between ~23:30 and 23:59 local time,
since the walk-in booking logic correctly finds no slot at/after "now"
today. Not related to Checkpoint 6.2 (Prescriptions) — this module was
out of scope for this session per the reading-policy restriction, so it
was documented rather than fixed.

**Impact:** Low — narrow ~30-minute daily window, doesn't affect any other
test or real usage (a real doctor's schedule wouldn't need to cover this
edge case the way a synthetic all-hours fixture does).

**Resolution plan:** Either extend the fixture's shift to wrap past
midnight (if the scheduling engine supports cross-midnight shifts — needs
checking) or change the walk-in test to book against a fixed, injected
"now" rather than real wall-clock time.

---

## TD-0018 (tracking only, not a defect): AI-powered lab report summarization deferred, credential-blocked

Opened: 2026-08-02
Status: Open — expected to stay open until the user supplies credentials
Severity: N/A (not a bug — an intentionally deferred feature)

**Description:** Milestone 7's roadmap scope (`docs/roadmap.md`) included
"AI-powered lab report summarization (async)." No AI/LLM provider is
genuinely configured anywhere in this repo: `apps/api/.env.example` (and
the local `.env`) declare `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`/
`AI_PROVIDER` fields, but both hold only unset placeholder values
(`sk-xxxxxxxxxxxx` / `sk-ant-xxxxxxxxxxxx`), and a repo-wide grep confirms
no code anywhere reads any of these three env vars — they're template
placeholders for a future integration, not a wired credential. Confirmed
`apps/api/src/modules/ai/` remains the same 3-file no-op scaffold (empty
constructors) it was before this session — unlike `EmailService`
(Milestone 5), which had a genuine console-fallback to build on, there is
no equivalent AI scaffolding to extend. Per `CLAUDE.md`'s explicit
prohibition on faking clinical logic to "make it work," this was not
stubbed with a canned/fake summary.

**Impact:** None currently — every other Milestone 7 deliverable (catalog,
order creation, sample collection, structured result entry, abnormal
flagging, both PDF paths) is fully implemented and covers the clinically
load-bearing parts of the workflow. Summarization is a convenience layer
on top of data that's already fully queryable/exportable (structured
items + the generated PDF), so its absence blocks no other functionality.

**Resolution plan:** Pick up once the user supplies LLM provider
credentials (e.g. `ANTHROPIC_API_KEY`). At that point, build it as a
genuinely async job (not an inline request-blocking call): an event
listener on `lab_test.status_changed_to_reported` (or `_completed`)
enqueues a summarization job, the job calls the LLM with the order's
structured `LabTestItem` rows (result/unit/reference range/abnormal
flags) and stores the summary text on the order (a new nullable field,
e.g. `LabTest.aiSummary`), and the frontend polls or re-fetches once
available. Mirrors the general shape of TD-0015 (SMS) and TD-0016 (drug
interactions) — implement for real once genuinely unblocked, don't
retrofit a fake version now.

---

## TD-0019 (tracking only, not a defect): AI-powered radiology image interpretation and PACS/DICOM integration explicitly out of scope

Opened: 2026-08-02
Status: Open — explicitly excluded by instruction, not a gap to fill
Severity: N/A (not a bug — explicitly excluded feature)

**Description:** Milestone 8's instructions explicitly excluded two
things: AI image interpretation and real PACS/DICOM server integration.
Neither is implemented, and neither is faked. The module is designed so
a future PACS integration has a real extension point: `RadiologyAttachment
.type` includes `DICOM_PLACEHOLDER`/`EXTERNAL_IMAGING` (metadata-only —
accession number, external URL, study instance UID — no real file or
DICOM parsing), and `RadiologyOrder`'s scheduling/report fields are
plain columns a PACS webhook or worklist integration could populate
without a schema change.

**Impact:** None — these were never in scope for this session. Recorded
here only so a future session (or the user) has one place documenting
that the exclusion was deliberate, not an oversight, and what shape the
integration point is in.

**Resolution plan:** When/if the user wants real PACS/DICOM connectivity
or AI-assisted image interpretation, treat both as genuinely new,
credential/infrastructure-blocked features (same practice as TD-0015
SMS, TD-0018 AI lab summarization) — do not stub either with fake
output.

---

## TD-0020: Radiology scheduling has no technician picker UI (raw user ID only)

Opened: 2026-08-02
Status: Open
Severity: Low

**Description:** `RadiologyOrder.technicianUserId` is a plain `String`
(no FK, matching the `LabTest.sampleCollectedBy`-style "actor" convention
— ADR-0008 point 5), settable via the `POST /radiology/:id/schedule` API,
but the frontend Scheduling tab has no input for it at all — there is no
staff-directory/user-lookup endpoint anywhere in this codebase yet (not
for lab technicians, not for any other staff type) for the frontend to
populate a picker from. The Radiologist field *does* have a picker
(reuses the existing `listDoctors` endpoint, since a radiologist is
modeled as a `Doctor` by specialization).

**Impact:** Low — a receptionist/radiology-technician role can still
process orders end to end (schedule/start/complete/report) without ever
setting `technicianUserId`; it's an optional metadata field, not
load-bearing for any status transition or permission check.

**Resolution plan:** Add a generic "list users by role" (or
per-organization staff directory) endpoint if/when one becomes needed
for multiple modules (this same gap would block a technician picker for
Laboratory too, which has the identical `sampleCollectedBy` shape) —
not worth building a one-off endpoint for this single field.

---

## TD-0021: Drug stock reservation/deduction has no DB-level protection against a race

Opened: 2026-08-03
Status: Open
Severity: Medium

**Description:** `DispenseService`'s batch-selection (reserve),
partial/complete dispense (convert reserved → deducted), and cancel/
reject (release reservation) all read `Drug.currentStock`/`reservedStock`
and write back within an application-level `$transaction`, but there is
no Postgres row lock (`SELECT ... FOR UPDATE`) or exclusion constraint
preventing two concurrent dispense orders from both reserving against
the same batch's available stock before either commits — the same class
of gap already open and documented for appointment booking (**TD-0012**)
and `DoctorLeaveService`'s overlap check, not a new pattern introduced
here.

**Impact:** Low probability in practice (requires two pharmacists
preparing different orders against the same batch at the exact same
moment), but a genuine correctness gap — `Drug.reservedStock` could
theoretically exceed what's truly available under concurrent load.

**Resolution plan:** Add a `SELECT ... FOR UPDATE`-guarded read of the
`Drug` row inside `prepareItems`/`dispensePartial`/`dispenseComplete`'s
transactions, or a raw constraint ensuring `reservedStock <= currentStock`
at the database level. Worth fixing before multi-pharmacist concurrent
production use; not blocking for this milestone.

---

## TD-0022: `DrugQuery.lowStockOnly` filters in application code, not in the database query

Opened: 2026-08-03
Status: Open
Severity: Low

**Description:** "Low stock" means `currentStock <= reorderLevel` — a
comparison between two columns on the same row, which Prisma's query
builder cannot express in a `where` filter without a raw query.
`DrugCatalogService.list` works around this by fetching every drug
matching the other filters for the org and filtering/paginating in
JavaScript when `lowStockOnly` is set, instead of paginating at the
database level like every other query path in this codebase.

**Impact:** Low today — a single organization's drug catalog (one row
per batch) is not large enough for this to be a real performance
problem — but it doesn't scale the way DB-level pagination does, and is
an inconsistent pattern versus the rest of the codebase's query methods.

**Resolution plan:** Replace with a `Prisma.$queryRaw` (or a raw SQL
filter fragment: `WHERE "current_stock" <= "reorder_level"`) if/when a
single org's catalog grows large enough for this to matter.

---

## TD-0024: Billing has no standalone Service Catalog or Charges admin UI

Opened: 2026-08-03
Status: Open
Severity: Low

**Description:** `ServiceCatalogService`/`ChargesService` are fully
implemented and REST-exposed (`GET/POST /billing/catalog`, `PATCH
/billing/catalog/:id`, `GET/POST /billing/charges`, `POST
/billing/charges/:id/void`), but no frontend page manages them directly
— the invoice-creation dialog is the only UI surface that touches
catalog items (implicitly, via a charge's denormalized fields) and
existing pending charges (via the sweep checklist). There is no page to
browse/deactivate catalog items or raise/void an ad-hoc charge outside
the context of building an invoice.

**Impact:** Low — every roadmap-required frontend surface (billing
workbench: invoices, payments, refunds) is implemented; catalog/charge
management is reachable only through the API (Swagger) or indirectly
through invoice creation, not a dedicated admin screen.

**Resolution plan:** Add a `/dashboard/billing/catalog` management page
(mirrors `/dashboard/radiology/catalog`'s pattern exactly) if/when
catalog upkeep becomes a real workflow need, rather than building it
speculatively now.

---

## TD-0025: Billing has no DB-level protection against concurrent-write races

Opened: 2026-08-03
Status: Open
Severity: Medium

**Description:** `InvoicesService`/`PaymentsService`/`RefundsService` all
read an `Invoice` row, compute new totals/paid-amount/balance in
application code, then write back within a `$transaction` — but nothing
prevents two concurrent requests (e.g. two cashiers recording a payment
against the same invoice at the same instant) from both reading the
pre-update balance before either commits. The same class of gap already
open and accepted for appointment booking (TD-0012) and pharmacy stock
reservation (TD-0021), not a new pattern introduced here.

**Impact:** Low probability in practice (requires two near-simultaneous
writes against the same invoice), but a genuine correctness gap —
`paidAmount`/`balanceDue` could theoretically be computed from stale
data under concurrent load.

**Resolution plan:** Add a `SELECT ... FOR UPDATE`-guarded read of the
`Invoice` row inside the payment/discount/refund transactions, or an
optimistic-concurrency version column, if this becomes a real issue
under multi-cashier concurrent load. Not blocking for this milestone.

---

## TD-0026: Invoice `OVERDUE` status is never automatically set

Opened: 2026-08-03
Status: Open
Severity: Low

**Description:** `InvoiceStatus.OVERDUE` exists in the schema (from the
original scaffolding commit) and `Invoice.dueDate` is a real, settable
field, but nothing in this session transitions an invoice's status to
`OVERDUE` when its due date passes with a balance still owing — doing so
would require a scheduled job, and no cron/scheduler infrastructure
exists anywhere in this repo (the same "no cron infra" gap noted for
`NotificationType.APPOINTMENT_REMINDER` and every other
would-be-scheduled feature in this codebase).

**Impact:** Low — `balanceDue` and `dueDate` are both real and queryable
today (the frontend could compute "is this overdue" client-side from
those two fields), just not reflected in the persisted `status` column
or filterable via `status=OVERDUE`.

**Resolution plan:** Pick up once this repo has any scheduled-job
infrastructure (a recurring job scanning `ISSUED`/`PARTIALLY_PAID`
invoices past `dueDate`) — don't bolt on a one-off cron for this single
feature ahead of that.

---

## TD-0027 (tracking only, not a defect): Invoice/receipt QR is a disclosed placeholder, not a real payment gateway

Opened: 2026-08-03
Status: Open — expected to stay open until the user supplies a payment-gateway/UPI integration
Severity: N/A (not a bug — an intentionally deferred feature)

**Description:** Milestone 10's roadmap scope named a receipt/invoice QR
code. No UPI/payment-gateway credentials or merchant VPA are configured
anywhere in this repo. Per `CLAUDE.md`'s prohibition on faking
billing logic to "make it work," both PDF generators (`billing-invoice-
pdf.ts`, `billing-receipt-pdf.ts`) render a labeled bordered placeholder
box instead of a real scannable code — see ADR-0015 point 9.

**Impact:** None currently — every other Milestone 10 deliverable
(invoicing, discounts, taxes, multi-mode payments, refunds) is fully
implemented and functional without it.

**Resolution plan:** Pick up once the user supplies a real payment
gateway/UPI merchant integration. At that point, generate an actual UPI
deep-link QR (e.g. via a `qrcode` npm package) encoding the invoice/
payment reference, mirroring the general shape of TD-0015 (SMS)/
TD-0018 (AI summarization)/TD-0019 (PACS) — implement for real once
genuinely unblocked, don't retrofit a fake one now.

---

## TD-0023 (tracking only, not a defect): Completing a dispense best-effort-completes the source prescription

Opened: 2026-08-03
Status: Open
Severity: Low

**Description:** `DispenseService.dispenseComplete` calls
`PrescriptionsService.updateStatus(..., { status: COMPLETED })` after its
own transaction commits, swallowing any error
(`.catch(() => undefined)`) rather than failing the whole dispense — the
same "separate service calls, no distributed transaction" pattern already
used throughout this codebase (e.g. `EncountersService`/
`RadiologyOrdersService`), not a new gap. In the extremely unlikely case
this call fails (e.g. the prescription was independently discontinued in
the same instant), the `DispenseOrder` ends up `DISPENSED` while its
`Prescription` stays `ACTIVE` — a minor, self-correcting inconsistency
(the prescription can still be manually marked `COMPLETED`/
`DISCONTINUED` from the encounter page).

**Impact:** None observed; a real but narrow edge case with a manual
recovery path already in the UI.

**Resolution plan:** Not planned — acceptable given the same pattern is
already relied on elsewhere in this codebase. Revisit only if this
proves to happen in practice.

---

## TD-0028: Encounter Insurance tab's "File claim" form asks for the invoice ID as free text

Opened: 2026-08-04
Status: Open
Severity: Low (UX friction, not a correctness issue)

**Description:** Filing an insurance claim requires an `invoiceId`
(`InsuranceClaimsService.create`), but no endpoint resolves "the
invoice for this encounter" — `InvoicesService.list` filters by
`patientId`/`status`/`type`/date range, not `encounterId`, even though
`Invoice.encounterId` exists as a column (added in Milestone 10). The
Encounter Insurance tab's "File claim" dialog (`apps/web/src/app/
dashboard/medical-records/[encounterId]/page.tsx`, `FileClaimDialog`)
therefore asks staff to paste the invoice ID manually rather than
picking it from a list, with a hint pointing them at the Billing
module.

**Impact:** Low — staff can still file a claim, just with one extra
manual step (copying the invoice ID from Billing). No functional
claims-workflow gap.

**Resolution plan:** Add an `encounterId` filter to
`InvoicesController`'s list endpoint (mirrors the existing `patientId`
filter), then have `FileClaimDialog` fetch and offer a select instead
of a free-text field. Small, low-risk change — deferred only because it
touches the Billing module and this session's reading policy scoped
Billing changes to reuse-as-is.

---

## TD-0029: Claim detail page's "Timeline" is synthesized from lifecycle timestamps, not a real audit-trail feed

Opened: 2026-08-04
Status: Open
Severity: Low (cosmetic/completeness gap, not a data-loss issue)

**Description:** The Patient detail page has a dedicated Timeline/Audit
tab backed by a real per-patient event feed (`PatientTimelineEntry`,
`GET /patients/:id/timeline`). No equivalent per-claim (or per-pre-
authorization) audit feed exists, even though every claim/pre-auth
lifecycle transition already emits an `@OnEvent` and is recorded via
`AuditService` (see `audit.listener.ts`'s 12 new `insurance.*`
handlers added this milestone) — the audit rows exist in the database,
there's just no endpoint that filters them by `resourceId`/`resource:
'InsuranceClaim'` for a single claim. The claim detail page's
"Timeline" panel is a client-side list built from the claim's own
`createdAt`/`submittedAt`/`settledAt`/`closedAt` columns instead —
correct as far as it goes, but it can't show intermediate transitions
(e.g. "Under Review" has no timestamp column) or who performed each
action.

**Impact:** Low — the settlement panel and status badge already carry
the information that matters for day-to-day use; the timeline gap is a
"nice to have," not a workflow blocker.

**Resolution plan:** Add a generic `GET /audit-logs?resource=X&
resourceId=Y` filter (or a per-claim `GET /insurance/claims/:id/audit`
convenience endpoint) and swap the claim detail page's synthesized
timeline for the real feed. Natural follow-up once a second module
wants the same per-resource audit view — not deferred for a hard
blocker, just not built preemptively for one caller.

---

## TD-0030 (tracking only, not a defect): IPD billing integration and discharge are Checkpoint 12.2, not built this session

Opened: 2026-08-04
Status: **Resolved (2026-08-04)** — closed by Checkpoint 12.2 (see ADR-0019):
`DischargeService.complete` computes `days-stayed × Room.chargesPerDay`
(elapsed time from `admittedAt`, rounded up to the next whole day,
minimum 1) into a real `Charge` row (`sourceModule: IPD`, `sourceId:
admission.id`) at discharge finalize, and `AdmissionStatus.DISCHARGED`
is now genuinely reachable via the approve → checklist → summary →
complete workflow.
Severity: N/A (explicitly out of scope by instruction, not a gap in what was asked)

**Description:** `docs/roadmap.md`'s Milestone 12 goal names "IPD billing
integration — a stay's charges accumulate the same way [as the Charge
Engine]," but Checkpoint 12.1's instructions explicitly excluded
Nursing Notes, Medication Administration, and Discharge Summary,
reserving them for 12.2 — and the only sensible trigger point for a
per-day room/bed charge is discharge (days-stayed × `Room.
chargesPerDay`), which doesn't exist yet. `AdmissionStatus.DISCHARGED`/
`ABSCONDED` exist in the schema (per ADR-0018) but nothing in this
checkpoint's API ever sets them — only `ADMITTED` (on create) and
`CANCELLED` (the same-stay "opened in error" cancel action) are
reachable. This mirrors `InvoiceStatus.OVERDUE` (TD-0026) — an enum
value with no trigger built yet, not a fake implementation.

**Impact:** None for 12.1's actual deliverables (ward/room/bed
inventory, admission, bed allocation/transfer/reserve/vacate, dashboard
— all fully implemented, tested, and browser-verified). A stay
currently accrues no billing charges regardless of length.

**Resolution plan:** Build in Checkpoint 12.2 alongside Discharge
Summary — on discharge, compute `days-stayed × Room.chargesPerDay` (and
any other per-stay charges) into the existing Charge Engine
(`sourceModule: 'ipd'`, `sourceId: admission.id`), mirroring how
Milestone 10 left ad-hoc `Charge` creation manual/event-driven rather
than inventing a mid-stay charge to hit this checkpoint's scope.

---

## TD-0031: Deactivating a Ward or Room doesn't check for occupied beds inside it

Opened: 2026-08-04
Status: Open
Severity: Low

**Description:** `BedsService.deactivate` correctly blocks deactivating
an `OCCUPIED` bed (`ConflictException`). `WardsService.deactivate` and
`RoomsService.deactivate` don't have the equivalent guard — an admin
holding `ipd.wards.delete`/`ipd.rooms.delete` could set a ward or room
to `INACTIVE` while one or more of its beds still show a live
`ADMITTED` patient in `Admission.bedId`. Deactivating the ward/room
doesn't cascade any change to the beds or admissions themselves (the
bed keeps its own `OCCUPIED` status and the admission is unaffected),
so no data is lost or silently changed — this is a missing *prevention*
check, not a correctness bug in what already happened.

**Impact:** Low — an inactive ward/room with a live patient inside is
confusing in the UI (it'd disappear from the default `status=ACTIVE`-
filtered lists staff use day to day) but not unsafe; the admission and
bed records remain fully queryable and correct.

**Resolution plan:** Add the same `occupiedBedCount > 0` (or a direct
`Bed.status: 'OCCUPIED'` query) guard `BedsService.deactivate` already
has, to `WardsService.deactivate`/`RoomsService.deactivate`, throwing a
`ConflictException` naming how many beds are still occupied. Small,
mechanical follow-up — flagged now rather than fixed opportunistically
mid-checkpoint since it isn't exercised by anything this checkpoint's
UI does (nothing deactivates a ward/room with a live admission in the
verified flow).

---

## TD-0032: Nursing/MAR/discharge sub-resources are all all-scope, including for the Doctor role

Opened: 2026-08-04
Status: Open
Severity: Low

**Description:** `ipd.nursing`/`ipd.orders`/`ipd.tasks`/`ipd.mar`/
`ipd.discharge` are all-scope only (see ADR-0019) — mirroring `ipd.
beds`/`ipd.transfer`'s precedent rather than `ipd.admissions`' own-scope
carve-out (ADR-0018). A doctor holding `ipd.discharge.create`/`.manage`
can approve or finalize discharge for *any* admission, not only ones
where they're the attending physician, unlike `ipd.admissions.update`
which is own-scope-checked via `AdmissionsService.assertOwnScopeOk`.

**Impact:** Low in this repo's threat model — every demo/seeded role is
trusted staff within one organization, and the same gap already exists
for `ipd.transfer` (any nurse can transfer any patient) without having
caused an issue. A doctor approving discharge for a colleague's patient
while covering a shift is also a legitimate real-world scenario, not
purely a bug.

**Resolution plan:** If a future session wants doctor-scoped discharge
approval, generalize `AdmissionsService.assertOwnScopeOk` to accept a
resource name parameter (currently hardcoded to `ipd.admissions`) and
call it from `DischargeController`/`IpdOrdersController` before
approve/create actions, mirroring the existing pattern exactly.

---

## TD-0033: MAR's barcode-ready fields have no real scanner/hardware integration

Opened: 2026-08-04
Status: Open — explicitly disclosed, not a gap
Severity: N/A (no barcode scanner hardware exists in this environment)

**Description:** `MedicationAdministration.barcodeVerified`/
`scannedCode` are the schema/API hook for a "barcode-ready
architecture" (per `docs/roadmap.md`'s Checkpoint 12.2 deliverables) —
the `administer` endpoint accepts and stores a scanned code and a
verified flag, and the MAR tab has a "Barcode scanned/verified"
checkbox + code field. No physical barcode scanner, camera-based
scanning, or medication/patient wristband barcode format is wired up —
a nurse manually types the code (or leaves it unchecked) exactly as
`radiology`'s DICOM-placeholder precedent (TECH_DEBT for Milestone 8)
disclosed the same shape of gap.

**Impact:** None for anything this checkpoint claims — the
architecture point (a real scan integration could POST into the same
field without a schema change) is real; there is no fake scanning
happening.

**Resolution plan:** Wire a real barcode-scanning flow (camera-based
web scanning library, or hardware scanner emitting keyboard input into
the `scannedCode` field) if/when barcode hardware becomes available to
test against — no code changes needed on the backend.
