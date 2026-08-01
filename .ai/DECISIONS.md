# DECISIONS.md

> Architectural decision log (ADR-style). Before asking the user an
> architecture question, check here first — if a decision already exists,
> follow it without asking again. Add a new entry whenever a real
> architectural choice is made (not for routine implementation details).

Format per entry:

```
## ADR-NNNN: <Title>
Date: YYYY-MM-DD
Status: Accepted | Superseded by ADR-XXXX | Deprecated

Context: why this decision was needed
Decision: what was decided
Consequences: tradeoffs accepted
```

---

## ADR-0001: Monorepo with pnpm workspaces + Turborepo

Date: 2026-07-31 (recorded retroactively; original decision predates `.ai/`)
Status: Accepted

**Context:** Backend (NestJS) and frontend (Next.js) share types, database
client, and UI primitives; independent repos would duplicate config and drift.

**Decision:** Single pnpm-workspace monorepo, orchestrated with Turborepo,
with `apps/api`, `apps/web`, and shared `packages/{config,database,types,ui}`.

**Consequences:** Single CI pipeline and versioning; requires discipline to
keep `packages/*` genuinely shared rather than backend- or frontend-specific.

---

## ADR-0002: NestJS modular-by-domain backend structure

Date: 2026-07-31 (recorded retroactively)
Status: Accepted

**Context:** Hospital domain has many bounded contexts (patients, billing,
pharmacy, lab, radiology, etc.) that need independent evolution.

**Decision:** One NestJS module per domain under `apps/api/src/modules/`,
with cross-cutting concerns (auth, permissions, audit, email, redis) in
`apps/api/src/common/`.

**Consequences:** Clear ownership boundaries per module; requires care that
shared logic doesn't get duplicated across modules instead of living in
`common/`.

---

## ADR-0003: Permission-based authorization, not just role-based

Date: 2026-07-31 (recorded retroactively, inferred from code)
Status: Accepted

**Context:** `roles.decorator.ts` and `roles.guard.ts` were removed in favor
of `permissions.decorator.ts` and `permissions.guard.ts`, backed by a
`PermissionsModule`/`PermissionsService`.

**Decision:** Authorization is enforced via fine-grained permissions rather
than coarse roles, even though the product still exposes roles (Admin,
Doctor, Nurse, Receptionist, Lab Tech, Pharmacist) at the UX level.

**Consequences:** More flexible access control (e.g. a custom role can be
composed of specific permissions) at the cost of more setup per new
protected route. New endpoints must use `@Permissions(...)` +
`PermissionsGuard`, not a role check.

---

## ADR-0004: `.ai/` project memory + `CLAUDE.md` constitution adopted

Date: 2026-07-31
Status: Accepted

**Context:** Multi-session AI-assisted development risks losing context,
re-litigating settled decisions, and drifting on code quality standards
between sessions.

**Decision:** Adopt `CLAUDE.md` as the standing constitution for all Claude
Code sessions in this repo, backed by a `.ai/` directory
(`PROJECT_CONTEXT.md`, `PROGRESS.md`, `NEXT.md`, `DECISIONS.md`,
`TECH_DEBT.md`, `SESSION_LOG.md`, `MODULE_STATUS.md`, `CHANGELOG.md`) that
every session must read before making changes and update after every
completed task.

**Consequences:** Slight overhead per task (must update several files), in
exchange for continuity, no repeated architecture debates, and an accurate
completion picture at all times.

---

## ADR-0005: Milestone 4 redefined as Doctor Management, split into two checkpoints

Date: 2026-07-31
Status: Accepted

**Context:** The original `docs/roadmap.md` Milestone 4 was "Appointments &
Scheduling." A prior (undocumented-in-`.ai/`) session had already built a
substantial Doctor Management feature — `apps/api/src/modules/doctors/`,
`apps/api/src/common/onboarding/staff-onboarding.*`, a Prisma migration
adding doctor professional-profile fields, and frontend pages under
`apps/web/src/app/dashboard/doctors/` — as groundwork for appointments
(you need doctors before you can schedule them). The user asked to reduce
scope per session and formalize this as Milestone 4's actual content.

**Decision:** Milestone 4 is redefined as "Doctor Management & Scheduling,"
split into:
- **Checkpoint 4.1 — Doctor Management:** CRUD, professional profile,
  linked-user onboarding, search/filters, dashboard stats, profile page,
  tests, docs.
- **Checkpoint 4.2 — Doctor Scheduling:** weekly schedules, leave
  management, availability, dashboard availability stats, doctor documents,
  audit timeline, remaining tests.

Only one checkpoint is implemented per session. Patient-facing appointment
*booking* (slot generation, conflict detection, booking flow, status
machine, calendar UI) remains deferred beyond Milestone 4 — see
`docs/roadmap.md`.

The generic `StaffOnboardingService` (`apps/api/src/common/onboarding/`)
is kept deliberately role-agnostic — it only handles the "create/link a
`User` + grant a role" half of onboarding and knows nothing about `Doctor`
specifically — so Nurse, Pharmacist, Lab Technician, Receptionist, and other
future staff-profile modules can call it as-is instead of reimplementing
account provisioning per role.

**Consequences:** `docs/roadmap.md`'s Milestone 4 section no longer matches
its original Week-5 scope; appointment booking work that was implicitly
"Milestone 4" is now unscheduled until a later milestone is defined. Doctor
scheduling (4.2) must not introduce new schema beyond what's needed for its
own checkpoint — the existing `Doctor.availabilitySlots` JSON field and
`DoctorAvailabilityStatus` enum (already in the schema from Checkpoint 4.1's
migration) are reserved for 4.2 rather than extended speculatively now.

---

## ADR-0006: Appointment booking reuses `AvailabilityService` directly; Milestone 5 split into two checkpoints

Date: 2026-08-01
Status: Accepted

**Context:** `availability.service.ts`'s top-of-file comment (written during
Checkpoint 4.2) already anticipated this: *"Deliberately does NOT know about
Appointment records yet — appointment-conflict subtraction is Milestone 5's
job... The public shape (`getAvailableSlots(organizationId, doctorId, date,
duration)`) is meant to stay stable across that addition."* This comment
referenced "ADR-0006" before one existed (flagged as TD-0009) — this entry
is that ADR. The `Appointment` Prisma model, `AppointmentType`/
`AppointmentStatus` enums, and most of `packages/types/src/appointment.ts`
(the `Appointment` interface, `CreateAppointmentSchema`, `TimeSlot`,
`AppointmentQuery`) already existed from the original scaffolding commit,
unused by any real service — `apps/api/src/modules/appointments/` was a
3-line no-op controller/service/module.

**Decision:**
1. **Slot generation is not reimplemented.** `AvailabilityService.getAvailableSlots`
   (schedule + leave, Checkpoint 4.2) remains the single source of bookable
   time; `AppointmentsService` calls it and additionally subtracts slots that
   overlap an existing non-cancelled `Appointment` for that doctor. This is
   the "appointment-conflict subtraction" the comment anticipated — added as
   a query in `AppointmentsService`, not a change to `AvailabilityService`'s
   public shape (confirming that design held).
2. **Milestone 5 ("Appointment Management") is split into two checkpoints,**
   mirroring Milestone 4's ADR-0005 precedent:
   - **Checkpoint 5.1 — Core booking:** conflict-aware booking (OPD/IPD/
     emergency/procedure), the full status state machine (scheduled →
     confirmed → arrived → in-consultation → completed, plus cancelled/
     no-show from any pre-completion state), email confirmation (reusing the
     existing `EmailService`, which already degrades to console logging
     without `RESEND_API_KEY` — not credential-blocked), audit-timeline
     integration, and frontend (day-view list/calendar, booking form, status
     actions).
   - **Checkpoint 5.2 — deferred:** a dedicated walk-in queue UI/flow (5.1's
     list view already shows today's appointments in queue order, but a
     distinct walk-in-without-prior-booking flow is separate), recurring
     appointments, and SMS confirmations (genuinely credential-blocked —
     no SMS provider is configured anywhere in this repo, unlike email).
3. **Status transitions are validated server-side** against a fixed
   adjacency map (not a generic "any status to any status" PATCH) —
   `SCHEDULED→CONFIRMED→ARRIVED→IN_CONSULTATION→COMPLETED`, with
   `CANCELLED`/`NO_SHOW` reachable from any non-terminal state. `COMPLETED`,
   `CANCELLED`, `NO_SHOW` are terminal.

**Consequences:** Booking depends on the scheduling module (`SchedulingModule`
imported into `AppointmentsModule`) the same way `DoctorsModule` already
does. A doctor can transition/cancel only their own appointments under an
`.own`-scoped role (new `{ resource: 'appointments', action: 'update',
scope: 'own' }` grant), mirroring the schedule/leave own-scope pattern
exactly. SMS and a dedicated walk-in flow remain explicitly unscheduled
until 5.2 or later.

---

## ADR-0007: Walk-in is a flag, not a type; recurring bookings are independent rows sharing a group id

Date: 2026-08-01
Status: Accepted

**Context:** Checkpoint 5.2 needed a dedicated walk-in flow and recurring
appointments. Two design choices weren't dictated by any existing pattern:
whether "walk-in" should be its own `AppointmentType` value or an
orthogonal flag, and how a recurring booking's multiple occurrences should
relate to each other in the data model.

**Decision:**
1. **`Appointment.isWalkIn: Boolean`**, not a new `WALK_IN` enum value on
   `AppointmentType`. A walk-in can still be OPD, emergency, a procedure,
   etc. — conflating "how it was booked" with "what kind of visit it is"
   would have made `type` do two jobs. A walk-in still gets a real
   `scheduledAt`: the booking flow auto-assigns the doctor's next available
   slot today (falling back to the next slot after "now" if already mid-shift,
   or the day's first slot if before opening) rather than requiring the
   receptionist to browse the full slot picker — it reuses the exact same
   conflict-checked booking path as a normal appointment, just with the
   slot chosen automatically instead of by the user.
2. **`Appointment.recurrenceGroupId: String?`**, nullable, no separate
   "recurrence rule" table. A recurring booking request creates N
   independent `Appointment` rows up front (not a template + generator),
   each conflict-checked individually via the same booking path, sharing
   one generated group id. Occurrences that lose a conflict are reported as
   failed, not silently skipped — the caller gets back both the booked list
   and the failed list with reasons. This trades some storage (materializing
   every future occurrence immediately) for simplicity: no background job,
   no "expand the recurrence rule at read time" logic, and cancelling/
   viewing "the whole series" is just `WHERE recurrenceGroupId = X`.

**Consequences:** No support (yet) for editing a whole recurring series at
once (e.g. "change the time for all future occurrences") — each row is
independent once created. If that's needed later, `recurrenceGroupId`
already provides the grouping to build it on. SMS confirmations remain out
of scope entirely (no SMS provider configured anywhere in this repo —
genuinely credential-blocked, unlike email).

---

## ADR-0008: `Encounter` replaces the flat `MedicalRecord` scaffold; clinical facets are child tables, notes are append-only

Date: 2026-08-01
Status: Accepted

**Context:** Milestone 6, Checkpoint 6.1 required a production-grade EMR
foundation: encounters with a type/status, structured-and-versioned
clinical notes ("never overwrite historical notes"), vitals with trends,
multi-entry diagnoses (primary/secondary/differential), procedures, and
attachments. The existing `MedicalRecord` model (from the original
scaffolding commit, never built upon — `medical-records` module was a
3-line no-op like `appointments` was before Milestone 5) was a single flat
row per consultation: one `diagnosis: String`, one `vitalSigns: Json?`
blob, no versioning, no procedures, no attachments. It could not represent
what this checkpoint requires without becoming an unversioned, untyped
grab-bag — reusing it as-is (the way `Appointment`'s pre-existing schema
was reused in Milestone 5, unmodified) was not viable here since the
*shape* itself was insufficient, not just the missing service logic.

**Decision:**
1. **Replace `MedicalRecord` with `Encounter`** as the central EMR entity —
   one per consultation, created from a completed `Appointment`
   (`Encounter.appointmentId` unique, same relation shape as before, just
   renamed). Adds `type` (`EncounterType`: OPD/TELECONSULTATION/FOLLOW_UP/
   EMERGENCY/WALK_IN) and `status` (`EncounterStatus`: IN_PROGRESS/
   COMPLETED/AMENDED). This required renaming `Prescription.medicalRecordId`
   → `encounterId` and the back-relations on `Patient`/`Doctor`/
   `Organization` — checked first that nothing outside `patients.service.ts`'s
   one summary-count query touched the old model/field names (confirmed via
   grep), so the blast radius was contained to that one call site plus its
   test mock.
2. **Every clinical facet is its own child table**, not flat columns on
   `Encounter`: `ClinicalNote`, `Vital`, `Diagnosis` (one row per diagnosis,
   typed PRIMARY/SECONDARY/DIFFERENTIAL, so a patient can have several),
   `Procedure`, `EncounterAttachment` (mirrors the `PatientDocument`/
   `DoctorDocument` shape exactly, reusing `StorageService`).
3. **`ClinicalNote` is append-only.** An edit inserts a new row with
   `version = previous + 1`; the service layer never exposes an update —
   "never overwrite historical notes" is enforced structurally, not by
   convention. All 8 structured sections (chief complaint, HPI, PMH, family/
   surgical/social history, allergies, current medications) live on one
   versioned row together (one note "document" per version), not
   versioned independently per section — versioning the whole note as a
   unit is simpler and matches how a clinician actually edits (all sections
   in one sitting), and nothing in the spec calls for independent per-field
   history.
4. **ICD-10 is a placeholder field** (`Diagnosis.icdCode: String?`), not a
   validated lookup against a real terminology service — no ICD-10 dataset
   or API is configured anywhere in this repo. A small bundled seed list
   for search-as-you-type is reasonable future scope (lower-stakes than
   SMS, since it's a lookup aid not a communication channel) but is not
   implemented in 6.1; free-text entry is fully functional today.
5. **"Actor" references stay plain `String` columns** (`createdByUserId`,
   `recordedByUserId`) without a formal Prisma relation — matches the
   existing `DoctorLeave.appliedByUserId`/`decidedByUserId` convention
   already established in this codebase, not a new pattern.

**Consequences:** No data migration was needed (the old `MedicalRecord`
table had no real rows — same situation as `Appointment` before Milestone
5, confirmed before treating this as a "just extend it" case rather than a
redesign). RBAC reuses the existing `medical_records` permission resource
for all of `Encounter` and its child tables — one bounded context, one
permission, own-scope meaning "encounters where I'm the doctor" (same
own/all-scope pattern as `appointments.update.own`). Prescriptions/orders
(`Checkpoint 6.2`) will build on `Prescription.encounterId`.

---

## ADR-0009: Milestone 6 split into Checkpoint 6.1 (EMR Foundation) and 6.2 (Orders & Prescriptions)

Date: 2026-08-01
Status: Accepted

**Context:** `docs/roadmap.md`'s Milestone 6 bundles encounters/clinical
notes/vitals/diagnoses together with the prescriptions module, drug
interaction warnings, and PDF printing. Explicit instruction this session
scoped work to the EMR foundation only (Encounter, Clinical Notes, Vitals,
Diagnosis, Procedures, Attachments) and explicitly deferred prescriptions
to a follow-up checkpoint — the same "split a big roadmap milestone into
checkpoints when a session's scope is narrower than the whole milestone"
pattern already used for Milestone 4 (ADR-0005) and Milestone 5 (ADR-0006).

**Decision:** Milestone 6 ("Clinical: Medical Records") is split into:
- **Checkpoint 6.1 — EMR Foundation** (this session): Encounter,
  versioned Clinical Notes, Vitals, Diagnosis, Procedures, Attachments,
  full REST/Swagger/RBAC/audit/pagination/filtering, patient timeline +
  SOAP-style encounter detail frontend.
- **Checkpoint 6.2 — Orders & Prescriptions** (next): builds on
  `Prescription.encounterId` (already renamed under ADR-0008) —
  prescription CRUD from an encounter, drug interaction warnings (basic),
  print-as-PDF, and whatever medication-catalog lookup that needs.

**Consequences:** `docs/roadmap.md` is not renumbered this time (unlike
ADR-0006's Milestone 5 insertion) — Milestone 6 still names both
checkpoints' scope in one place; only `.ai/NEXT.md` tracks the
sub-checkpoint split. Milestone 6 as a whole is complete only once both
6.1 and 6.2 pass the Milestone Completion Checklist.

---

## ADR-0010: Prescriptions reuse the pre-existing `Prescription`/`PrescriptionItem` scaffold; basic bundled drug-interaction check; pdfkit for PDF generation

Date: 2026-08-01
Status: Accepted

**Context:** Checkpoint 6.2 required a Prescription module (create from an
encounter, basic drug interaction warnings, print-as-PDF). Unlike
`MedicalRecord` in Checkpoint 6.1 — whose shape genuinely couldn't
represent the EMR requirements — the original scaffolding commit's
`Prescription`/`PrescriptionItem` Prisma models (never built upon; the
`prescriptions` module was a 3-line no-op like `medical-records` and
`appointments` were before their respective milestones) already had the
right shape: `encounterId`, `patientId`, `doctorId`, a `notes` field, and
a child `PrescriptionItem` table with `medicationName`, `genericName`,
`strength`, `form`, `dosage`, `frequency`, `duration`, `route`,
`instructions`, `quantity`. Confirmed via `prisma.prescription.count()`
against `medicore_dev` that the table held zero rows before changing it.

**Decision:**
1. **Reuse the existing models as-is**, with one adjustment:
   `Prescription.status` was a plain `String @default("ACTIVE")` from the
   original scaffold (not yet built upon) — converted to a proper
   `PrescriptionStatus` enum (`ACTIVE`/`COMPLETED`/`DISCONTINUED`) via
   migration `20260801175600_prescription_status_enum`, matching the
   `EncounterStatus`/`AppointmentStatus` convention used everywhere else
   status is modeled in this codebase. `PrescriptionItem.route` stays a
   plain `String` (already had a sensible default and no cross-codebase
   status-machine expectations, so it wasn't converted).
2. **`prescriptions.*` is its own permission resource** (already seeded:
   `read`/`create`/`update`, `all` + `own` scope), not folded into
   `medical_records.*` — a prescription is a distinct clinically- and
   legally-significant document from a clinical note, and the seed catalog
   already modeled it separately since the original scaffolding commit.
   Own-scope enforcement follows the exact `assertOwnScopeOk` idiom from
   `EncountersService`, checking the prescription's own `doctorId`.
3. **Self-caught fix in `seed.ts`**: the `Doctor` role was never actually
   granted `medical_records.update` or `prescriptions.update` at `own`
   scope — meaning a real `DOCTOR`-role user could not transition their
   own encounter's status or their own prescription's status in the
   demo/dev environment, despite the API correctly supporting it (e2e
   tests didn't catch this because they grant permissions directly rather
   than through `seed.ts`'s `ROLE_SPECS`). Fixed by adding both grants to
   the `Doctor` role spec and its `OWN_SCOPE_PERMISSIONS` catalog entries.
4. **Basic, bundled drug-interaction check** (`drug-interactions.ts`): a
   small hardcoded list of well-known interaction pairs (warfarin+aspirin,
   etc.), matched case-insensitively by substring across the new
   prescription's items *and* the patient's other currently-`ACTIVE`
   prescriptions. This is explicitly advisory — it never blocks
   prescribing, and the API/frontend both label it "basic, non-exhaustive."
   No real drug-interaction terminology service is configured anywhere in
   this repo; connecting one is future scope, not faked here.
5. **PDF generation via `pdfkit`** (new dependency, `apps/api` only) —
   the only PDF library already in this repo's dependency tree was none,
   so `pdfkit` (pure-JS, no native deps, the standard lightweight choice
   for server-side Node PDF generation) was added. The controller streams
   the buffer directly via `@Res()`/`FastifyReply`, bypassing the
   response-transform interceptor (same pattern already used nowhere else
   in this codebase, but the only correct approach for binary output).

**Consequences:** No data migration risk (table was empty). Prescription
numbers follow the exact `RX-<orgPrefix>-<year>-NNNNNN` pattern as
`Appointment.appointmentNumber`, reusing the same advisory-lock +
year-counter approach. The interaction check's bundled list is a known,
documented limitation (see `TECH_DEBT.md`) — expanding or replacing it
with a real terminology service is explicitly out of scope for this
checkpoint.

---

## ADR-0011: Milestone 7 split into Laboratory Management (7) and Radiology Management (8); subsequent milestones renumbered

Date: 2026-08-01
Status: Accepted

**Context:** `docs/roadmap.md`'s Milestone 7 ("Laboratory & Radiology")
bundled two fairly independent sub-domains under one heading and week.
Explicit user instruction, given at the close of Milestone 6, asked to
narrow the next milestone to Laboratory only and push Radiology out to
its own follow-up milestone — a scope-narrowing decision (not merely a
checkpoint split within one milestone, since these are two separable
product areas with their own frontend queues and Prisma models) — rather
than the 4.1/4.2-style same-milestone checkpoint split used for Doctors,
Appointments, and Clinical: Medical Records.

**Decision:** `docs/roadmap.md` is renumbered:
- **Milestone 7 — Laboratory Management (Week 8):** lab test catalog, lab
  order creation from consultation, sample collection tracking, result
  entry + PDF upload, abnormal value flagging, lab result PDF generation,
  AI-powered lab report summarization, frontend lab order list/result
  entry form.
- **Milestone 8 — Radiology Management (Week 9)** (new): radiology order
  creation from consultation, radiology report upload/viewing, frontend
  radiology order queue.
- Former Milestones 8–14 (Billing & Insurance through Production
  Hardening) renumbered to 9–15, with Week labels bumped by one
  accordingly.

**Consequences:** `.ai/NEXT.md` targets **Milestone 7 — Laboratory
Management** next; Radiology becomes its own future milestone rather than
a deliverable folded into the same session as Laboratory. This is the
same "insert/split and renumber everything after" pattern already used in
ADR-0006 when Appointment Management was inserted as Milestone 5 — the
precedent for reconciling `docs/roadmap.md` after a scope change lands
mid-project rather than only at initial planning.
