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
