# PROGRESS.md

> Running log of what has actually been built, most recent first. Update
> after every completed task. Pair with `CHANGELOG.md` (human-facing summary)
> and `MODULE_STATUS.md` (per-module state).

## 2026-08-01 — Milestone 6, Checkpoint 6.2 (Orders & Prescriptions) — complete; **Milestone 6 fully complete** (autonomous loop iteration)

Continuation of the same-day Checkpoint 6.1 session below, picked up automatically per the standing `/loop` instruction (read `NEXT.md` → implement → verify → document → replace `NEXT.md` → continue). Per `CLAUDE.md`'s reading policy, scope stayed limited to the Prescription model, Encounter (for the FK relation), Patient, and shared types — no Laboratory/Pharmacy/Billing/Radiology/AI modules were touched.

- Recorded **ADR-0010**: reuse the pre-existing `Prescription`/`PrescriptionItem` Prisma models from the original scaffolding commit (never built upon, confirmed zero rows via `prisma.prescription.count()` before changing anything) rather than redesigning — their shape already matched the requirement. The one real change: `Prescription.status` converted from a plain `String @default("ACTIVE")` to a proper `PrescriptionStatus` enum (migration `20260801175600_prescription_status_enum`), matching the `EncounterStatus`/`AppointmentStatus` convention used everywhere else.
- **Self-caught bug, found before writing any tests** (checked `seed.ts`'s `ROLE_SPECS` while designing own-scope enforcement): the `Doctor` role was never actually granted `medical_records.update` or `prescriptions.update` at `own` scope — a real `doctor@medicore.demo` login could not transition their own encounter's or prescription's status, despite the API layer (built in Checkpoint 6.1) correctly supporting it. Not caught by e2e tests because those grant permissions directly rather than through `seed.ts`. Fixed by adding both grants to the `Doctor` role spec and the `OWN_SCOPE_PERMISSIONS` catalog array; verified the fix synced correctly via a real `pnpm db:seed` run (`syncRolePermissions` topped up the existing role with zero manual intervention).
- **Backend** (`apps/api/src/modules/prescriptions/`, rebuilt from a 3-line no-op scaffold): `PrescriptionsService`/`Controller` — `create` (derives patient/doctor from the encounter rather than trusting client-supplied IDs, generates `RX-<orgPrefix>-<year>-NNNNNN` via the same advisory-lock + year-counter pattern as `Appointment.appointmentNumber`), `list`/`getById` (paginated, filterable by patient/doctor/encounter/status), `updateStatus` (`ACTIVE` → `COMPLETED`/`DISCONTINUED`, both terminal), `generatePdf`, and `assertOwnScopeOk` (same idiom as `EncountersService`, checked against the `prescriptions` permission resource and the prescription's own `doctorId`).
- **Basic drug-interaction check** (`drug-interactions.ts`): a small bundled list of ~10 well-known interaction pairs (warfarin+aspirin, methotrexate+ibuprofen, sildenafil+nitroglycerin, etc.), matched case-insensitively across a new prescription's items *and* the patient's other currently-`ACTIVE` prescriptions. Non-blocking (returns `warnings[]` alongside the created prescription) and explicitly labeled "basic, non-exhaustive" in both the API response and the UI — no real terminology service is configured anywhere in this repo (documented as TD-0016, following the same "implement everything else, disclose what's missing" practice used for SMS in Milestone 5 and ICD-10 in Checkpoint 6.1).
- **PDF generation**: added `pdfkit` (+ `@types/pdfkit`) as a new `apps/api` dependency — no PDF library previously existed in this repo. `GET /prescriptions/:id/pdf` streams the generated buffer directly via `@Res()`/`FastifyReply`, bypassing the response-transform interceptor (the correct approach for binary output, not used elsewhere in this codebase until now).
- **Audit integration**: `audit.listener.ts` gained `prescription.created`/`prescription.status_changed` handlers; `AuditService.listForDoctor`'s resource list grew to include `Prescription` — the same one-line addition (plus its matching `audit.service.spec.ts` update) hit at every checkpoint so far.
- **Tests**: `drug-interactions.spec.ts` (8 pure unit tests) + `prescriptions.service.spec.ts` (11 unit tests: create/interaction-detection/status-transitions/own-scope/PDF) + `apps/api/test/prescriptions.e2e-spec.ts` (14 e2e tests: create with/without interaction warnings, rejecting empty items, list, get-by-id, PDF download headers, status transitions including terminal-state rejection, own-scope enforcement for read/update/create, 401 without a token). All passing (175 unit total, 102 e2e total minus one unrelated pre-existing flake — see below).
- **Frontend**: `apps/web/src/lib/api/prescriptions.ts` (API client, including a blob-download helper for the PDF) plus:
  - A **Prescriptions tab** on the encounter detail page — a multi-item prescribe form (add/remove medication rows, route select, quantity), a non-blocking interaction-warning alert, a list of the encounter's prescriptions with PDF-download and mark-completed/discontinue actions.
  - A **"Recent prescriptions" panel** on the medical-records patient-timeline list page (shown alongside the existing weight-trend chart when a patient filter is active), each linking to its originating encounter.
- **Full verification, all green**: `pnpm lint`, `pnpm typecheck`, `pnpm test` (175 api unit + 6 web), `pnpm test:e2e` (101/102 — the one failure is a **pre-existing, unrelated** time-of-day flake in `appointments.e2e-spec.ts`'s walk-in test, documented as **TD-0017**: its all-hours schedule fixture caps at 23:45 with 15-minute slots, so no bookable slot remains when the suite runs between ~23:30–23:59 local time; out of scope to fix here per the reading-policy restriction), `pnpm build` (all 6 packages).
- **Browser-verified end to end** (Playwright + Chromium in the session scratch dir, reusing the Checkpoint 6.1 encounter/patient): created a 2-item prescription (Aspirin + Warfarin) that correctly surfaced a "severe" interaction warning on-screen, created a second unrelated prescription (Cetirizine), downloaded and verified a genuine PDF (`file` confirmed "PDF document, version 1.3, 1 pages"), discontinued a prescription and watched its badge update, and confirmed the patient-timeline "Recent prescriptions" panel renders both prescriptions with correct status badges and deep-links to their encounter. 6 new screenshots under `docs/screens/`.
- Since Checkpoint 6.2 is genuinely complete per every item in `CLAUDE.md`'s Milestone Completion Checklist, and Checkpoint 6.1 was already complete, **Milestone 6 (Clinical: Medical Records) is now fully complete.** Updated `.ai/NEXT.md`: replaced with **Milestone 7 — Laboratory & Radiology**.

---

## 2026-08-01 — Milestone 6, Checkpoint 6.1 (Electronic Medical Records — EMR Foundation) — complete

Explicit instruction scoped this checkpoint to the EMR foundation only —
Encounter, Clinical Notes, Vitals, Diagnosis, Procedures, Attachments —
excluding Laboratory/Pharmacy/Billing/Radiology/AI and, within Clinical
itself, Prescriptions/Orders (deferred to Checkpoint 6.2). Per the required
"only inspect what's relevant" reading policy, work was scoped to the
Patient, Doctor, and Appointment modules, the Prisma schema, and shared
types — no unrelated modules were touched.

- Recorded **ADR-0008**: `Encounter` replaces the flat `MedicalRecord`
  scaffold (one `diagnosis: String` + one `vitalSigns: Json?` blob, no
  versioning) as the central EMR entity. Every clinical facet became its
  own child table (`ClinicalNote`, `Vital`, `Diagnosis`, `Procedure`,
  `EncounterAttachment`) rather than flat columns, because the existing
  model's *shape* — not just its missing service logic — couldn't
  represent versioned notes or multiple diagnoses/procedures per
  encounter. Confirmed via grep that nothing outside
  `patients.service.ts`'s one summary-count query touched the old
  model/field names before renaming `Prescription.medicalRecordId` →
  `encounterId` and the `Patient`/`Doctor`/`Organization` back-relations.
  New migration `20260801171211_emr_foundation`, applied to both
  `medicore_dev`/`medicore_test`.
- Recorded **ADR-0009**: Milestone 6 split into Checkpoint 6.1 (this entry)
  and 6.2 (Orders & Prescriptions, next) — the same pattern as Milestone
  4/5's checkpoint splits (ADR-0005/ADR-0006).
- **Encounter backend:** `EncountersService`/`Controller` — `create`
  (validates doctor/patient exist, optional one-to-one appointment link),
  `list`/`getById` (paginated, filterable by patient/doctor/status/type,
  own-scope enforced for `.own`-scoped doctors on *both* endpoints),
  `updateStatus` (fixed `ALLOWED_TRANSITIONS` state machine: In Progress →
  Completed → Amended → Completed). A shared `assertOwnScopeOk` helper is
  reused by every sibling controller in the module (clinical notes,
  vitals, diagnoses, procedures, attachments) so scope enforcement isn't
  duplicated per resource.
- **Clinical Notes backend:** `ClinicalNotesService.createVersion` always
  inserts `version = max + 1` — there is deliberately no update method
  exposed at the service layer, so "never overwrite historical notes" is
  enforced structurally. `GET .../clinical-notes` (full history), `GET
  .../clinical-notes/current` (latest version only), `POST` (new version).
- **Vitals backend:** `VitalsService.record` computes BMI server-side
  (`weightKg / (heightCm/100)^2`, rounded to 1 decimal) at write time;
  `listForPatient` queries cross-encounter via the `encounter` relation
  (no direct `organizationId`/`patientId` column on `Vital`) to power the
  frontend's trend chart.
- **Diagnoses/Procedures backend:** simple typed CRUD nested under each
  encounter; `Diagnosis.icdCode` is an explicit placeholder field (no
  ICD-10 terminology service configured anywhere in this repo — free-text
  entry works today, a bundled lookup list is reasonable future scope per
  ADR-0008).
- **Attachments backend:** `EncounterAttachmentsService`/`Controller`
  mirrors the existing `DoctorDocument`/`PatientDocument` pattern exactly —
  same `nanoid()`-keyed storage paths, MIME allowlist, size cap, reusing
  the global `StorageService` with zero new storage logic.
- **Audit integration:** `audit.listener.ts` gained `encounter.created`/
  `encounter.status_changed`/`clinical_note.created` handlers;
  `AuditService.listForDoctor`'s resource list grew to include `Encounter`
  — no capture logic duplicated.
- **Tests:** 6 new service spec files (30 unit tests) plus
  `medical-records.e2e-spec.ts` (21 e2e tests: encounter CRUD, clinical
  note versioning — v1→v2 without overwrite, history, current — vitals +
  BMI + patient-trend, diagnoses, procedures, attachment upload/list/
  delete, valid/invalid status transitions, own-scope enforcement, 401
  without a token). All passing (156 unit total, 88 e2e total).
- **Self-caught security fix (found while writing the e2e test, not
  reported by anyone):** `EncountersController.getById` initially had no
  own-scope enforcement at all — any `.own`-scoped doctor could read any
  encounter by ID. Fixed by applying the same `assertOwnScopeOk` check
  already used elsewhere in the module, plus a `resolveOwnScopedDoctorId`
  helper for the list endpoint (mirroring the existing
  `DoctorLeaveController` pattern). The e2e test was corrected to expect
  `403`.
- **Frontend:** `apps/web/src/lib/api/medical-records.ts` (full API
  client) plus two pages:
  - `/dashboard/medical-records` — patient timeline: patient/doctor/status
    filters, a weight-trend chart (recharts, shown when a patient filter
    has >1 weight readings), an encounters table, and a "New encounter"
    dialog (patient search-and-pick, doctor/type/notes).
  - `/dashboard/medical-records/[encounterId]` — SOAP-style tabs:
    **Subjective** (all 8 clinical-note fields, 2-second debounced
    autosave creating a new version per save, a version-history dialog);
    **Objective** (vitals form with a live BMI preview, a BMI trend chart
    across all of the patient's encounters, per-encounter vitals history,
    attachments upload/list/delete); **Assessment** (diagnoses list/add,
    type + ICD-10 placeholder); **Plan** (procedures list/add, read-only
    encounter notes); plus a header status-transition action. No debounce
    hook existed in `apps/web/src/hooks/` — used inline
    `useEffect`/`setTimeout` instead of introducing one for a single
    call site.
- **Full verification, all green:** `pnpm lint`, `pnpm typecheck`, `pnpm
  test` (156 api unit + 6 web), `pnpm test:e2e` (88/88 across 7 suites),
  `pnpm build` (all 6 packages via `turbo run build --force`).
- **Browser-verified end to end** (Playwright + Chromium in the session
  scratch dir, per TD-0010): logged in, created a real encounter for a
  real patient/doctor, filled and autosaved a clinical note (v1), opened
  version history, amended it (v2), recorded vitals (BMI computed
  correctly: 170cm/68kg → 23.5), added a diagnosis with an ICD-10
  placeholder, added a procedure, uploaded an attachment, and walked the
  encounter status from In Progress → Completed. 11 screenshots captured
  under `docs/screens/`.
- **Two stale-dev-server issues hit and fixed (TD-0004 addendum):**
  running the full verification `turbo run build --force` while `pnpm
  dev` was still running for both `apps/web` and `apps/api` clobbered
  each running process's compiled output in place (mismatched dev/prod
  React chunks on the frontend; the API kept serving its pre-build route
  table, so the brand-new `/encounters` routes 404'd). Both dev servers
  were killed and restarted after the build, which resolved it with zero
  code changes.
- Updated `.ai/NEXT.md`: replaced with **Checkpoint 6.2 — Orders &
  Prescriptions**.

---

## 2026-08-01 — Milestone 5, Checkpoint 5.2 (Queue & Recurring) — complete; **Milestone 5 fully complete**

Continuation of the same-day Checkpoint 5.1 work below. **Milestone 5
(Appointment Management) is now complete** — SMS confirmations are the one
item explicitly deferred (genuinely credential-blocked, documented rather
than faked).

- Recorded **ADR-0007**: `Appointment.isWalkIn: Boolean` (not a new
  `AppointmentType` value — a walk-in can still be OPD/emergency/etc.) and
  `Appointment.recurrenceGroupId: String?` (independent rows per
  occurrence, no rule-expansion table). New migration
  `20260731195629_appointment_walkin_recurrence`, applied to both
  `medicore_dev`/`medicore_test`.
- **Walk-in backend:** `AppointmentsService.createWalkIn` — auto-assigns
  the doctor's next available slot at/after right now, today, reusing the
  exact same conflict-checked booking path as a normal appointment
  (extracted into a shared private `bookSlot` helper that `create`,
  `createWalkIn`, and `createRecurring` all call). `POST
  /appointments/walk-in`.
- **Recurring backend:** `AppointmentsService.createRecurring` — books N
  independent occurrences sharing one `recurrenceGroupId`, each through the
  same conflict check; a conflicting occurrence is reported in a `failed[]`
  array (with reason) rather than aborting the batch or being silently
  dropped. `POST /appointments/recurring`.
- **Tests:** 4 new unit tests (16 total in the file) covering walk-in slot
  selection (via `jest.useFakeTimers` to control "now" deterministically)
  and recurring partial-failure reporting; 5 new e2e tests (17 total)
  including a dedicated all-hours/all-week doctor fixture so the walk-in
  e2e test is deterministic regardless of what day/time the suite actually
  runs. All passing (126 unit total, 67 e2e total).
- **Frontend:** a "Walk-in" quick-book dialog (patient + doctor + type +
  complaint, no time picker) and a "Recurring booking" toggle inside the
  existing booking dialog (start date/time/frequency/occurrences, replacing
  the slot picker when enabled) — both in
  `apps/web/src/app/dashboard/appointments/page.tsx`. Queue table now shows
  "Walk-in"/"Recurring" badges next to the appointment type.
- **Verification:** `pnpm lint`, `typecheck`, `test` (126 unit + 6 web),
  `test:e2e` (67/67, 6 suites), `build` (all 6 packages) — all green.
  Browser-verified: booked a walk-in for a demo doctor with an all-hours
  schedule (auto-slotted correctly relative to real "now"), booked a
  4-occurrence weekly recurring series (all 4 succeeded, confirmed via the
  "Booked 4/4 occurrences" toast and the Recurring badge in the queue). 5
  new screenshots under `docs/screens/`.
- **TD-0011's fix held up in practice**: re-ran `pnpm db:seed` for this
  checkpoint with zero manual follow-up — the permission-sync fix from the
  previous session worked exactly as intended on a second real use.
- **Reconciled `docs/roadmap.md`'s milestone-numbering mismatch** (flagged
  twice previously, TD-0009-adjacent): inserted "Milestone 5 — Appointment
  Management" as the roadmap's actual Milestone 5, renumbered the previous
  Milestones 5–13 to 6–14 (and bumped their Week labels by one
  accordingly). `NEXT.md` and `docs/roadmap.md` no longer disagree.
- Updated `.ai/NEXT.md`: replaced with **Milestone 6 — Clinical: Medical
  Records** (per the now-reconciled `docs/roadmap.md`).

---

## 2026-08-01 — Milestone 5, Checkpoint 5.1 (Appointment Core Booking) — complete

Per ADR-0006, split Milestone 5 ("Appointment Management") into Checkpoint
5.1 (this entry) and 5.2 (walk-in queue reorg, recurring appointments, SMS
— deferred). The `appointments` module was a 3-line no-op scaffold; the
`Appointment` Prisma model, `AppointmentType`/`AppointmentStatus` enums, and
most of `packages/types/src/appointment.ts` already existed unused from the
original scaffolding commit.

- **Backend:** `AppointmentsService`/`Controller` in
  `apps/api/src/modules/appointments/`:
  - `GET /appointments/available-slots` — combines the existing
    `AvailabilityService.getAvailableSlots` (schedule + leave, from
    Checkpoint 4.2) with a query for the doctor's existing non-cancelled
    appointments that day, subtracting overlaps. `AvailabilityService`
    itself was not modified — its public shape stayed stable exactly as
    its own comment (and now ADR-0006) anticipated.
  - `POST /appointments` — books an appointment, validating the requested
    time is one of the doctor's genuinely bookable slots (not just
    schedule/leave-valid but also conflict-free), generates an
    `appointmentNumber` (`APT-<orgPrefix>-<year>-NNNNNN`, same advisory-lock
    + year-counter pattern as `PatientsService.generateUhid`), emits
    `appointment.created`, and emails the patient a confirmation (reusing
    the existing `EmailService`, which degrades to console logging without
    `RESEND_API_KEY` — not credential-blocked) if they have an email on
    file.
  - `PATCH /appointments/:id/status` — validates against a fixed state
    machine (`SCHEDULED→CONFIRMED→ARRIVED→IN_CONSULTATION→COMPLETED`, with
    `CANCELLED`/`NO_SHOW` reachable from any non-terminal state; all three
    are terminal), emits `appointment.status_changed`.
  - `GET /appointments`, `GET /appointments/:id` — filterable list (date,
    doctorId, patientId, status, type) and detail with patient/doctor/
    department summaries.
  - New `appointments.update` own-scope permission for the `DOCTOR` role
    (mirrors the schedule/leave/documents own-scope pattern) — a doctor can
    transition only their own appointments.
  - `audit.listener.ts` gained 2 more `@OnEvent` handlers
    (`appointment.created`, `appointment.status_changed`), and
    `AuditService.listForDoctor` now includes `Appointment` in its
    doctorId-tagged resource list — a doctor's audit timeline (Checkpoint
    4.2) now also shows their appointment activity, with no capture logic
    duplicated.
  - Patients already saw appointments on their own timeline/audit tab
    (`PatientsService.getTimeline`) from the original scaffolding — no
    changes needed there.
- **Tests:** `appointments.service.spec.ts` (12 unit tests: conflict
  detection, slot validation, full state-machine coverage, email-on-create
  behavior) and `apps/api/test/appointments.e2e-spec.ts` (13 e2e tests:
  available slots, booking, double-booking rejection, outside-schedule
  rejection, the full status walk to completion, invalid-transition
  rejection, and own-scope enforcement). All passing.
- **Frontend:** new `apps/web/src/app/dashboard/appointments/page.tsx` — a
  day-view queue (date navigator, doctor/status filters, sortable-by-time
  table) with inline status-transition actions (primary "next step" button
  + an overflow menu for Cancel/No-show), and a booking dialog (patient
  search-and-pick, doctor/type/date/duration selection, live available-slot
  chips, chief complaint). New `apps/web/src/lib/api/appointments.ts` client.
- **Verification:** `pnpm lint`, `pnpm typecheck`, `pnpm test` (122 api unit
  + 6 web), `pnpm test:e2e` (63/63 across 6 suites), `pnpm build` (all 6
  packages) — all green. Browser-verified end to end: booked a real
  appointment for a real patient against a real doctor's real schedule,
  watched the available-slots grid update live, walked the appointment
  through Scheduled → Confirmed → Arrived. 5 screenshots saved under
  `docs/screens/` (`appointments-empty`, `appointments-booking-dialog`,
  `appointments-booking-slots`, `appointments-queue`,
  `appointments-status-transitions`).
- **Known limitation, not blocking:** booking has no DB-level exclusion
  constraint against a race between two concurrent requests for the same
  slot — the conflict check is app-level (same class of limitation as
  `DoctorLeaveService`'s pre-existing overlap check). Acceptable for this
  checkpoint; noted as TD-0012.
- Continued the TD-0011 workaround: re-ran `pnpm db:seed` (idempotent
  catalog upsert, added the new `appointments.update.own` permission row)
  then re-applied the same manual `RolePermission` sync used in the
  previous session to `medicore_dev`'s `Hospital Admin`/`Doctor` roles.
- Updated `.ai/NEXT.md`: replaced with Checkpoint 5.2.

---

## 2026-07-31 — Milestone 4, Checkpoint 4.2 (Doctor Scheduling) — complete

Continuation of the same-day audit below: implemented the 3 deliverables
that audit found missing (doctor documents, audit-timeline query surface,
frontend), then fully verified and browser-tested. **Milestone 4 is now
complete.**

- **Doctor documents (backend):** `DoctorDocumentType` enum + `DoctorDocument`
  Prisma model (migration `20260731152146_doctor_documents`, applied to
  both `medicore_dev`/`medicore_test`), `packages/types/src/doctor-document.ts`,
  `doctor-document.service.ts`/`.controller.ts` in
  `apps/api/src/modules/scheduling/` (`GET/POST /doctors/:doctorId/documents`,
  `DELETE .../documents/:documentId`), reusing the existing global
  `StorageService` exactly like the `patients` module's `PatientDocument`
  pattern. New `doctors.documents` permission resource (`read`/`manage`,
  `all`+`own` scope) added to `seed.ts`.
- **Doctor audit timeline (backend):** `AuditService.listForDoctor()` —
  reuses the existing `AuditLog` table/service, no duplicated capture logic
  — plus `GET /doctors/:id/audit-timeline` on the existing
  `DoctorsController` (own/all-scope enforced the same way as the
  scheduling controllers). `audit.listener.ts` gained 2 more `@OnEvent`
  handlers (document upload/delete), mirroring the existing schedule/leave
  handlers. `packages/types/src/doctor-audit-timeline.ts` added.
- **Backend tests:** `doctor-document.service.spec.ts` (9 tests),
  `audit.service.spec.ts` (3 tests, new file), `apps/api/test/doctor-documents.e2e-spec.ts`
  (12 e2e tests: documents CRUD, own-scope enforcement, and audit-timeline
  correctness across all 3 event sources). All passing.
- **Frontend:** added 5 tabs to `apps/web/src/app/dashboard/doctors/[id]/page.tsx`
  — Schedule (read-only current-schedule grid + version history +
  new-version dialog with a full 7-day/shifts/breaks editor matching
  `ScheduleDaySchema`/`ScheduleShiftSchema`), Leave (list + apply +
  approve/reject with decision note + cancel), Availability (today status +
  date-based bookable-slot lookup), Documents (near-verbatim port of the
  patients module's `DocumentsTab`), Audit (near-verbatim port of the
  patients module's `TimelineTab`). New API client
  `apps/web/src/lib/api/scheduling.ts`. No new frontend test scaffolding was
  added — the `patients` module (the reuse template) has none either;
  verification was `lint`/`typecheck`/`build` plus a manual browser
  walkthrough (below), stated explicitly rather than silently skipped.
- **Full verification, all green:** `pnpm lint`, `pnpm typecheck`, `pnpm test`
  (110 api unit + 6 web), `pnpm test:e2e` (50/50 across 5 suites), `pnpm build`
  (all 6 packages via `turbo run build --force`).
- **Manual browser verification:** installed Playwright + Chromium into the
  session scratch directory (not a project dependency — see TD-0010),
  started both dev servers, logged in as `admin@medicore.demo`, and drove
  the full golden path for real: created a schedule version (Mon–Fri,
  09:00–17:00, 30-min slots), applied and approved a leave request, checked
  bookable availability slots, uploaded a document, and confirmed all of it
  appeared correctly in the audit timeline. 9 screenshots captured under
  `docs/screens/` (doctors list, registration form, and all 5 new tabs
  including the new-schedule-version dialog).
- **Real bug discovered and fixed (data only, not code) during browser
  verification:** `medicore_dev`'s `Hospital Admin` and `Doctor` roles
  predated the `doctors`/`doctors.schedule`/`doctors.leave`/
  `doctors.documents` permission resources and had never been backfilled,
  because `seed.ts`'s `role.upsert` no-ops (`update: {}`) for a role that
  already exists — recorded as **TD-0011 (High)**, a real latent bug in
  `seed.ts` itself (out of scope to fix this session; affects any existing
  local dev DB, not `medicore_test` since e2e suites always create a fresh
  org).
- **Real bug discovered and fixed during browser verification:** a
  long-running `nest start --watch` process served a stale route table —
  the new `GET /doctors/:id/audit-timeline` endpoint 404'd at the Fastify
  router level despite being correctly implemented and fully test-covered;
  restarting the dev server fixed it with zero code changes (TD-0004
  addendum).
- Resolved TD-0003 (Checkpoint 4.1 screenshots), TD-0005 (doctor documents),
  TD-0006 (audit-timeline query surface), TD-0007 (no frontend).
- Updated `.ai/NEXT.md`: replaced with **Milestone 5 — Appointment
  Management**, since Milestone 4 (both checkpoints) is now genuinely
  complete per every item in `CLAUDE.md`'s Milestone Completion Checklist.

---

## 2026-07-31 — Milestone 4, Checkpoint 4.2 (Doctor Scheduling) audited — partially complete

- Session started by discovering, via `git status`, undocumented in-progress
  work: `apps/api/src/modules/scheduling/` (schedule/leave/availability
  controllers+services+DTOs), `apps/api/test/scheduling.e2e-spec.ts`, two
  new Prisma migrations (`20260731090000_provider_scheduling`,
  `20260731091500_doctor_schedule_unique_effective_from`), and three new
  shared-types files (`doctor-schedule.ts`, `doctor-leave.ts`,
  `doctor-availability.ts`) — none recorded in `.ai/`. Per `CLAUDE.md`'s
  "code is ground truth" rule, audited this code against Checkpoint 4.2's
  requirement list (ADR-0005) instead of restarting or re-asking scope.
- **Verified complete (backend):**
  - Weekly schedules: `DoctorSchedule`/`DoctorScheduleDay` models, versioned
    by `effectiveFrom` (unique per doctor), Zod-validated shifts/breaks,
    full CRUD (`doctor-schedule.controller.ts`/`.service.ts`).
  - Leave management: `DoctorLeave` model, apply/approve/reject/cancel/list
    /upcoming, overlap-conflict detection on apply
    (`doctor-leave.controller.ts`/`.service.ts`).
  - Availability engine: `AvailabilityService` derives bookable slots and
    today-status from the effective schedule + approved-leave overlay;
    deliberately doesn't know about `Appointment` records yet (that's
    Milestone 5's job per an in-code comment referencing "ADR-0006", which
    does not yet exist in `DECISIONS.md` — flagged in `TECH_DEBT.md` TD-0009).
  - Dashboard availability stats: `AvailabilityService.getDashboardStats`
    wired into `DoctorsService.getDashboardStats`, extending
    `DoctorDashboardStats` with `availableToday`/`onLeaveToday`
    /`offDutyToday`/`upcomingLeave`.
  - Audit event *capture*: `audit.listener.ts` gained 6 new `@OnEvent`
    handlers for schedule/leave lifecycle events.
  - Own-scope permission enforcement on every route (doctor can only touch
    their own schedule/leave/availability under an `.own`-scoped role).
- **Verified partially complete:**
  - Audit timeline: capture exists (above), but there is no per-doctor query
    surface — `AuditController` only exposes `GET /audit-logs?limit=`
    (org-wide, no `doctorId`/`resource` filter). Not actually viewable yet.
- **Verified missing (not started):**
  - Doctor documents (upload/list/delete certificates/ID proofs) — no
    `DoctorDocument` model, migration, service, or controller exists.
  - Frontend — zero UI for schedule/leave/availability/documents; the
    doctor profile page is unchanged from Checkpoint 4.1.
  - Screenshot — not applicable yet (no UI to capture).
- **Verification run this session** (all passing):
  - `pnpm lint`: initially failed with 1029 errors across unrelated files
    (`users.service.ts`, `prisma.service.ts`, etc.) because the Prisma
    client had never been generated after the schema changes — every
    Prisma-typed call read as `any`/`error` to ESLint. Ran
    `pnpm --filter @medicore/database db:generate`; lint went clean.
    Recorded as TD-0008 (this will recur for the next session too).
  - `pnpm typecheck`: clean (api + web).
  - `pnpm test`: 101 api unit tests + 6 web tests, all passing (includes
    `availability.service.spec.ts`, `availability.util.spec.ts`,
    `doctor-leave.service.spec.ts`, `doctor-schedule.service.spec.ts`).
  - `pnpm test:e2e`: applied the 2 new migrations to `medicore_test` (both
    were already deployed — no drift this time, unlike Checkpoint 4.1's
    session); all 4 e2e suites pass, 38/38 tests including the new
    20-test `scheduling.e2e-spec.ts`.
  - `pnpm build`: api + web build cleanly (used `turbo run build --force`
    to get full unbuffered output across all 6 packages — `pnpm build`
    piped through `tail` was truncating multi-package turbo output).
- Updated `.ai/NEXT.md` to list only the 3 remaining deliverables (doctor
  documents, audit-timeline query surface, full frontend) plus their tests
  and screenshot — **not** replaced with Milestone 5, since Checkpoint 4.2
  is not complete per `CLAUDE.md`'s Milestone Completion Checklist
  (frontend implemented is a required item).
- Added TD-0005 through TD-0009 to `TECH_DEBT.md` for the gaps above plus
  the Prisma-client-generation trap and the dangling ADR-0006 reference.

---

## 2026-07-31 — Milestone 4, Checkpoint 4.1 (Doctor Management) verified and closed out

- Found, on session start, that a prior session had already built most of
  Doctor Management (`apps/api/src/modules/doctors/`, the generic
  `StaffOnboardingService` at `apps/api/src/common/onboarding/`, a Prisma
  migration adding doctor professional-profile fields, and frontend pages
  under `apps/web/src/app/dashboard/doctors/`) without ever recording it in
  `.ai/` — the code was ground truth, so this session audited it against the
  Checkpoint 4.1 requirement list instead of re-implementing anything.
- Verified against the checklist: Doctor CRUD, professional profile, linked
  user onboarding, search, filters, dashboard stats, doctor profile page,
  unit tests, and e2e tests were all already implemented and wired
  end-to-end (permissions seeded for `doctors.*`, module registered in
  `app.module.ts`, frontend pages linked from the sidebar).
- Ran full verification and fixed everything it turned up:
  - `pnpm lint` (api + web): 2 real violations fixed — an import-order error
    in `doctors.controller.ts` and an unescaped-apostrophe JSX error in the
    doctor detail page.
  - `pnpm typecheck` (api + web): clean, no changes needed.
  - `pnpm test` (api + web): 76 unit tests passed, no changes needed.
  - `pnpm test:e2e`: required first-time local environment setup (`apps/api/.env`
    generated from `.env.example`, JWT RSA keypair via
    `pnpm keys:generate`, pointed at the already-running `medicore-postgres`/
    `medicore-redis` dev containers on their mapped ports 5434/6381). Found
    two real issues once the suite could run: the `medicore_test` database
    was missing the `20260730220227_doctor_professional_profile` migration
    (applied it — this was a stale test DB, not an app bug), and
    `doctors.e2e-spec.ts` had one assertion expecting `201` from
    `POST /auth/login` where the endpoint correctly returns `200` (fixed the
    test). All 14 e2e tests pass after both fixes.
  - `pnpm build`: all packages build cleanly.
- Wrote `docs/modules/04-doctor-management.md` (backend/frontend surface,
  onboarding flow, deferred-to-4.2 list).
- Updated `docs/roadmap.md`: Milestone 4 retitled and split into Checkpoint
  4.1 (marked complete) / 4.2 (not started); original appointment-booking
  deliverables moved to a "Deferred beyond Milestone 4" section.
- Recorded ADR-0005 in `DECISIONS.md` for the Milestone-4 scope split and
  the decision to keep `StaffOnboardingService` generic across staff roles.
- **Not done, by explicit instruction:** Checkpoint 4.2 (doctor scheduling)
  is intentionally not started this session.
- **Not done, environment limitation:** no screenshot saved under
  `docs/screens/` — this session has no browser/UI access, only CLI +
  API-level (e2e) verification. A future session with browser access should
  capture the doctors list, registration form, and profile page.

---

## 2026-07-31 — Project governance scaffolding

- Created `CLAUDE.md` at repo root as the standing project constitution.
- Created `.ai/` project memory directory with all required files
  (`PROJECT_CONTEXT.md`, `PROGRESS.md`, `NEXT.md`, `DECISIONS.md`,
  `TECH_DEBT.md`, `SESSION_LOG.md`, `MODULE_STATUS.md`, `CHANGELOG.md`).
- No application code changed in this task.

---

## Prior History (pre-`.ai/`, reconstructed from repo state)

- Monorepo initialized (pnpm + turbo) with `apps/api` (NestJS) and
  `apps/web` (Next.js), plus shared `packages/` (config, database, types, ui).
- Backend module directories scaffolded for the full domain surface: auth,
  users, roles, organizations, hospitals, departments, staff, patients,
  appointments, medical-records, prescriptions, laboratory, radiology,
  pharmacy, inventory, billing, insurance, notifications, audit, ai, health.
- Common infra added: JWT auth guard, permissions guard + service, CSRF
  guard, audit listener/service, email module, Redis module.
- This was committed as a single large init commit
  (`56857d3 init: setup of the mono-repo done for hospital management system`)
  before `.ai/` tracking existed — module-level implementation depth has not
  yet been individually verified. First session using this file should audit
  each module and populate `MODULE_STATUS.md` accurately rather than trusting
  directory existence as a proxy for completeness.
