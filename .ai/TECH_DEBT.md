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

**Resolution plan:** See `.ai/NEXT.md` - audit each module, update
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

**Impact:** Documentation completeness gap only - no functional risk.

**Resolution:** A later session in this same day obtained browser access
(Playwright + Chromium, installed to a scratch dir - see TD-0010) and
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
`DATABASE_URL`) - the two databases can drift independently, as
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
over from earlier in a session can serve a route from a stale compile -
one new endpoint (`GET /doctors/:id/audit-timeline`) 404'd (at the Fastify
router level, before auth) against an old `pnpm dev` process despite being
correctly implemented and passing all tests; killing port 4000 and
restarting `pnpm dev` fixed it immediately with no code change. If a brand
new endpoint 404s in the dev server despite `pnpm build`/tests passing,
restart the dev server before assuming it's a real bug.

**Addendum (2026-08-01):** running a full `turbo run build --force` (both
`nest build` and `next build`) while a `pnpm dev` instance is still running
for that same app clobbers the running dev process's compiled output in
place - `apps/web`'s `next dev` started serving mismatched dev/production
chunks (RSC payload version-mismatch console errors, 404s on
`_next/static/*`) until its process was killed and restarted with a fresh
`.next`; `apps/api`'s running dev process kept serving its pre-build route
table entirely (new Checkpoint 6.1 routes 404'd) until restarted the same
way. Order of operations that avoids this: run the verification build
*before* starting (or after stopping) any dev server used for the
browser walkthrough, or simply restart both dev servers immediately after
a full build and before driving the browser check. Also observed in this
session (not investigated, out of scope for Checkpoint 6.1 - auth module):
the browser makes a background `POST /api/v1/auth/refresh` on initial page
load that 403s with `FORBIDDEN - Invalid or missing CSRF token`; login
still succeeds immediately after, so it isn't blocking, but it's worth a
look next time the auth module is in scope.

---

## TD-0005: Doctor documents not implemented

Opened: 2026-07-31
Status: **Resolved (2026-07-31)**
Severity: Medium

**Description:** Checkpoint 4.2 (ADR-0005) requires upload/list/delete for a
doctor's own documents (certificates, ID proofs). No `DoctorDocument`
model, migration, service, or controller exists - confirmed by grepping the
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
`GET /audit-logs?limit=` - an org-wide recent list with no `doctorId` or
`resource` filter. There is no way to actually view "a per-doctor timeline
of audit events" as ADR-0005 requires, even though the data exists.

**Impact:** Checkpoint 4.2's audit-timeline deliverable is capture-only, not
user-facing.

**Resolution:** Added `AuditService.listForDoctor(organizationId, doctorId,
limit)` - reuses the existing `AuditLog` table with an `OR` filter (direct
`Doctor` events by `resourceId`, plus `DoctorSchedule`/`DoctorLeave`/
`DoctorDocument` events by a `doctorId` field inside their `after` JSON
payload) and maps to a humanized `{id, title, action, resource,
occurredAt}` shape. Exposed as `GET /doctors/:id/audit-timeline` on the
existing `DoctorsController`, gated behind `doctors.read` with the same
own/all-scope enforcement as the scheduling controllers. `audit.listener.ts`
gained 2 more `@OnEvent` handlers for document upload/delete, mirroring the
existing schedule/leave handlers - no capture logic was duplicated.
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
unchanged from Checkpoint 4.1's version - confirmed via `pnpm build`'s
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
(`users.service.ts`, `prisma.service.ts`, every Prisma-backed service) -
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
"Milestone 5's job (see ADR-0006)" - but `DECISIONS.md` only goes up to
ADR-0005. Either the ADR was never written, or the reference is aspirational
placeholder text from whoever wrote the availability engine.

**Impact:** Low - purely a documentation-consistency gap; the underlying
architectural intent (availability engine doesn't know about `Appointment`
records yet) is sound and matches Checkpoint 4.2's scope.

**Resolution:** ADR-0006 was recorded during Milestone 5, Checkpoint 5.1 -
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
browser. No project skill or committed tooling exists for this - Playwright
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
rolePermissions: { create: [...] } } })` - the `update: {}` branch does
**nothing** when a role with that name already exists in that org. The
`demo-hospital` org's `Hospital Admin`/`Doctor` roles were created in an
early session (before the `doctors`, `doctors.schedule`, `doctors.leave`,
`doctors.documents` resources existed) and have never been touched by any
later `pnpm db:seed` run since - every resource/permission added since
Checkpoint 4.1 silently never reached these roles' actual
`RolePermission` rows, no matter how many times `db:seed` is rerun.

**Impact:** Any local dev database seeded before a given resource was added
to `seed.ts` will silently lack that permission for its demo accounts. This
is not cosmetic - it produces confusing 403s that look like application
bugs. This session worked around it by directly granting the missing
`RolePermission` rows to `medicore_dev`'s `Hospital Admin` (+17) and
`Doctor` (+6) roles via a one-off script - a **local data fix only**, not a
code change. `medicore_test` is unaffected (each e2e suite creates a fresh
org via `/auth/register`, which always grants the *current* full
permission catalog to its admin role via
`RolesService.createDefaultOrgAdminRole`).

**Resolution:** Added `syncRolePermissions()` to `seed.ts`, called after
every role upsert (Super Admin + every `ROLE_SPECS` role) - diffs the
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
then creates the row in a separate step - there is no Postgres exclusion
constraint or equivalent preventing two concurrent requests from both
passing the conflict check for the same slot before either commits. This
mirrors a pre-existing limitation in `DoctorLeaveService`'s overlap check
(same class of issue, not introduced fresh here).

**Impact:** Low probability in practice (requires two near-simultaneous
booking requests for the exact same doctor+slot), but a genuine correctness
gap - the system's advertised guarantee ("a slot shown as available is
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
reliably. Root cause not investigated - plausibly a log-level or
pino-transport difference between the `test` and `development` NestJS
environments, or a buffering artifact of backgrounding `pnpm dev` with
shell redirection specifically.

**Impact:** Low - purely an observability gap in ad hoc local verification,
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
independent `Appointment` rows sharing one `recurrenceGroupId` - there is
no endpoint to act on "the whole series" (e.g. "cancel all remaining
occurrences" or "move every future occurrence to a new time"). Each row
must be updated individually via the existing single-appointment status
endpoint.

**Impact:** Low - a real usability gap for a receptionist managing a
patient's recurring series, but not a correctness issue; the grouping id
already exists to build this on top of later.

**Resolution plan:** Add `GET /appointments?recurrenceGroupId=` (trivial -
`AppointmentQuery` would need one more filter field) for viewing the whole
series, and consider a `PATCH /appointments/recurring/:groupId/cancel-remaining`
(or similar) if/when a real usability need for bulk actions comes up. Not
worth building speculatively ahead of that need.

---

## TD-0015 (tracking only, not a defect): SMS confirmations deferred, credential-blocked

Opened: 2026-08-01
Status: Open - expected to stay open until the user supplies credentials
Severity: N/A (not a bug - an intentionally deferred feature)

**Description:** Milestone 5's original scope (`docs/roadmap.md`) included
SMS appointment confirmations. No SMS provider (Twilio, Fast2SMS, or
otherwise) is configured anywhere in this repo - unlike email, which had
`EmailService`'s existing console-fallback to build on, there is no
equivalent SMS scaffolding to reuse. Per `CLAUDE.md`'s prohibition on
faking clinical/billing/auth logic to "make it work," this was not stubbed
with a fake send.

**Impact:** None currently - email confirmation covers the same product
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
"basic, non-exhaustive" and it never blocks prescribing - per ADR-0010,
this was a deliberate, disclosed simplification rather than a silently
incomplete "real" check.

**Impact:** A prescriber could reasonably (and incorrectly) treat the
absence of a warning as clinical clearance. The frontend explicitly
disclaims this, but the disclaimer's visibility depends on a warning
actually firing at least once for a given session - if no interaction
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
today. Not related to Checkpoint 6.2 (Prescriptions) - this module was
out of scope for this session per the reading-policy restriction, so it
was documented rather than fixed.

**Impact:** Low - narrow ~30-minute daily window, doesn't affect any other
test or real usage (a real doctor's schedule wouldn't need to cover this
edge case the way a synthetic all-hours fixture does).

**Resolution plan:** Either extend the fixture's shift to wrap past
midnight (if the scheduling engine supports cross-midnight shifts - needs
checking) or change the walk-in test to book against a fixed, injected
"now" rather than real wall-clock time.

---

## TD-0018 (tracking only, not a defect): AI-powered lab report summarization deferred, credential-blocked

Opened: 2026-08-02
Status: Open - expected to stay open until the user supplies credentials
Severity: N/A (not a bug - an intentionally deferred feature)

**Description:** Milestone 7's roadmap scope (`docs/roadmap.md`) included
"AI-powered lab report summarization (async)." No AI/LLM provider is
genuinely configured anywhere in this repo: `apps/api/.env.example` (and
the local `.env`) declare `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`/
`AI_PROVIDER` fields, but both hold only unset placeholder values
(`sk-xxxxxxxxxxxx` / `sk-ant-xxxxxxxxxxxx`), and a repo-wide grep confirms
no code anywhere reads any of these three env vars - they're template
placeholders for a future integration, not a wired credential. Confirmed
`apps/api/src/modules/ai/` remains the same 3-file no-op scaffold (empty
constructors) it was before this session - unlike `EmailService`
(Milestone 5), which had a genuine console-fallback to build on, there is
no equivalent AI scaffolding to extend. Per `CLAUDE.md`'s explicit
prohibition on faking clinical logic to "make it work," this was not
stubbed with a canned/fake summary.

**Impact:** None currently - every other Milestone 7 deliverable (catalog,
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
interactions) - implement for real once genuinely unblocked, don't
retrofit a fake version now.

---

## TD-0019 (tracking only, not a defect): AI-powered radiology image interpretation and PACS/DICOM integration explicitly out of scope

Opened: 2026-08-02
Status: Open - explicitly excluded by instruction, not a gap to fill
Severity: N/A (not a bug - explicitly excluded feature)

**Description:** Milestone 8's instructions explicitly excluded two
things: AI image interpretation and real PACS/DICOM server integration.
Neither is implemented, and neither is faked. The module is designed so
a future PACS integration has a real extension point: `RadiologyAttachment
.type` includes `DICOM_PLACEHOLDER`/`EXTERNAL_IMAGING` (metadata-only -
accession number, external URL, study instance UID - no real file or
DICOM parsing), and `RadiologyOrder`'s scheduling/report fields are
plain columns a PACS webhook or worklist integration could populate
without a schema change.

**Impact:** None - these were never in scope for this session. Recorded
here only so a future session (or the user) has one place documenting
that the exclusion was deliberate, not an oversight, and what shape the
integration point is in.

**Resolution plan:** When/if the user wants real PACS/DICOM connectivity
or AI-assisted image interpretation, treat both as genuinely new,
credential/infrastructure-blocked features (same practice as TD-0015
SMS, TD-0018 AI lab summarization) - do not stub either with fake
output.

---

## TD-0020: Radiology scheduling has no technician picker UI (raw user ID only)

Opened: 2026-08-02
Status: Open
Severity: Low

**Description:** `RadiologyOrder.technicianUserId` is a plain `String`
(no FK, matching the `LabTest.sampleCollectedBy`-style "actor" convention
- ADR-0008 point 5), settable via the `POST /radiology/:id/schedule` API,
but the frontend Scheduling tab has no input for it at all - there is no
staff-directory/user-lookup endpoint anywhere in this codebase yet (not
for lab technicians, not for any other staff type) for the frontend to
populate a picker from. The Radiologist field *does* have a picker
(reuses the existing `listDoctors` endpoint, since a radiologist is
modeled as a `Doctor` by specialization).

**Impact:** Low - a receptionist/radiology-technician role can still
process orders end to end (schedule/start/complete/report) without ever
setting `technicianUserId`; it's an optional metadata field, not
load-bearing for any status transition or permission check.

**Resolution plan:** Add a generic "list users by role" (or
per-organization staff directory) endpoint if/when one becomes needed
for multiple modules (this same gap would block a technician picker for
Laboratory too, which has the identical `sampleCollectedBy` shape) -
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
the same batch's available stock before either commits - the same class
of gap already open and documented for appointment booking (**TD-0012**)
and `DoctorLeaveService`'s overlap check, not a new pattern introduced
here.

**Impact:** Low probability in practice (requires two pharmacists
preparing different orders against the same batch at the exact same
moment), but a genuine correctness gap - `Drug.reservedStock` could
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

**Description:** "Low stock" means `currentStock <= reorderLevel` - a
comparison between two columns on the same row, which Prisma's query
builder cannot express in a `where` filter without a raw query.
`DrugCatalogService.list` works around this by fetching every drug
matching the other filters for the org and filtering/paginating in
JavaScript when `lowStockOnly` is set, instead of paginating at the
database level like every other query path in this codebase.

**Impact:** Low today - a single organization's drug catalog (one row
per batch) is not large enough for this to be a real performance
problem - but it doesn't scale the way DB-level pagination does, and is
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
- the invoice-creation dialog is the only UI surface that touches
catalog items (implicitly, via a charge's denormalized fields) and
existing pending charges (via the sweep checklist). There is no page to
browse/deactivate catalog items or raise/void an ad-hoc charge outside
the context of building an invoice.

**Impact:** Low - every roadmap-required frontend surface (billing
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
application code, then write back within a `$transaction` - but nothing
prevents two concurrent requests (e.g. two cashiers recording a payment
against the same invoice at the same instant) from both reading the
pre-update balance before either commits. The same class of gap already
open and accepted for appointment booking (TD-0012) and pharmacy stock
reservation (TD-0021), not a new pattern introduced here.

**Impact:** Low probability in practice (requires two near-simultaneous
writes against the same invoice), but a genuine correctness gap -
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
`OVERDUE` when its due date passes with a balance still owing - doing so
would require a scheduled job, and no cron/scheduler infrastructure
exists anywhere in this repo (the same "no cron infra" gap noted for
`NotificationType.APPOINTMENT_REMINDER` and every other
would-be-scheduled feature in this codebase).

**Impact:** Low - `balanceDue` and `dueDate` are both real and queryable
today (the frontend could compute "is this overdue" client-side from
those two fields), just not reflected in the persisted `status` column
or filterable via `status=OVERDUE`.

**Resolution plan:** Pick up once this repo has any scheduled-job
infrastructure (a recurring job scanning `ISSUED`/`PARTIALLY_PAID`
invoices past `dueDate`) - don't bolt on a one-off cron for this single
feature ahead of that.

---

## TD-0027 (tracking only, not a defect): Invoice/receipt QR is a disclosed placeholder, not a real payment gateway

Opened: 2026-08-03
Status: Open - expected to stay open until the user supplies a payment-gateway/UPI integration
Severity: N/A (not a bug - an intentionally deferred feature)

**Description:** Milestone 10's roadmap scope named a receipt/invoice QR
code. No UPI/payment-gateway credentials or merchant VPA are configured
anywhere in this repo. Per `CLAUDE.md`'s prohibition on faking
billing logic to "make it work," both PDF generators (`billing-invoice-
pdf.ts`, `billing-receipt-pdf.ts`) render a labeled bordered placeholder
box instead of a real scannable code - see ADR-0015 point 9.

**Impact:** None currently - every other Milestone 10 deliverable
(invoicing, discounts, taxes, multi-mode payments, refunds) is fully
implemented and functional without it.

**Resolution plan:** Pick up once the user supplies a real payment
gateway/UPI merchant integration. At that point, generate an actual UPI
deep-link QR (e.g. via a `qrcode` npm package) encoding the invoice/
payment reference, mirroring the general shape of TD-0015 (SMS)/
TD-0018 (AI summarization)/TD-0019 (PACS) - implement for real once
genuinely unblocked, don't retrofit a fake one now.

---

## TD-0023 (tracking only, not a defect): Completing a dispense best-effort-completes the source prescription

Opened: 2026-08-03
Status: Open
Severity: Low

**Description:** `DispenseService.dispenseComplete` calls
`PrescriptionsService.updateStatus(..., { status: COMPLETED })` after its
own transaction commits, swallowing any error
(`.catch(() => undefined)`) rather than failing the whole dispense - the
same "separate service calls, no distributed transaction" pattern already
used throughout this codebase (e.g. `EncountersService`/
`RadiologyOrdersService`), not a new gap. In the extremely unlikely case
this call fails (e.g. the prescription was independently discontinued in
the same instant), the `DispenseOrder` ends up `DISPENSED` while its
`Prescription` stays `ACTIVE` - a minor, self-correcting inconsistency
(the prescription can still be manually marked `COMPLETED`/
`DISCONTINUED` from the encounter page).

**Impact:** None observed; a real but narrow edge case with a manual
recovery path already in the UI.

**Resolution plan:** Not planned - acceptable given the same pattern is
already relied on elsewhere in this codebase. Revisit only if this
proves to happen in practice.

---

## TD-0028: Encounter Insurance tab's "File claim" form asks for the invoice ID as free text

Opened: 2026-08-04
Status: Open
Severity: Low (UX friction, not a correctness issue)

**Description:** Filing an insurance claim requires an `invoiceId`
(`InsuranceClaimsService.create`), but no endpoint resolves "the
invoice for this encounter" - `InvoicesService.list` filters by
`patientId`/`status`/`type`/date range, not `encounterId`, even though
`Invoice.encounterId` exists as a column (added in Milestone 10). The
Encounter Insurance tab's "File claim" dialog (`apps/web/src/app/
dashboard/medical-records/[encounterId]/page.tsx`, `FileClaimDialog`)
therefore asks staff to paste the invoice ID manually rather than
picking it from a list, with a hint pointing them at the Billing
module.

**Impact:** Low - staff can still file a claim, just with one extra
manual step (copying the invoice ID from Billing). No functional
claims-workflow gap.

**Resolution plan:** Add an `encounterId` filter to
`InvoicesController`'s list endpoint (mirrors the existing `patientId`
filter), then have `FileClaimDialog` fetch and offer a select instead
of a free-text field. Small, low-risk change - deferred only because it
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
handlers added this milestone) - the audit rows exist in the database,
there's just no endpoint that filters them by `resourceId`/`resource:
'InsuranceClaim'` for a single claim. The claim detail page's
"Timeline" panel is a client-side list built from the claim's own
`createdAt`/`submittedAt`/`settledAt`/`closedAt` columns instead -
correct as far as it goes, but it can't show intermediate transitions
(e.g. "Under Review" has no timestamp column) or who performed each
action.

**Impact:** Low - the settlement panel and status badge already carry
the information that matters for day-to-day use; the timeline gap is a
"nice to have," not a workflow blocker.

**Resolution plan:** Add a generic `GET /audit-logs?resource=X&
resourceId=Y` filter (or a per-claim `GET /insurance/claims/:id/audit`
convenience endpoint) and swap the claim detail page's synthesized
timeline for the real feed. Natural follow-up once a second module
wants the same per-resource audit view - not deferred for a hard
blocker, just not built preemptively for one caller.

---

## TD-0030 (tracking only, not a defect): IPD billing integration and discharge are Checkpoint 12.2, not built this session

Opened: 2026-08-04
Status: **Resolved (2026-08-04)** - closed by Checkpoint 12.2 (see ADR-0019):
`DischargeService.complete` computes `days-stayed × Room.chargesPerDay`
(elapsed time from `admittedAt`, rounded up to the next whole day,
minimum 1) into a real `Charge` row (`sourceModule: IPD`, `sourceId:
admission.id`) at discharge finalize, and `AdmissionStatus.DISCHARGED`
is now genuinely reachable via the approve → checklist → summary →
complete workflow.
Severity: N/A (explicitly out of scope by instruction, not a gap in what was asked)

**Description:** `docs/roadmap.md`'s Milestone 12 goal names "IPD billing
integration - a stay's charges accumulate the same way [as the Charge
Engine]," but Checkpoint 12.1's instructions explicitly excluded
Nursing Notes, Medication Administration, and Discharge Summary,
reserving them for 12.2 - and the only sensible trigger point for a
per-day room/bed charge is discharge (days-stayed × `Room.
chargesPerDay`), which doesn't exist yet. `AdmissionStatus.DISCHARGED`/
`ABSCONDED` exist in the schema (per ADR-0018) but nothing in this
checkpoint's API ever sets them - only `ADMITTED` (on create) and
`CANCELLED` (the same-stay "opened in error" cancel action) are
reachable. This mirrors `InvoiceStatus.OVERDUE` (TD-0026) - an enum
value with no trigger built yet, not a fake implementation.

**Impact:** None for 12.1's actual deliverables (ward/room/bed
inventory, admission, bed allocation/transfer/reserve/vacate, dashboard
- all fully implemented, tested, and browser-verified). A stay
currently accrues no billing charges regardless of length.

**Resolution plan:** Build in Checkpoint 12.2 alongside Discharge
Summary - on discharge, compute `days-stayed × Room.chargesPerDay` (and
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
`RoomsService.deactivate` don't have the equivalent guard - an admin
holding `ipd.wards.delete`/`ipd.rooms.delete` could set a ward or room
to `INACTIVE` while one or more of its beds still show a live
`ADMITTED` patient in `Admission.bedId`. Deactivating the ward/room
doesn't cascade any change to the beds or admissions themselves (the
bed keeps its own `OCCUPIED` status and the admission is unaffected),
so no data is lost or silently changed - this is a missing *prevention*
check, not a correctness bug in what already happened.

**Impact:** Low - an inactive ward/room with a live patient inside is
confusing in the UI (it'd disappear from the default `status=ACTIVE`-
filtered lists staff use day to day) but not unsafe; the admission and
bed records remain fully queryable and correct.

**Resolution plan:** Add the same `occupiedBedCount > 0` (or a direct
`Bed.status: 'OCCUPIED'` query) guard `BedsService.deactivate` already
has, to `WardsService.deactivate`/`RoomsService.deactivate`, throwing a
`ConflictException` naming how many beds are still occupied. Small,
mechanical follow-up - flagged now rather than fixed opportunistically
mid-checkpoint since it isn't exercised by anything this checkpoint's
UI does (nothing deactivates a ward/room with a live admission in the
verified flow).

---

## TD-0032: Nursing/MAR/discharge sub-resources are all all-scope, including for the Doctor role

Opened: 2026-08-04
Status: Open
Severity: Low

**Description:** `ipd.nursing`/`ipd.orders`/`ipd.tasks`/`ipd.mar`/
`ipd.discharge` are all-scope only (see ADR-0019) - mirroring `ipd.
beds`/`ipd.transfer`'s precedent rather than `ipd.admissions`' own-scope
carve-out (ADR-0018). A doctor holding `ipd.discharge.create`/`.manage`
can approve or finalize discharge for *any* admission, not only ones
where they're the attending physician, unlike `ipd.admissions.update`
which is own-scope-checked via `AdmissionsService.assertOwnScopeOk`.

**Impact:** Low in this repo's threat model - every demo/seeded role is
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
Status: Open - explicitly disclosed, not a gap
Severity: N/A (no barcode scanner hardware exists in this environment)

**Description:** `MedicationAdministration.barcodeVerified`/
`scannedCode` are the schema/API hook for a "barcode-ready
architecture" (per `docs/roadmap.md`'s Checkpoint 12.2 deliverables) -
the `administer` endpoint accepts and stores a scanned code and a
verified flag, and the MAR tab has a "Barcode scanned/verified"
checkbox + code field. No physical barcode scanner, camera-based
scanning, or medication/patient wristband barcode format is wired up -
a nurse manually types the code (or leaves it unchecked) exactly as
`radiology`'s DICOM-placeholder precedent (TECH_DEBT for Milestone 8)
disclosed the same shape of gap.

**Impact:** None for anything this checkpoint claims - the
architecture point (a real scan integration could POST into the same
field without a schema change) is real; there is no fake scanning
happening.

**Resolution plan:** Wire a real barcode-scanning flow (camera-based
web scanning library, or hardware scanner emitting keyboard input into
the `scannedCode` field) if/when barcode hardware becomes available to
test against - no code changes needed on the backend.

---

## TD-0034: Vendor Returns has a working backend but no frontend

Opened: 2026-08-05
Status: Open
Severity: Low

**Description:** `goods-receipt.controller.ts`'s `/inventory/
vendor-returns` routes (`VendorReturn` create/list/get/acknowledge,
`inventory.procurement.manage`-gated) are fully implemented and tested
in the Milestone 13 backend (commit `e7f4abb`), but this session's
frontend pass - Milestone 13's remaining-frontend scope as given -
did not include a Vendor Returns page. See ADR-0021.

**Impact:** A vendor return (goods sent back after a GRN, e.g. a
damaged batch) can only be recorded via a direct API call, not through
the UI. No data-integrity risk - the workflow itself is real and
tested; only the frontend surface is missing.

**Resolution plan:** Add `apps/web/src/lib/api/procurement.ts`
functions for `listVendorReturns`/`getVendorReturn`/
`createVendorReturn`/`acknowledgeVendorReturn` (types already exist in
`packages/types/src/procurement.ts`) and a page, most naturally as a
tab on the GRN detail page (`/dashboard/inventory/grn/[id]`) since a
return is typically raised against a specific GRN.

---

## TD-0035: No browser-verified screenshots for Milestone 13

Opened: 2026-08-05
Status: Open - explicitly instructed, not an oversight
Severity: Low

**Description:** Every milestone from 4 through 12 in this repo has a
browser-verified walkthrough and screenshots under `docs/screens/`.
Milestone 13's frontend (both the 2026-08-05 Checkpoint 1 session and
this session) has neither - Checkpoint 1 disclosed no browser tool
being available; this session was explicitly instructed "Do NOT use
Playwright. Do NOT open a browser. Do NOT generate screenshots. Do NOT
perform manual UI walkthroughs," overriding the standing Screenshot
policy in `CLAUDE.md`. See ADR-0021.

**Impact:** Every new page (Stores, Stock/Transfers, Vendors, Purchase
Requests, Purchase Orders, Goods Receipt, Vendor Invoices, Store
Requisitions, Stock Audits, Assets + Maintenance - 20 routes total)
has passed `lint`/`typecheck`/`build`/unit+e2e `test`, but no golden
path (create a store, receive goods against a real PO, walk a
requisition through issue→receive, complete a stock audit with a real
variance, etc.) has been clicked through in a real browser. A UI-only
bug (a broken dialog binding, a permission check that always renders
false, a state-management bug that only shows up on user interaction)
would not be caught by any of the checks that did run.

**Resolution plan:** Next session with browser-tool access available
and no explicit instruction against it should walk every new page
end-to-end per the Milestone Completion Checklist, capture
`docs/screens/inventory-*.png`, and close this item.

## TD-0036: No browser-verified screenshots for Milestone 14

Opened: 2026-08-05
Status: Open - explicitly instructed, not an oversight
Severity: Low

**Description:** This session's instructions explicitly said "Do NOT
use Playwright. Do NOT open a browser. Do NOT generate screenshots,"
overriding the standing Screenshot policy in `CLAUDE.md` - the same
situation Milestone 13's frontend session was in (TD-0035). All 7 new
`/dashboard/staff/*` routes have passed `lint`/`typecheck`/`build`/
unit+e2e `test`, but no golden path (add a staff member, assign a
shift, clock in/out, apply and approve leave, generate a payroll
export) has been clicked through in a real browser.

**Impact:** A UI-only bug (a broken dialog binding, a Select that
never fires `onValueChange`, a permission check that always renders
false) would not be caught by any check that did run.

**Resolution plan:** Next session with browser-tool access and no
explicit instruction against it should walk every new page end-to-end
per the Milestone Completion Checklist, capture
`docs/screens/staff-*.png`, and close this item.

## TD-0037: Payroll Prep's per-day/per-hour rate is a disclosed convention, not a configurable pay policy

Opened: 2026-08-05
Status: Open
Severity: Low

**Description:** `PayrollService.getSummary` derives a per-day rate as
`Staff.monthlySalary / 30` (a common Indian payroll convention,
independent of the month's actual length) and an overtime per-minute
rate as `perDayRate / thatDay's shift.standardMinutes`. Neither is
configurable per-organization, and a day with `workedMinutes` recorded
but no `shiftId` (e.g. a `mark()`-created manual PRESENT row) is
excluded from the overtime calculation entirely rather than falling
back to a default shift length.

**Impact:** Low - Payroll Prep is explicitly a preparation/export
step, not a pay-run; a real payroll run downstream is expected to
apply the organization's actual compensation policy. Disclosed on the
Payroll Prep page itself ("no pay-run processing").

**Resolution plan:** If a full Payroll Processing milestone is ever
built, move the day-count convention and overtime multiplier into
per-organization settings (mirroring `Organization.settings.gstRate`'s
precedent) rather than a hardcoded constant.

## TD-0038: Attendance corrections apply immediately - no HR approval gate

Opened: 2026-08-05
Status: Open
Severity: Low

**Description:** `AttendanceController.correct` (`attendance.update`)
applies a correction the moment it's submitted - there is no
pending/approved distinction, unlike `StaffLeave`'s apply→approve/
reject workflow or `DoctorLeave`'s precedent. A staff member holding
`attendance.update` at `.own` scope could in principle correct their
own record without a second approver, though in practice only HR/Admin
roles are seeded with `attendance.update` (self-service roles only
hold it to request a fix on their own row, and no self-service role in
`seed.ts` is granted it - see `packages/database/prisma/seed.ts`).

**Impact:** Low today (no role is actually seeded with this gap
exploitable), but worth closing before granting broader self-service
correction rights.

**Resolution plan:** If self-service correction requests become a
real requirement, add a `PENDING`/`APPROVED` distinction to
`Attendance` corrections mirroring `StaffLeave.status`, gated by a new
`attendance.approve` action (mirrors `leave.approve`).

## TD-0039: Doctor duty roster and biometric attendance hardware are explicitly out of scope

Opened: 2026-08-05
Status: Open - by design, not an oversight
Severity: Low

**Description:** `docs/roadmap.md`'s Milestone 14 deliverable list
named "Doctor duty roster" and "Attendance marking (manual + biometric
hook)." This session built a generic Staff/Shift/Attendance/Leave
system for **non-doctor** employees (Nurse/Receptionist/Lab
Technician/Radiology Technician/Pharmacist/Cashier/HR/Inventory
Manager) - see ADR-0022 for the reasoning. Doctors already have their
own dedicated `DoctorSchedule`/`DoctorLeave`/`AvailabilityService`
system (Checkpoint 4.2); this session did not build a second,
competing roster for them, nor merge the two systems. "Manual"
attendance marking (self clock-in/out via the app, or HR's `mark()`
override) is real; there is no biometric device integration of any
kind - no hardware, SDK, or vendor is configured anywhere in this
repo, matching this repo's standing precedent for credential-blocked
integrations (SMS, AI providers, payment gateways, PACS/DICOM - see
TD-0015/TD-0018/TD-0027/TD-0019).

**Impact:** None today - no doctor-roster or biometric requirement has
been raised against this milestone's actual deliverable list; flagging
so a future session doesn't assume either exists.

**Resolution plan:** If doctor duty rostering needs to move onto the
generic `Shift`/`ShiftRoster` model (e.g. to unify with non-doctor
staff scheduling), that is a deliberate architecture decision for a
future session - record it as an ADR rather than merging silently. A
biometric hook, if ever required, is an external hardware integration
with no vendor chosen yet - same category as the payment-gateway/PACS
gaps above.

---

## TD-0040: Seed-written `Json` columns aren't covered by any automated contract test

Opened: 2026-08-05
Status: Open
Severity: Medium

**Description:** `GET /api/v1/doctors/stats/dashboard` returned 500 on
every call because the demo seed wrote `DoctorScheduleDay.shifts` with
`start`/`end` keys while the application reads the canonical
`startTime`/`endTime` (`ScheduleShiftSchema`, `packages/types/src/
doctor-schedule.ts`). `shifts` is an untyped Prisma `Json` column and
the seed cast its literal directly to `Prisma.InputJsonValue`, so the
mismatch was invisible to TypeScript, to Prisma, and to the whole test
suite. Fixed at the write site (the seed now `.parse()`s through
`ScheduleShiftSchema`), but the *general* gap remains: nothing
automatically verifies that what the seeds write matches what the
services read.

Why the 513-test suite did not catch it: `availability.service.spec.ts`
mocks `doctorSchedule.findMany` with hand-written fixtures already in
the correct `startTime`/`endTime` shape, so it proved the *reader*
correct against an assumed contract while the *writer* violated it.
Every unit test passed against a database whose schedule data no
service could read.

**Impact:** Any future `Json` column written by a seed (or by any code
path that casts to `InputJsonValue`) can silently diverge from its Zod
contract and only surface as a runtime 500 in the browser. In this
instance one bad seed literal broke the doctors dashboard tile and,
silently, every schedule read - `/availability`, `/availability/today`
and slot generation - across all 8 seeded doctors.

**Resolution plan:** Two complementary options, neither done yet:
(1) an integration test that runs the demo seed against
`medicore_test` and asserts the seeded rows parse cleanly against
their Zod schemas - this is the one that generalises; (2) a lint rule
or convention banning bare `as unknown as Prisma.InputJsonValue` in
favour of a `toJson(schema, value)` helper that parses before casting.
Also worth auditing the other `Json` columns (`Doctor.
languagesSpoken`, `Organization.settings`) for the same class of
writer/reader drift.

---

## TD-0041: No AI provider credential exists - every AI endpoint returns 503, and no clinical text is generated

Opened: 2026-08-05
Status: Open - genuinely credential-blocked, disclosed not faked
Severity: High (blocks the feature entirely, not the code)

**Description:** Checkpoint 15.1 built the complete AI Clinical
Assistant - provider abstraction over four real vendors, prompt
templates, conversation logging, audit, usage/token accounting, RBAC,
feature flags, retry, and both streaming and non-streaming transports.
What it cannot do in this environment is call a provider:
`apps/api/.env` holds placeholder credentials (`OPENAI_API_KEY=
sk-xxxxxxxxxxxx`, `ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx`), no
`GEMINI_API_KEY` is set, and no Ollama server is running.

`ai.config.ts` treats a run of 6+ `x`s as a placeholder and therefore
as *absent*, deliberately: sending a placeholder key would produce a
provider 401 that reads like an outage rather than what it is -
no credential. With no configured provider, `AiClientService.
assertAvailable()` throws before any patient data is read, and every
generation endpoint returns **503 with an explicit reason**. It does
**not** return fabricated clinical text, a canned sample, or a "demo
mode" response. This is the same line this repo has held for every
credential-blocked integration (TD-0015 SMS, TD-0018 lab AI
summarization, TD-0019 PACS/DICOM, TD-0027 payment gateway, TD-0039
biometric attendance).

**Impact:** The seven generators are reachable, RBAC-gated, audited,
and fully wired end to end in both API and UI - and produce nothing.
The `/dashboard/ai` page and the `AiAssistDialog` both surface the
exact reason ("OPENAI_API_KEY is not set (or is still a placeholder
value)") rather than failing opaquely. The e2e suite asserts *this
contract* - 503-with-a-reason - rather than asserting generated text,
because there is no honest way to assert output that isn't produced.

**Resolution plan:** Set a real key for whichever provider the
deployment uses (`AI_PROVIDER` + the matching `*_API_KEY`, or point
`OLLAMA_BASE_URL` at a running Ollama for a fully self-hosted setup).
Then extend `apps/api/test/ai.e2e-spec.ts` with the generation-path
assertions it currently cannot make. No code change is required -
the pipeline is complete; only the credential is missing.

---

## TD-0042: Clinical context is sent to a third-party AI provider with no BAA and no de-identification by default

Opened: 2026-08-05
Status: Open - mitigations exist, policy decision outstanding
Severity: High (compliance, not correctness)

**Description:** The AI generators work by sending assembled clinical
context - patient demographics, clinical notes, vitals, diagnoses, lab
results, radiology reports, prescriptions, nursing notes - to whichever
provider `AI_PROVIDER` selects. For OpenAI/Anthropic/Gemini that is a
third-party processor. This repo has no signed Business Associate
Agreement with any of them, no data-processing agreement, no
provider-side zero-retention configuration, and no record of patient
consent to third-party processing.

Two mitigations are built and working, but neither is a substitute for
a BAA:
1. `AI_INCLUDE_PATIENT_IDENTIFIERS=false` replaces the patient name and
   UHID with `[redacted]` in every context block while keeping age,
   sex and clinical content (which are load-bearing for the output).
   This is *pseudonymisation*, not HIPAA Safe Harbor de-identification
   - free-text clinical notes can still carry identifiers the builder
   cannot detect.
2. `AI_PROVIDER=OLLAMA` runs entirely self-hosted, so no PHI leaves the
   deployment at all. This is the only configuration in which the
   compliance question does not arise.

**Impact:** A deployment that enables AI against a hosted provider
without a BAA is very likely in breach of HIPAA (and of India's DPDP
Act for this system's primary market). Nothing in the code prevents
that configuration today - it is disclosed here rather than silently
permitted.

**Resolution plan:** Before any production enablement: (a) sign a BAA
with the chosen provider and enable zero-retention, or (b) deploy
Ollama and set `AI_PROVIDER=OLLAMA`. Additionally worth building in
Checkpoint 15.5: a per-organization AI opt-in setting (rather than a
deployment-wide flag), a recorded patient-consent check before
generation, and a real de-identification pass over free-text fields.

---

## TD-0043: `PATIENT_LINKED_MODELS` is a hand-maintained list - a future module adding a `patientId` column can silently break merge

Opened: 2026-08-05
Status: Open
Severity: Medium

**Description:** `PatientsService.mergePatients` (Milestone 3
completion, ADR-0024) reassigns every other module's `patientId` column
from a merged (duplicate) patient to the survivor by iterating a fixed
array, `PATIENT_LINKED_MODELS`, in `patients.service.ts`. There is no
schema-level or test-level check that this array stays in sync with
every model that actually has a `patientId` column - it was built by
grepping `schema.prisma` once, by hand.

**Impact:** If a future milestone adds a new model with a `patientId`
column (direct FK or a bare unenforced string, mirroring `Payment`/
`Charge`'s existing pattern) and doesn't also add it to
`PATIENT_LINKED_MODELS`, merging two patients will silently leave that
new module's records pointing at the now-deactivated source patient -
a data-integrity bug that produces no error and is easy to miss in
review, since nothing fails loudly.

**Resolution plan:** A schema-introspection test (Prisma DMMF -
enumerate every model with a field literally named `patientId` and
assert it's covered by `PATIENT_LINKED_MODELS`) would catch this at
`pnpm test` time instead of relying on manual discipline. Not built
this session - scoped as a follow-up test-infrastructure improvement
rather than blocking Milestone 3's completion.

---

## TD-0044: No browser-verified screenshots for Milestone 16

**Recorded:** 2026-08-05 (Milestone 16)
**Status:** Open - deliberate, by instruction
**Severity:** Low

This session was explicitly instructed: *"Do NOT use Playwright or browser
verification. Run only: pnpm lint / pnpm typecheck / pnpm test / pnpm
test:e2e / pnpm build."* Every one of those passed, and 36 new e2e tests
exercise the full Organization Dashboard and Platform console API surface -
but no page under `/dashboard/organization` or `/platform` has been rendered
in a real browser, and `docs/screens/` has no Milestone 16 entries.

Mirrors TD-0035 (Milestone 13) and TD-0036 (Milestone 14). The API contracts
these pages consume are covered end to end; what is unverified is rendering,
layout, and client-side interaction.

**Resolution:** Walk both surfaces in a browser and capture screenshots when
a session is permitted to.

---

## TD-0045: The Platform console has no organization *detail* page

**Recorded:** 2026-08-05 (Milestone 16, Checkpoint 16.2)
**Status:** Open
**Severity:** Low

`GET /platform/organizations/:id` and `GET /platform/organizations/:id/usage`
are fully implemented, tested, and return a rich detail payload (hospitals,
administrators, storage bytes, active users). The frontend currently surfaces
only the *list* view plus its inline suspend/enable/plan dialogs - there is no
`/platform/organizations/[id]` page consuming that detail endpoint.

Nothing is faked: the list shows only data it genuinely has. The gap is a
missing page, not a stubbed one.

**Resolution:** Add `/platform/organizations/[organizationId]/page.tsx`
consuming the two endpoints that already exist.

---

## TD-0046: API usage metering is a rolling Redis window, not a durable ledger

**Recorded:** 2026-08-05 (Milestone 16, Checkpoint 16.2)
**Status:** Open - deliberate trade-off, disclosed in the UI
**Severity:** Medium (if usage is ever used for billing)

`ApiUsageService` counts requests in Redis keys
(`apiusage:{orgId}:{YYYY-MM-DD}`, 35-day TTL), incremented fire-and-forget by
a global interceptor. This was chosen over a Postgres row-per-day `upsert`
because that would add a write to every read - a cost this repo pays nowhere
else (ADR-0025 point 7).

Consequences, all disclosed in both the Organization Usage tab and the
Platform overview:
- Only the last 30 days are queryable; there is no long-term history.
- A Redis flush or eviction loses the counters silently.
- The metering increment is not awaited, so a request that completes as the
  Redis write fails is not counted.

**This is real measured traffic, not an estimate - but it must not be used as
a billing ledger without first moving it to durable storage.**

**Resolution:** If usage-based billing is ever introduced, add a scheduled job
that rolls each day's Redis counters into a persistent `ApiUsageDaily` table
before they expire.

---

## TD-0047: Storage usage measures recorded file sizes, not actual bucket contents

**Recorded:** 2026-08-05 (Milestone 16, Checkpoint 16.2)
**Status:** Open
**Severity:** Low

`StorageUsageService` sums the `fileSizeBytes` column across the five models
that carry one (`PatientDocument`, `DoctorDocument`, `StaffDocument`,
`EncounterAttachment`, `RadiologyAttachment`). It never queries the disk or
S3/MinIO bucket.

Therefore:
- An object orphaned by a failed `StorageService.delete` still occupies real
  bucket space but is invisible in the reported figure.
- A future module that adds an upload path must be added to this service by
  hand, or its files silently stop counting - the same hand-maintained-list
  hazard already recorded as TD-0043 for `PATIENT_LINKED_MODELS`.

**Resolution:** Reconcile against the storage driver periodically, and/or add a
contract test that fails when a new model with a `fileSizeBytes` column is not
represented in `StorageUsageService`.

---

## TD-0048: Subscriptions record a commercial agreement - no payment is taken

**Recorded:** 2026-08-05 (Milestone 16, Checkpoint 16.2)
**Status:** Open - genuinely credential-blocked
**Severity:** Medium

A platform owner can set an organization's plan, status, limits, monthly
price and currency. **Nothing charges anyone.** No payment gateway is
configured anywhere in this repo - the same gap already recorded for
invoice/receipt QR codes (TD-0027).

Related, and equally honest about what is *not* enforced: the limits stored
on a `Subscription` (`maxHospitals`/`maxUsers`/`maxPatients`/
`storageQuotaMb`) are **reported but not enforced**. The Usage tab shows
consumption against them and warns visually past 90%, but no create path
currently refuses when a limit is exceeded, and `SubscriptionStatus.PAST_DUE`
does not restrict anything. Only an explicit platform-owner suspension stops
a tenant.

The UI states both limitations in-page rather than implying enforcement.

**Resolution:** Wire a payment provider when credentials exist; add limit
checks to the hospital/user/patient create paths and a storage check to the
upload paths if quotas are meant to bind.

---

## TD-0049: Platform global search deliberately excludes patients and clinical records

**Recorded:** 2026-08-05 (Milestone 16, Checkpoint 16.2)
**Status:** Open - deliberate, disclosed in-page
**Severity:** None (this is the safe default; recorded so it isn't "fixed" carelessly)

`PlatformStatsService.search` covers organizations, hospitals and users only.
A platform operator has no clinical need for patient records, and a single
search box returning PHI across every tenant would be a significant privacy
regression - closely related to TD-0042's concern about clinical data leaving
a tenant boundary.

**Resolution:** If cross-tenant patient lookup is ever genuinely required
(e.g. for a support workflow), it should be a separate, individually
permissioned, individually audited endpoint - not an extension of this search.

---

## TD-0050: Platform-owner access is revocable only at organization granularity

**Recorded:** 2026-08-05 (Milestone 16, Checkpoint 16.3)
**Status:** Open
**Severity:** Low

`isPlatform` is a property of the *organization*, so every user in the
platform tenant is a candidate platform owner; what actually distinguishes
them is which `platform.*` permissions their role holds. There is no
per-user "this account may not use the console" switch short of removing
their permissions or deactivating the user.

`JwtStrategy.validate` re-checks `isPlatform` against the database on every
request, so revoking the organization flag is immediate - but permission
changes still take up to one access-token lifetime (15 minutes) to take
effect, the same staleness window every other permission in this system has.

**Resolution:** Acceptable as-is. If finer control is needed, add a per-user
flag checked in `PlatformGuard` alongside the organization flag.

---

## TD-0051: Appointment "waiting time" is a scheduling delay - no arrival timestamp exists

**Raised:** 2026-08-05 (Milestone 17, Checkpoint 17.1)
**Severity:** Medium

The roadmap asks for "Average waiting time". `Appointment` has
`scheduledAt`, `durationMinutes` and `status`, but **no check-in/arrival
column** - nothing records when the patient physically arrived or was called
in. A true waiting time (arrival → consultation start) is therefore not
derivable from this schema.

What `AppointmentReport.averageConsultationDelayMinutes` reports instead is
the mean minutes from `Appointment.scheduledAt` to `Encounter.createdAt` -
how late, on average, consultations start relative to their booked slot.
That is a real and useful operational number, but it is **not** waiting-room
time, and it is labelled as a "consultation delay" in the API doc comment,
the operational-report UI note, and the KPI hint. Negative values (seen
early) are kept rather than clamped so the mean stays honest. Appointments
with no linked encounter are excluded, and the sample size is returned
alongside the mean (`consultationDelaySampleSize`).

**Resolution:** Add `Appointment.arrivedAt`, set when a receptionist marks
the appointment `ARRIVED` (the status already exists - only the timestamp is
missing), then report `arrivedAt → Encounter.createdAt` as true waiting time
and keep the scheduling delay as a second, separate metric.

---

## TD-0052: Radiology "machine utilization" is relative load, not a duty cycle

**Raised:** 2026-08-05 (Milestone 17, Checkpoint 17.1)
**Severity:** Low

`RadiologyOrder.machine` is a free-text string and there is no machine
inventory, capacity, or operating-hours model anywhere in the schema. A
utilisation percentage in the usual sense (busy minutes ÷ available minutes)
therefore has no denominator to compute against.

`RadiologyReportStats.machineUtilisation` reports each machine's **share of
the scheduled study minutes actually recorded** (`durationMinutes`), which
answers "which machine is carrying the load" but not "how close is it to
capacity". Studies with no machine recorded are grouped under "Unassigned"
rather than dropped. The UI states this limitation under the table.

**Resolution:** Introduce a `RadiologyMachine` model (name, modality,
operating hours, maintenance windows) and compute a real duty cycle against
it. Would pair naturally with the PACS integration deferred in TD-0019.

---

## TD-0053: Scheduled reports are persisted but never dispatched

**Raised:** 2026-08-05 (Milestone 17, Checkpoint 17.3)
**Severity:** Low

The milestone asked for scheduled reports as a **placeholder only**, and
that is exactly what shipped. `SavedReport.scheduleEnabled`,
`scheduleCron` and `scheduleRecipients` are persisted and validated (the
cron string must be a well-formed 5-field expression, so an unparseable
value cannot be stored for a future dispatcher to choke on), but **no job,
worker or cron in this repo reads them**. Nothing is emailed.

The placeholder is disclosed rather than hidden: the saved-reports list
renders "schedule saved (not yet dispatched)" on any row with a schedule,
and an e2e test asserts the fields round-trip without claiming delivery.

**Resolution:** Milestone 18 (Notifications & Communication) owns the
dispatcher. `bullmq` is already a dependency and the email layer
(`common/email`) already exists, so the work is a scheduled worker that runs
the saved report, exports it, and mails it to `scheduleRecipients`.

**Status: Resolved (2026-08-06)** - Milestone 18 shipped
`modules/reports/scheduled-reports.dispatcher.ts`. It listens on
`notifications.tick` (the notification worker's clock, so no second scheduler
exists), matches `scheduleCron` with a new dependency-free
`cron-match.util.ts`, claims the run by compare-and-set on `lastRunAt` so two
overlapping ticks cannot double-send, runs the report through
`ReportRegistryService`, exports it through the same `ReportExportService` the
on-screen button uses, emails every recipient, and raises a
`SCHEDULED_REPORT_READY` in-app notification to the report's owner. One honest
carry-over remains - see **TD-0060** (the file is linked, not attached).

---

## TD-0054: Report bucketing happens in JS, bounded by a 400-day range cap

**Raised:** 2026-08-05 (Milestone 17, Checkpoint 17.1)
**Severity:** Medium

Every time series is built by fetching the rows in range (projected to the
few columns needed) and bucketing them in memory, following the existing
`BillingDashboardService.collectionTrend` precedent rather than introducing
raw SQL `date_trunc` into a codebase that otherwise uses Prisma exclusively.

That is fine at the volumes this system currently holds, but it is linear in
row count rather than in bucket count. The mitigation is an explicit cap:
`MAX_RANGE_DAYS = 400`, and a range beyond it returns **400 Bad Request with
the requested length named** rather than silently truncating or timing out.
`ReportRegistryService` separately caps exported rows at 5 000 and sets
`truncated`, which the UI, the CSV footer and the PDF footer all disclose.

**Resolution:** Move the heavy series (billing, appointments, IPD occupancy)
to `$queryRaw` with `date_trunc` and a `GROUP BY`, returning one row per
bucket. Worth doing when a real tenant crosses roughly 100 k rows in a
reporting window, or if the 400-day ceiling starts blocking legitimate
year-on-year comparisons.

---

## TD-0055: Lab "revenue by test" is an allocated figure, not a per-test price

**Raised:** 2026-08-05 (Milestone 17, Checkpoint 17.1)
**Severity:** Medium

Two schema facts constrain this: the **laboratory module raises no `Charge`
rows of its own** (only IPD discharge and the appointment-consultation
listener do), and `LabTestCatalogItem` has **no price column** - unlike
`RadiologyCatalogItem.price` and `ServiceCatalogItem.price`.

So lab revenue is read from `Charge` rows the billing module owns
(`sourceModule = LABORATORY`, keyed to the order by `sourceId`). The
order-level and period-level totals are exact. The per-test figure in
`LaboratoryReport.topTests[].revenue` is that order's charge **allocated
evenly across the order's test items** - exact for a single-test order, a
disclosed even split otherwise. The rule is stated in the service doc
comment, the registry report description and the UI table note.

By contrast, pharmacy revenue *is* exact (`quantityDispensed x Drug.price`,
since a dispense item resolves to a specific priced batch), and items the
pharmacist never resolved to a batch carry a `null` revenue rather than a
guessed one.

**Resolution:** Add a `price` column to `LabTestCatalogItem` and have the
laboratory module raise a per-item `Charge` through the existing Charge
Engine at order time - the same pattern IPD already uses for room charges.
Then per-test revenue becomes a direct sum with no allocation.

---

## TD-0056: Ward occupancy is measured against today's bed count

**Raised:** 2026-08-05 (Milestone 17, Checkpoint 17.1)
**Severity:** Low

`IpdReport.occupancyRateTrend` computes a genuine bed-days rate (occupied
bed-days ÷ available bed-days per bucket, reconstructed from each
admission's own stay window, including stays that started before the
window). The numerator is historically accurate.

The **denominator is not**: bed capacity is taken as the current
`Bed` row count, because the schema keeps no history of when a bed was
commissioned or decommissioned. A ward that doubled in size mid-period is
measured across the whole period against its present size, which understates
occupancy for the earlier part of the range.

**Resolution:** Add `Bed.commissionedAt`/`decommissionedAt` (or derive them
from the audit trail, which already records bed creation) and compute
available bed-days per day from the beds that actually existed that day.

---

## TD-0057: Stock valuation uses catalog unit cost, not weighted-average or FIFO

**Raised:** 2026-08-05 (Milestone 17, Checkpoint 17.1)
**Severity:** Low

`InventoryReport.stockValuation` values stock at `InventoryItem.unitCost` -
the catalog cost. `InventoryBatch` stores no per-batch purchase price (the
actual paid price lives on `PurchaseOrderItem.unitPrice`, which is not
linked back to the batch that receipt produced), so a weighted-average or
FIFO valuation is not derivable without a schema change.

The valuation is at least conservative in one respect: damaged, expired and
lost quantities are excluded, so only saleable stock is valued - matching
how `InventoryStock` itself defines available stock.

**Resolution:** Carry the receipt price onto `InventoryBatch` at GRN time
(a `unitCost` column populated from the matching `GoodsReceiptItem`), then
value each batch at what was actually paid for it and offer FIFO/weighted-
average as a reporting option.

---

## TD-0058: Browser push cannot obtain an FCM token in this deployment

**Raised:** 2026-08-06 (Milestone 18, Checkpoint 18.2)
**Severity:** Medium

Every part of browser push is implemented and exercised **except the one
step that needs a credential and a package**:

- Implemented and tested: the FCM HTTP v1 send path (`FcmPushProvider`,
  service-account JWT signed with `node:crypto`, per-token fan-out, invalid-
  token detection), the `UserDevice` registry (multi-device per user,
  idempotent registration on token, deactivate, token never returned to the
  client), the standards-based service worker (`apps/web/public/push-sw.js`,
  `push` + `notificationclick`, deep-link routing that focuses an existing
  tab), the permission request, and the device UI on the preferences page.
- **Not implemented:** minting the FCM registration token in the browser.
  That requires `getToken()` from the `firebase` JS SDK, which is not a
  dependency of `apps/web`, and a Firebase project, which this deployment
  does not have (`FCM_PROJECT_ID`/`FCM_CLIENT_EMAIL`/`FCM_PRIVATE_KEY`/
  `FCM_VAPID_PUBLIC_KEY` are all unset).

**Nothing is faked.** `GET /notifications/devices/push-config` returns
`configured: false` with the exact missing variables named; the preferences
page shows that reason verbatim; a PUSH delivery attempted without
credentials is recorded `FAILED` with the same reason and is **not
retried** (a missing credential is not a transient fault). An e2e test
asserts both behaviours. This is the same line held for SMS (TD-0015), the
payment gateway (TD-0027) and AI providers (TD-0041).

A Web Push `PushSubscription` was deliberately **not** stored as a
substitute: it is not an FCM token, and `UserDevice` rows the sender can
never deliver to would produce a device list that looks healthy while
silently dropping every message.

**Resolution:** add `firebase` to `apps/web`, create a Firebase project, set
the four environment variables, and replace the single `return null` in
`acquireToken` (`apps/web/src/lib/push/use-push-notifications.ts`) with
`getToken(messaging, { vapidKey })`. No other client or server change is
needed.

---

## TD-0059: SMS and WhatsApp are abstractions with a log driver only

**Raised:** 2026-08-06 (Milestone 18, Checkpoint 18.1)
**Severity:** Medium

By explicit instruction for this milestone, **no paid provider was
integrated**. `SmsProvider` and `WhatsappProvider` implement the
`NotificationChannelProvider` interface and offer one local driver:
`SMS_DRIVER=LOG` / `WHATSAPP_DRIVER=LOG` writes the message to the
application log and records the delivery as sent by `providerName:
'log-sms'` / `'log-whatsapp'`, so nobody can mistake it for a real message.
With no driver set (the default) a delivery **fails** with "No SMS provider
is configured", never succeeds silently. This supersedes the narrower
TD-0015 for the notification path.

A real WhatsApp Business integration carries a constraint this abstraction
does not yet express: outside a 24-hour customer-service window, only
**pre-approved message templates** may be sent, not the free text
`NotificationTemplate` currently produces. That mapping is not designed.

**Resolution:** one new class per vendor implementing
`NotificationChannelProvider`, plus one entry in `NotificationsModule`'s
provider array. For WhatsApp, additionally map `NotificationType` →
approved template name and pass variables positionally.

---

## TD-0060: A scheduled report is linked in its email, not attached

**Raised:** 2026-08-06 (Milestone 18, closing TD-0053)
**Severity:** Low

`ScheduledReportsDispatcher` genuinely runs the report and generates the
XLSX through `ReportExportService`, but the email it sends **links back to
the report rather than attaching the file**. `EmailService.send` accepts
`{ to, subject, html }` and has no attachment parameter; widening a
signature four other modules already depend on, for one caller, was judged
the worse trade. The email states the generated filename and row count and
links to the report, which re-runs against live data.

**Resolution:** add an optional `attachments` field to `EmailService.send`
(Resend's API already supports it) and pass `exported.buffer` through.

---

## TD-0061: Email digest frequencies other than Immediate/Never behave as Immediate

**Raised:** 2026-08-06 (Milestone 18, Checkpoint 18.5)
**Severity:** Low

`NotificationPreference.emailFrequency` accepts `IMMEDIATE`, `HOURLY`,
`DAILY`, `WEEKLY` and `NEVER`. Only the two ends are enforced: `NEVER`
suppresses the email channel, everything else sends per event. Batching
`HOURLY`/`DAILY`/`WEEKLY` needs a digest accumulator and a second worker
pass that groups a user's pending email deliveries into one message.

The preferences page **says so on screen** rather than implying the setting
works, and the enum value is stored faithfully so no user choice is lost
when batching is built.

**Resolution:** hold email deliveries in `QUEUED` with `nextAttemptAt` set to
the end of the user's digest window, then have the worker collapse all
due email deliveries for one recipient into a single send.

---

## TD-0062: Low-stock alerts fire only on stock-service movements, and once per threshold

**Raised:** 2026-08-06 (Milestone 18, Checkpoint 18.4)
**Severity:** Medium

Two bounded gaps in inventory alerting:

1. **Coverage.** `inventory_stock.changed` is emitted from the three
   `StockService` methods that own their own transaction (`setOpeningStock`,
   `adjust`, `updateLevels`). Stock also moves through `receiveStock` /
   `issueStock`, which other inventory workflows (GRN, transfers,
   requisitions) call *inside their own transaction* - emitting there would
   fire the event before commit, and the listener could read pre-commit
   state. So a GRN or a requisition issue does not currently raise a
   low-stock alert.
2. **Repeat suppression.** The alert's `eventKey` is keyed on the stock row
   plus the threshold value, so one crossing produces one notification. If
   stock is restocked above the threshold and later falls below it again,
   **no new alert is raised** unless the threshold value itself changed.
   That is the deliberate trade against alerting on every movement while
   stock sits low; it is the wrong trade for a fast-moving item.

**Resolution:** for (1), emit `inventory_stock.changed` from each workflow
*after* its transaction commits, or add a small post-commit event buffer.
For (2), include a monotonically increasing "crossing counter" (or the
previous quantity) in the key so a genuine re-crossing is a new event.

---

## TD-0063: The notification centre polls; there is no realtime channel

**Raised:** 2026-08-06 (Milestone 18, Checkpoint 18.3)
**Severity:** Low

The header bell polls `GET /notifications/summary` every 60 seconds. There
is no websocket or SSE feed, so an in-app notification can take up to a
minute to appear for a user who has the tab open and push disabled.

This is a deliberate omission, not an oversight: push (Checkpoint 18.2) is
the real-time channel, and a socket layer would be a second delivery
mechanism to operate and secure for the same outcome. The API already
streams over SSE for AI generation, so the machinery exists if the trade
changes.

**Resolution:** an SSE endpoint on `NotificationsController` that pushes
summary deltas for the authenticated user, reusing the AI module's
streaming transport.

---

## TD-0064: Notification provider configuration is deployment-wide, not per tenant

**Raised:** 2026-08-06 (Milestone 18, Checkpoint 18.6)
**Partially resolved:** 2026-08-07 (ADR-0032) - **for email only.** FCM and SMS
are unchanged; see below.
**Severity:** Low

Channel adapters are selected and credentialed from environment
configuration, so every organization on a deployment shares one FCM project,
one Resend sender and one SMS driver. A tenant cannot send from its own
sender identity or its own Firebase project.

**Email is now per-tenant.** `OrganizationEmailConfig` (encrypted Resend key,
from name/address, reply-to) plus `/dashboard/organization` → Email lets an
org configure its own sender; `AuthService.forgotPassword`/
`sendVerificationEmail` resolve it via `OrganizationEmailConfigService.
resolveSendOverride`, falling back to the platform default when unconfigured.
See ADR-0032 for the encryption design (`SecretEncryptionService`,
AES-256-GCM, this codebase's first encryption-at-rest of anything).

**Still deployment-wide, unchanged:** FCM (push) and the SMS/WhatsApp log
drivers - only email got a per-tenant path. **Still deployment-wide even for
email:** appointment confirmations, staff onboarding, scheduled reports, and
the generic notification-channel email provider (`modules/notifications/
channels/email.provider.ts`) all still call `EmailService.send` without an
override - `EmailService.send` accepts one (an optional second parameter),
but only the two auth flows resolve and pass it today. Wiring the remaining
four call sites is mechanical (thread `organizationId` to the send site, call
`resolveSendOverride`) but was left as a follow-up rather than done under one
change - see ADR-0032's "Consequences."

**Resolution (remaining scope):** thread `OrganizationEmailConfigService.
resolveSendOverride` into the four email call sites listed above; move FCM
and SMS/WhatsApp credentials into their own per-tenant config following the
same `OrganizationEmailConfig` pattern if that's ever prioritized.

---

## TD-0065: No user picker for composing a broadcast

**Raised:** 2026-08-06 (Milestone 18, Checkpoint 18.6)
**Severity:** Low

`POST /notifications/admin/send` accepts both `recipientIds` and
`roleSlugs`, and both are honoured. The admin console's Send tab only
exposes the role field, as a comma-separated list - there is no user search
or multi-select, so addressing named individuals means calling the API
directly.

Same shape as the long-standing TD-0028 (free-text internal user IDs
elsewhere in the app); a shared user-picker component would close several of
these at once.

**Resolution:** build one reusable user-picker component backed by
`GET /users`, and use it here, in the inventory store-manager field, and in
the asset-assignment field.

---

## TD-0066: Milestone 18 was not browser-verified

**Raised:** 2026-08-06 (Milestone 18, Checkpoint 18.7)
**Severity:** Low

Explicit instruction this session: "Do NOT use Playwright. Do NOT generate
screenshots. Do NOT perform browser verification." Every claim about
Milestone 18 therefore rests on automated verification - 727 API unit tests,
6 web unit tests, 408 e2e tests across 21 suites, plus lint, typecheck and
build - and none on a rendered page. Mirrors TD-0035/TD-0036/TD-0044.

**Resolution:** a browser pass over the notification centre, preferences
page, admin console and platform analytics whenever screenshots are next
requested; `docs/screens/` has no Milestone 18 entries.

---

## TD-0067: Rate limiting is per-process, so N replicas mean N × the limit

**Recorded:** 2026-08-06 (Milestone 19.1)
**Severity:** Medium - matters only when running more than one API instance
**Area:** `apps/api/src/app.module.ts` (`ThrottlerModule`)

`@nestjs/throttler` uses its in-memory storage. Two API replicas behind one load
balancer therefore allow twice the configured budget in aggregate, and a client
pinned to one instance sees the configured limit while a round-robined one sees
more.

**Why it was left:** the fix is `@nest-lab/throttler-storage-redis` (or an
equivalent), a new dependency whose value is zero on the single-instance
deployment `docker-compose.prod.yml` describes. Adding it speculatively would
have been the kind of unused infrastructure this milestone's audit was meant to
avoid.

**Fix:** register a Redis throttler storage in `ThrottlerModule.forRootAsync`,
reusing the existing `REDIS_CLIENT` provider. Nothing else changes - the guard,
the tiers and the per-route overrides are storage-agnostic. Do this **before**
the first multi-instance deployment.

---

## TD-0068: Every API instance runs the notification worker

**Recorded:** 2026-08-06 (Milestone 19.3)
**Severity:** Low - wasteful, not incorrect
**Area:** `apps/api/src/modules/notifications/notification-scheduler.service.ts`

The worker is a `setInterval` in the application process, so every replica ticks.
Delivery is still exactly-once - claiming is a compare-and-set on
`notification_deliveries` (ADR-0027) - but N instances issue N claim queries per
tick against the same rows.

**Why it was left:** correct as-is, and the two real fixes both have costs worth
choosing deliberately. A leader election adds coordination state; a separate
worker process adds a deployment unit.

**Fix (when it matters):** either set `NOTIFICATIONS_WORKER_ENABLED=false` on all
but one instance - supported today, no code change - or run a dedicated worker
container from the same image with the API's HTTP server disabled.

---

## TD-0069: Trace context is propagated, but no OpenTelemetry SDK exports spans

**Recorded:** 2026-08-06 (Milestone 19.4)
**Severity:** Low - this is a capability gap, not a defect
**Area:** `apps/api/src/common/observability/trace-context.util.ts`

MediCore parses an inbound `traceparent`, continues the trace with its own span,
echoes the header, and stamps `traceId`/`spanId` on every log line. Logs are
therefore joinable with an upstream gateway's traces. What does **not** exist:
spans exported to a collector, automatic instrumentation of Prisma/HTTP/Redis,
or a service graph.

**Why it was left:** the SDK is ~8 packages plus a collector to run, and the
value is entirely in the deployment that receives the spans. Half-installing it
- dependencies added, nothing exported - would be worse than the honest gap.

**Fix:** add `@opentelemetry/sdk-node` with the HTTP, Fastify and Prisma
instrumentations, initialise it *before* `NestFactory.create` in `main.ts`, and
point `OTEL_EXPORTER_OTLP_ENDPOINT` at a collector. The existing
`RequestContext.trace` should then be sourced from the active OTel span rather
than generated, so the two cannot disagree.

---

## TD-0070: There is no backup automation - the DR procedure is specified, not implemented

**Recorded:** 2026-08-06 (Milestone 19.5/19.7)
**Severity:** **High** for any real deployment
**Area:** `docs/operations/disaster-recovery.md`

`docs/operations/disaster-recovery.md` specifies RPO/RTO targets, the `pg_dump`
and PITR procedures, restore verification and a quarterly drill. **MediCore
ships none of it:** no cron, no snapshot scheduler, no WAL archiving
configuration, no off-site replication, and no automated restore test. A
deployment following the deployment guide exactly has *no backups*.

**Why it was left:** backup automation belongs to the infrastructure the
deployment runs on - a managed Postgres with PITR, a Kubernetes CronJob, a
cloud snapshot policy - and inventing one in this repository would produce a
scheduler that fits nobody's environment. The milestone's remit was explicitly
"do not invent deployment infrastructure".

**Fix:** implement against the target platform, then tick the corresponding
items in `docs/operations/production-checklist.md`. Until that is done, treat
the checklist's data section as unmet regardless of what the guide describes.

---

## TD-0071: A second API instance can serve a stale notification template for up to 300 seconds

**Recorded:** 2026-08-06 (Milestone 19.2)
**Severity:** Low
**Area:** `apps/api/src/modules/notifications/notification-template.service.ts`

Template resolution is cached in Redis and invalidated exactly - publishing or
rolling back a version deletes the entry. Because the entry is *shared* in
Redis, invalidation is in fact global; the 300-second TTL only bounds the window
if a Redis delete fails silently (`CacheService` swallows write failures by
design, so the request never fails).

**Why it was left:** the failure mode requires a Redis error during the delete,
and its worst outcome is one organization's customised notification wording
lagging by up to five minutes. Templates are not clinical data.

**Fix:** if this ever matters, publish a `notification.template.changed` event
and have each instance invalidate on receipt, or shorten `CACHE_TTL_SECONDS`.

---

## TD-0072: `pnpm format` / `pnpm format:check` have never worked

**Recorded:** 2026-08-06 (Milestone 19.6)
**Severity:** Low - cosmetic, but it means formatting is unenforced
**Area:** `.prettierrc`, root `package.json`

`.prettierrc` declares two plugins - `@trivago/prettier-plugin-sort-imports` and
`prettier-plugin-tailwindcss` - that are not installed at the workspace root.
Both scripts fail with `Cannot find package '@trivago/prettier-plugin-sort-imports'`.

**Why it was left:** installing them makes `format:check` flag a large share of
the repository (import ordering and Tailwind class ordering across both apps),
which is a reformatting diff far outside this milestone's remit and one that
would obscure every real change in it. It was therefore **not** added to CI
during Checkpoint 19.6 - adding a check that fails is worse than not having it.

Note that the substantive half is already enforced: ESLint's `import/order` runs
over `apps/api/src` in CI today.

**Fix:** install both plugins, run `pnpm format` as a single isolated commit,
then add `pnpm format:check` to the `lint-and-typecheck` job.

---

## TD-0073: Three Milestone 19 roadmap line items were deliberately not built - Sentry, k6 load testing, Kubernetes manifests

**Recorded:** 2026-08-06 (Milestone 19)
**Severity:** Low–Medium, depending on the deployment
**Area:** `docs/roadmap.md` Milestone 19 deliverables

`docs/roadmap.md` listed these under Milestone 19. Each is marked unchecked
there with the same reasoning, repeated here so the canonical debt list is
complete:

**Sentry (error monitoring).** No DSN and no Sentry account exists in this
environment, and the milestone was instructed not to invent deployment
infrastructure. Adding the SDK with a placeholder DSN would produce a
dependency that silently reports nowhere - the same anti-pattern TD-0041 and
TD-0059 already avoid elsewhere in this repo. **Substitute in place:** every
unhandled exception is logged with `requestId` and `traceId`, and 5xx rate is a
Prometheus metric with an alert rule in `docs/operations/monitoring.md`.
**Fix:** add `@sentry/node`, initialise before `NestFactory.create`, and pass
the request context's `traceId` as the Sentry trace id so the two systems agree.

**k6 load testing.** k6 is not a dependency, and a load test against a laptop's
Docker Postgres produces numbers that mislead rather than inform - the bottleneck
measured would be the developer's machine. **What changed:** the instrumentation
needed to run one meaningfully now exists (`http_request_duration_seconds` by
route, in-flight gauge, event-loop lag, slow-query logs). **Fix:** write k6
scenarios for the genuinely hot paths (login, patient search, encounter open,
appointment booking) and run them against a staging environment sized like
production, reading the results from the metrics endpoint rather than k6's own
timings alone.

**Kubernetes manifests.** Explicitly optional in the roadmap, and
`docker-compose.prod.yml` is the deployment this repository actually describes.
**What is already in place for it:** the liveness/readiness split
(`/api/health/live`, `/api/health/ready`) is exactly what a Deployment's probes
need, graceful shutdown drains before closing, and the API is stateless apart
from Redis. **Fix, when a cluster exists:** Deployment + Service + Ingress +
HPA, probes pointed at those two paths, `terminationGracePeriodSeconds` greater
than `SHUTDOWN_DRAIN_MS`, and **TD-0067 resolved first** - per-process rate
limiting is wrong the moment `replicas > 1`.

---

## TD-0074: Organization branding reaches only users who hold `organizations.read`

**Discovered:** 2026-08-06 (Design System V2, Phase 1 - ADR-0031)
**Severity:** Medium - the white-label promise is only half kept.

`BrandingProvider` applies a tenant's colours by reading
`GET /organizations/me/branding`. That endpoint is gated behind
`organizations.read`, which in `seed.ts`'s role catalogue only Hospital Admin
holds (via its wildcard grant). **A doctor, nurse, receptionist, pharmacist or
lab technician therefore sees the default MediCore palette**, not their
hospital's - which is the majority of the user base.

The provider does not paper over this: it skips the request entirely for users
who lack the permission rather than firing a guaranteed 403 on every page load,
and falls back to the default token layer.

**Partial mitigation already in place:** the last successful branding payload is
cached in `localStorage` per organization id, so branding survives reloads and is
available to the login screen for the last organization used on that device. It
does nothing for a user who has never been able to fetch it.

**Fix (one of):**
1. Include `branding` in the `/auth/login` and `/auth/refresh` response payload
   next to `AuthenticatedUser` - the natural home, since it is per-organization
   data every authenticated user needs, and it costs no extra round trip.
2. Add an ungated `GET /organizations/me/branding/public` returning only the
   colour/display fields (no email footer, no internal settings).

Both are backend changes, which Phase 1 was explicitly forbidden from making.
Option 1 is preferred and would also let the login page brand itself on a fresh
device.

---

## TD-0075: The hospital selector remembers a choice but does not filter any data

**Discovered:** 2026-08-06 (Design System V2, Phase 1 - ADR-0031)
**Severity:** Low - disclosed in the UI, not misleading.

`WorkspaceProvider` owns `activeHospitalId` and the top bar's
`<HospitalSelector>` writes it. **No module query reads it yet**: pages continue
to receive whatever the API scopes them to by organization. Wiring the selection
into each module's query parameters is page work, and Phase 1 was scoped to the
UI foundation with feature pages explicitly out of bounds.

This is stated on screen rather than implied - the selector's own menu says
"Module pages are not yet filtered by this selection" - so no user is led to
believe a filter is applied that is not.

**Fix:** as each module is migrated in Phase 2, pass `activeHospitalId` into its
list query and invalidate on change. The API side already supports hospital
scoping in the modules whose tables carry a `hospitalId`; the ones that do not
should keep ignoring it rather than pretending.

**Still open after Phase 2 (2026-08-06).** Phase 2 was scoped to presentation -
layout, tokens, tables, badges, empty/loading states - under an explicit
instruction not to touch data-fetching, query parameters or any business logic.
Wiring `activeHospitalId` into each module's query is exactly that kind of
change, so it was correctly left untouched. This remains open for a future,
explicitly-scoped task.

---

## TD-0076: `/dashboard/settings` does not exist - the sidebar and profile menu link to a 404

**Discovered:** 2026-08-06 (Design System V2, Phase 1) - **pre-existing**, not
introduced by that work.
**Resolved:** 2026-08-07 - see `PROGRESS.md`'s and `SESSION_LOG.md`'s matching
entries for the full build.
**Severity:** Was Medium - a dead link in the primary navigation, visible to
every user regardless of role (the nav item carries no permission).

`apps/web/src/app/dashboard/settings/page.tsx` now exists: a ten-section
personal Account Settings workspace (Account, Appearance, Notifications,
Security, Sessions, Devices, Keyboard Shortcuts, Accessibility, Developer,
About). It links out to `/dashboard/organization` and
`/dashboard/notifications/preferences` rather than duplicating either, per
this ticket's original fix note.

**What this did *not* close** - these are real backend gaps the new page
discloses honestly rather than resolves, and are the concrete follow-ups if
this module is revisited: no self-service "update my profile" endpoint (only
admin-only `PATCH /users/:id`), no avatar-upload endpoint, no 2FA
implementation (schema fields unused), no route to revoke one specific
*other* session, no personal API token/webhook/CLI token model, no
self-service security-activity feed, and no persisted `UserPreferences` store
(the new Appearance preferences live in `localStorage` instead, by design -
see `PROGRESS.md`).

---

## TD-0077: Feature pages have not been migrated to the V2 primitives

**Recorded:** 2026-08-06 (Design System V2, Phase 1 - ADR-0031)
**Resolved:** 2026-08-06 (Design System V2, Phase 2 - same day, later session).
See `PROGRESS.md` and `CHANGELOG.md` for the full module-by-module record.
**Severity:** None - this was the planned Phase 2, recorded so the state was not
mistaken for an oversight in the interim.

Phase 1 was explicitly instructed not to redesign pages. Every existing page
therefore still rendered through the pre-V2 call shapes. They all worked - the
primitives kept their old exports, variants and prop names, which is why lint,
typecheck, build, 785 API unit tests, 49 web unit tests and 431 e2e tests were
all green - and they inherited the new token layer, density, typography, focus
treatment and branding automatically.

What they did **not** yet use: `PageLayout`/`PageHeader`/breadcrumbs,
`StatusBadge` (each page mapped its own status colours), table affordances
(sticky headers, `TableRowActions`, `BulkActionBar`, `FilterBar`/`SearchInput`),
`EmptyState`'s empty-vs-filtered-empty distinction, `StatCard`/`StatCardGrid`,
and real `recharts` charts in place of hand-drawn divs.

**Resolution:** every dashboard, list, detail and dialog page across all 18
feature modules (Dashboard home, Patients, Doctors, Appointments, Medical
Records, Laboratory, Radiology, Pharmacy, Billing, Insurance, IPD, Nursing,
Inventory, Staff, Organization, Reports, Notifications, AI) now uses
`PageLayout`/`StatusBadge`/`Card`/`TableContainer`+`Table`/`EmptyState`/
`StatCardGrid`/`FilterBar`, migrated module by module with a
lint→typecheck→build verification gate at every module boundary. In the
process this also **fixed real, pre-existing status-colour bugs** that
per-module local maps had introduced independently (e.g. "Cancelled" rendering
red in Appointments and Doctors' leave, "In Consultation" rendering green,
pharmacy low-stock/expiring badges rendering red instead of amber, an IPD
bed-grid colour pair violating the system's own subtle/subtle-foreground
contrast rule) - these were corrected as a direct consequence of centralizing
on `StatusBadge`, not scope creep. Three status keys were added to the shared
`STATUS_TONES` map to cover cases Phase 1 had not encountered yet:
`UNDER_RENOVATION`, `ADMINISTERED`, `TRIALING`, `PAST_DUE`, `SUCCEEDED`.
No backend/API/route/business-logic/Prisma-schema file was touched, and no
browser verification or screenshots were taken - both by the same explicit
instruction that started Phase 2, consistent with Phase 1's precedent.

---

## TD-0078: Organization workspace's People/Security/Brand sections disclose real gaps rather than fabricating controls

Opened: 2026-08-06
Status: Open
Severity: Low

**Description:** The Organization module's information-architecture redesign
(2026-08-06) surfaced the IA the user asked for - Overview/Workspace/People/
Subscription/Brand/Security/Audit - but three of those sections name
sub-features with no backing API anywhere in this repo:

- **People:** custom Roles, email Invitations, and Teams. Access today is
  still the seeded role catalog only (`RolesService`); there is no per-org
  custom-role composer, no invite-by-email flow, and no cross-hospital team
  grouping.
- **Security:** Password policy, Sessions (view/revoke), Two-factor
  authentication, API keys, and Connected apps. Only "Authentication" (email +
  password over JWT, with the pre-existing per-account lockout in
  `AuthService`) is real. None of the other five has any backend model,
  endpoint, or config surface.
- **Brand:** Favicon and per-document (invoice/PDF) logo-and-colour theming.
  Only the logo, three theme colours, and the three email-branding text fields
  (`OrganizationBranding`) are real and editable.

Rather than build toggles/forms that call no real endpoint (which
`CLAUDE.md` explicitly forbids for auth-adjacent logic - "never fake or stub
... auth logic to make it work"), each is rendered as a clearly labeled,
non-interactive "Not available" card stating what's genuinely true today.

**Impact:** None - nothing regressed; these are net-new IA slots for
features that never existed, disclosed rather than hidden or faked.

**Resolution plan:** Build each capability for real once there's a fresh
instruction to do so:
- Custom roles: extend `RolesService` with a per-org role composer over the
  existing `RolePermission` join table - no schema change needed.
- Invitations: a new `Invitation` model + token-based accept flow, reusing
  `EmailService` the way password reset already does.
- Sessions/API keys/2FA/Connected apps: each is a genuinely new auth
  primitive (refresh-token session registry, per-org password policy config,
  TOTP secret + backup codes, an API-key model with hashed secrets, an OAuth
  client registry) - treat as credential/scope-blocked feature work, not a
  quick add, the same category as TD-0015/TD-0027's disclosed-not-faked
  precedent.
- Favicon/invoice-PDF branding: a `faviconUrl` column mirroring `logo`, and
  threading `Organization.branding` colours into the existing PDF generators
  (`billing-invoice-pdf.ts` etc.) instead of only their name/address/GSTIN.
