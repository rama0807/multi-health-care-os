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

---

## ADR-0012: Milestone 7 schema/permission decisions — `LabTestCatalogItem` shape, `LabTest.encounterId`, and own-scope `laboratory.*` for Doctor

Date: 2026-08-02
Status: Accepted

**Context:** Milestone 7 (Laboratory Management) required two genuine
judgment calls beyond routine implementation, plus one gap-fix in the
pre-existing schema:

1. `LabTest` (from the original scaffolding commit, never built upon —
   `laboratory` module was a 3-line no-op like every other module before
   its milestone) had no `encounterId`, unlike `Prescription`
   (`encounterId String?` since Checkpoint 6.2). "Lab order creation from
   consultation" — an explicit scope item — requires this link.
2. No lab test catalog model existed at all. "Lab test catalog
   (configurable per org)" needed a new model, with an open design
   question: numeric reference range vs. free text vs. both (many real
   lab tests are qualitative — "Negative"/"Non-reactive" — where a
   numeric bound is meaningless), and whether/how a critical threshold is
   modeled.
3. `laboratory.*` was already seeded as all-scope for every role,
   including Doctor. The same "own vs. all scope" question already hit
   twice (medical_records/prescriptions, see ADR-0010's item 3 and the
   TD-0011 lineage) applies here: should a doctor's lab-order permissions
   be `.own`-scoped like prescriptions, given Lab Technician/Nurse need to
   see every order regardless of who ordered it?

**Decision:**
1. **Added `LabTest.encounterId String?` + `Encounter.labTests LabTest[]`**
   (migration `20260801191909_lab_management`), mirroring
   `Prescription.encounterId`'s shape exactly — nullable (an order need
   not always trace to an encounter, matching the pre-existing nullable
   `appointmentId`), with its own index.
2. **New `LabTestCatalogItem` model, org-scoped, supporting *both* a
   numeric range and a text range simultaneously** (`referenceRangeLow`/
   `referenceRangeHigh` Float?, `referenceRangeText` String?, plus
   optional explicit `criticalLow`/`criticalHigh` Float?) rather than
   picking one representation. A quantitative test (CBC, FBS) sets the
   numeric fields for automatic abnormal-flagging; a qualitative test
   (HIV screen, culture) sets only the text field and is never
   auto-flagged (see `abnormal-flagging.ts`). `LabTestItem` itself gained
   matching denormalized fields (`catalogItemId`, `referenceRangeLow/High`,
   `criticalLow/High`) populated *at order-creation time* from the
   catalog (or from ad-hoc DTO fields when no catalog item is chosen) —
   not looked up again at result-entry time, so a later edit or
   deactivation of the catalog item never retroactively changes how an
   already-ordered item's abnormal flag is computed. `LabTestItem`'s
   original free-text `testName`/`testCode`/`category`/`referenceRange`
   fields are unchanged — an order item can still be entered ad hoc
   without any catalog reference.
3. **`laboratory.read`/`create`/`update` are own-scoped for the Doctor
   role** (`seed.ts`), added to `OWN_SCOPE_PERMISSIONS` and the `Doctor`
   role spec exactly like `prescriptions.*` — a doctor orders/views/
   updates lab tests only for patients they're treating. **Lab
   Technician and Nurse remain all-scope** (unchanged) — they process and
   view every order in the queue regardless of which doctor placed it,
   the same reasoning that keeps `doctors.documents`/`appointments` reads
   broad for non-doctor staff roles.

**Consequences:** No data migration risk (`lab_tests`/`lab_test_items`
tables were pre-existing but the catalog concept and `encounterId` are
net-new columns/table, safe to add as nullable/optional). The abnormal-
flagging rule (numeric-only, critical bounds explicit-or-derived via a
disclosed 20%-of-range multiplier) is documented in code and TECH_DEBT
rather than presented as clinically authoritative — same spirit as
ADR-0010's drug-interaction disclosure. `LabOrderController`'s catalog
routes (`/laboratory/catalog`) are *not* own-scope-checked — a catalog
item has no owning doctor, so only the plain `laboratory.create/update`
permission gates management of it, regardless of the caller's scope on
order routes.

---

## ADR-0013: Milestone 8 (Radiology) schema/permission decisions — expanded scope per explicit user instruction, versioned reports, own-scope `radiology.*`, `RadiologyTechnician` role activated

Date: 2026-08-02
Status: Accepted

**Context:** `NEXT.md` (written at the close of Milestone 7) scoped
Radiology narrowly — order creation from consultation, report upload/
viewing, a frontend queue — explicitly warning against a Laboratory-style
structured/versioned system "unless the roadmap or user asks for one."
This session's actual instruction **did** ask for one: a full
Radiology Information System — a configurable study catalog (name/code/
category/modality/body part/contrast/price/duration), scheduling (date/
time/room/machine/technician/radiologist/duration), a versioned report
with clinical indication/technique/findings/impression/recommendations
plus verification and release, image/external/DICOM-placeholder
attachments, a dashboard, and four frontend routes. Per `CLAUDE.md`'s
rule ("only raise a settled decision again if new information directly
contradicts it, and propose updating `DECISIONS.md` rather than silently
overriding it"), this ADR records that the explicit, detailed
in-conversation instruction supersedes `NEXT.md`'s narrower framing —
not a silent scope change.

**Decision:**
1. **Full RIS scope implemented, not the minimal version.** New
   `RadiologyCatalogItem` model (org-scoped: `code`, `name`, `category`,
   `modality`, `bodyPart` — both `modality`/`bodyPart` stay free-text
   `String`, matching the pre-existing `RadiologyOrder.modality`/
   `bodyPart` columns from the original scaffold, rather than a strict
   enum — real DICOM modality vocabularies are broad and this keeps room
   for a future PACS integration to supply its own values). `Priority`
   is reused as-is (already modeled `ROUTINE`/`URGENT`/`STAT` for
   Laboratory).
2. **`RadiologyOrder.encounterId` + `Encounter.radiologyOrders` added**
   (migration `20260801202731_radiology_management`), mirroring
   `LabTest.encounterId` exactly per ADR-0012's precedent — nullable,
   its own index. `RadiologyOrder.catalogItemId` added the same way
   (nullable FK, `onDelete: SetNull`), denormalizing `modality`/`bodyPart`
   onto the order at creation time (never re-looked-up), the same
   "denormalize at order time" pattern `LabTestItem` established.
3. **`RadiologyStatus` gained `REJECTED`** (alongside the pre-existing
   `ORDERED`/`SCHEDULED`/`IN_PROGRESS`/`COMPLETED`/`REPORTED`/
   `CANCELLED`) — the roadmap's status list explicitly named it, and it
   models a real distinct outcome ("this order should never have been
   placed") from `CANCELLED` ("this was valid but no longer needed").
4. **Reports are a separate, append-only `RadiologyReport` child table**
   (version = previous + 1, no update method exposed — same "never
   overwrite" enforcement as `ClinicalNote`, ADR-0008), with the
   *current* version's content denormalized onto `RadiologyOrder` itself
   for cheap list/queue reads. Once `REPORTED` (released), no further
   report versions can be authored in this milestone — amending a
   released report is deferred (see TECH_DEBT), a deliberate
   simplification rather than modeling re-verification-after-amendment.
   **Verification and release are separate, sequential actions**
   (`verifiedByUserId`/`verifiedAt`, then `releasedByUserId`/`releasedAt`
   + status → `REPORTED`) — release requires verification first,
   modeling a real radiologist workflow (author → verify → release)
   rather than a single "submit" step.
5. **Image attachments are a separate `RadiologyAttachment` table**, not
   reusing `EncounterAttachment` — a radiology order's attachments are
   scoped to the order (findable independent of which encounter it
   came from) and need a `DICOM_PLACEHOLDER`/`EXTERNAL_IMAGING` type with
   no real file (metadata-only: accession number / external URL / study
   instance UID) for referencing an outside PACS study — a shape
   `EncounterAttachment` doesn't have. `IMAGE`/`PDF` attachments reuse
   `StorageService` exactly like every other upload in this codebase.
   **No real PACS/DICOM server integration exists** (explicitly excluded
   by instruction) — the placeholder type is the extension point a future
   integration would replace.
6. **`radiology.read`/`create`/`update` changed from all-scope to
   own-scope for the Doctor role** (mirroring ADR-0012's laboratory
   decision exactly, for the same reason: a doctor should only order/
   view/update imaging for patients they're treating). **A new
   `Radiology Technician` role was added to `seed.ts`'s `ROLE_SPECS`**
   (all-scope `radiology.*` + `patients.read`) — `SystemRole
   .RADIOLOGY_TECHNICIAN` already existed in the schema enum from the
   original scaffolding commit but had no role spec, the same situation
   `LAB_TECHNICIAN` was in before Milestone 7. Nurse gained `radiology.read`
   (mirroring its existing `laboratory.read` grant).
7. **No dedicated technician-picker UI** — `RadiologyOrder
   .technicianUserId` stays a plain `String` (no FK, matching the
   `sampleCollectedBy`-style "actor" convention), and the frontend has no
   staff-directory lookup to populate it from (no such endpoint exists
   yet for any staff type) — tracked in TECH_DEBT rather than building a
   speculative staff-directory feature for this one field.

**Consequences:** No data migration risk (`radiology_orders` had no real
rows). RBAC reuses the existing `radiology` permission resource (already
seeded with `read`/`create`/`update`) — no new resource was needed.
`docs/roadmap.md`'s Milestone 8 entry undersold this session's actual
scope; not renumbered or rewritten since the milestone boundary itself
(Radiology as its own milestone, per ADR-0011) is unchanged — only its
internal depth grew. Frontend has four routes (`/dashboard/radiology`
dashboard, `/dashboard/radiology/orders` queue, `/dashboard/radiology/
catalog`, `/dashboard/radiology/[orderId]` detail with Scheduling/Report/
Attachments tabs), plus a Radiology tab on the encounter detail page and
a "Recent imaging" panel on the patient timeline — mirroring Laboratory's
integration points exactly.

---

## ADR-0014: Milestone 9 reordered to Pharmacy Management (Billing & Insurance pushed to Milestone 10); `Drug`/`DispenseOrder`/`DispenseItem`/`DrugReturn` schema design

Date: 2026-08-03
Status: Accepted

**Context:** `NEXT.md` (written at the close of Milestone 8) scoped
Milestone 9 as Billing & Insurance, per `docs/roadmap.md`'s original
numbering. This session's explicit instruction reordered the roadmap
instead: build Pharmacy Management now, under the label "Milestone 9,"
with Billing and Insurance explicitly excluded and pushed to "later
milestones." Per `CLAUDE.md`'s rule ("only raise a settled decision again
if new information directly contradicts it, and propose updating
`DECISIONS.md` rather than silently overriding it"), this is that
proposal — the same kind of explicit, in-conversation instruction that
superseded `NEXT.md`'s framing in ADR-0013 (Radiology's expanded scope).

**Decision:**
1. **Reorder and split** `docs/roadmap.md`: old Milestone 9 (Billing &
   Insurance) and old Milestone 10 (Pharmacy & Inventory) are replaced
   with Milestone 9 — Pharmacy Management (this session's actual scope:
   drug catalog, dispensing, stock, returns — not general inventory),
   Milestone 10 — Billing & Insurance (unchanged deliverable list, moved
   back one slot), and a new Milestone 11 — General Inventory (purchase
   orders, non-drug stock — the half of old Milestone 10 not touched this
   session). Former Milestones 11–15 (Staff & Attendance through
   Production Hardening) shift to 12–16, mirroring ADR-0011's
   insert-and-shift-everything-after precedent. `inventory` module
   remains the untouched 3-line scaffold, now explicitly Milestone 11's
   job rather than bundled with Pharmacy.
2. **`Medication` (unused since the original scaffolding commit — confirmed
   zero references anywhere in `apps/api`/`apps/web`/`packages/types`/
   `seed.ts`) is renamed to `Drug` and extended**, rather than left in
   place alongside a new parallel model. Its pre-existing shape (name,
   genericName, manufacturer, strength, form, category, unitPrice,
   isActive) was missing more than half of what the roadmap's Drug Catalog
   fields require (brand name, batch, expiry, tax, stock levels) — the
   same "shape genuinely insufficient, don't force-fit" reasoning as
   ADR-0008's `MedicalRecord` → `Encounter` replacement, not ADR-0010's
   "reuse with one adjustment" case. `category` was dropped (not in the
   roadmap's field list and not worth carrying forward on an unused model).
3. **One `Drug` row is one batch — batch number and expiry live directly on
   the catalog row, not on a separate child table.** The roadmap's own
   field list puts "Batch" and "Expiry" inside "Drug Catalog CRUD Fields"
   (not only under the separate "Stock" section), so a second `DrugBatch`
   table was a bigger abstraction than asked for. Restocking the same
   generic/brand drug with a new batch creates a new `Drug` row (sharing
   genericName/brandName/strength/dosageForm/manufacturer/price/tax with
   its sibling batches, differing in batchNumber/expiryDate/stock) rather
   than a join. Traded off: no single "the drug" identity across batches
   for catalog editing (renaming a drug's brand name means editing every
   batch row) — acceptable given the roadmap never asked for cross-batch
   catalog identity, and the same simplicity-over-speculative-normalization
   call CLAUDE.md asks for ("three similar lines is better than a
   premature abstraction").
4. **`DispenseOrder` is one-to-one with `Prescription`** (`prescriptionId`
   unique) — "Dispense prescription" creates exactly one dispense record
   per prescription that tracks its full fulfillment lifecycle, mirroring
   how `Encounter` is the one central record per consultation (ADR-0008).
   `DispenseItem` rows mirror `PrescriptionItem` rows 1:1 (denormalizing
   `medicationName` at creation time, same "denormalize at order time"
   idiom as `LabTestItem`/`RadiologyOrder`), each optionally linked to a
   `Drug` (batch) once the pharmacist resolves the prescribed medication
   name to an actual catalog entry — "Batch selection" in the roadmap's
   frontend feature list is this resolution step.
5. **`DispenseStatus` has exactly the six roadmap-specified values**
   (`PENDING`/`PREPARING`/`READY`/`DISPENSED`/`CANCELLED`/`RETURNED`), no
   extra states invented to represent partial fulfillment:
   - **Partial dispense** increments `DispenseItem.quantityDispensed` for
     the specified items/quantities without changing `DispenseOrder`
     .status — repeatable, order stays `READY` until finalized.
   - **Complete dispense** fills any remaining requested quantity on every
     item and moves the order to `DISPENSED`, stamping `dispensedAt`/
     `dispensedByUserId`. This is the only transition into `DISPENSED`.
   - **Reject** and **Cancel** are the same underlying transition
     (`CANCELLED`), distinguished only by a `rejected: Boolean` flag +
     `cancelReason` text — the roadmap lists "Reject" and "Cancel" as
     separate actions but only one non-`PENDING` terminal-before-dispense
     status exists, so the distinction is recorded as data, not as two
     enum values.
   - **Returned** is reached from `DISPENSED` when at least one
     `DrugReturn` is recorded against the order — there is no
     `PARTIALLY_RETURNED` state; a partial-quantity return still moves the
     whole order to `RETURNED` (it's a true statement — "this dispensed
     order has an associated return" — even if only some of it came back).
6. **Stock reservation is enforced in application code, not a DB
   constraint** — moving an order to `PREPARING` (batch selected) reserves
   the requested quantity on the `Drug` row (`reservedStock += qty`);
   dispense (partial/complete) converts reserved → deducted; cancel/reject
   releases the reservation. This accepts the same class of race-condition
   gap already open and documented for appointment booking (TD-0012) and
   `DoctorLeaveService` — not a new gap, and not blocking for this
   milestone; tracked in `TECH_DEBT.md`.
7. **`pharmacy.*` (`read`/`create`/`update`) stays all-scope for every role
   that has it** — already seeded this way (Pharmacist gets all three;
   Hospital Admin gets everything). Unlike lab/radiology orders
   (ADR-0012/ADR-0013's doctor-owns-their-orders reasoning), pharmacy is
   staff-facing (pharmacist dispenses across every doctor's prescriptions
   the same way a cashier processes every patient's invoice) — the same
   reasoning `NEXT.md` already flagged for Billing/Insurance applies here
   too, decided deliberately rather than defaulting to the clinical-module
   own-scope pattern. **Pharmacist additionally gains `prescriptions.update`**
   (previously only `prescriptions.read`) so completing a dispense can
   transition the source `Prescription` to `COMPLETED` via the existing
   `PrescriptionsService.updateStatus`, the same cross-module reuse
   `RadiologyOrdersService` already does with `EncountersService`.

**Consequences:** No data migration risk beyond the `Medication` rename
(table had zero rows). `docs/roadmap.md`'s Billing & Insurance and General
Inventory milestones keep their original deliverable lists verbatim —
only the heading/week-label numbers move (Billing & Insurance: 9→10;
Staff & Attendance through Production Hardening: 11–15→12–16). `NEXT.md`
is replaced with Milestone 10 — Billing & Insurance now that this
session's Pharmacy work is verified complete, per the Milestone
Completion Checklist.

---

## ADR-0015: Milestone 10 narrowed to Billing only (Insurance carved out to its own Milestone 11); Charge Engine, Invoice discount/refund workflow, and schema design

Date: 2026-08-03
Status: Accepted

**Context:** `NEXT.md` (written at the close of Milestone 9) scoped
Milestone 10 as "Billing & Insurance," per `docs/roadmap.md`'s original
bundling. This session's explicit instruction narrowed scope to Billing
only — "Insurance is NOT part of this milestone" — with the full Billing
deliverable list (Charge Engine, Invoice, Payments, Discounts, Taxes,
Receipts, Refunds, APIs, frontend, dashboard). Per `CLAUDE.md`'s rule
("only raise a settled decision again if new information directly
contradicts it, and propose updating `DECISIONS.md` rather than silently
overriding it"), this ADR records that instruction the same way ADR-0013
(Radiology's expanded scope) and ADR-0014 (Pharmacy's reorder) recorded
theirs.

**Decision:**

1. **`docs/roadmap.md`'s Milestone 10 is split**: Milestone 10 — Billing
   (this session, complete), a new Milestone 11 — Insurance Management
   (TPA/cashless claims — carved out, not started), and General Inventory
   /Staff & Attendance/AI/Reports/Notifications/Production Hardening shift
   from 11–16 to 12–17, mirroring ADR-0011's insert-and-shift-everything-
   after precedent. `InsuranceModule` remains the untouched 3-line
   scaffold confirmed at Milestone 8's session and unchanged since.

2. **`Charge` is the reusable "Charge Engine" entity** — one row per
   billable event, created either by a manual cashier action
   (`POST /billing/charges`) or, in this session, by the one real
   automated caller: the appointment-completion listener (point 6 below).
   `sourceModule`/`sourceId` record provenance as plain columns (a
   `ChargeSourceModule` enum: APPOINTMENT/CONSULTATION/LABORATORY/
   RADIOLOGY/PHARMACY/PROCEDURE/MISCELLANEOUS, plus an optional free-text
   `sourceId`) rather than a hard FK into each clinical module's own
   tables — the same "actor reference stays a plain column" convention as
   `LabTest.sampleCollectedBy`/`RadiologyOrder.technicianUserId`. This
   session does not modify Laboratory/Radiology/Pharmacy to emit charges
   automatically (out of scope — those modules were confirmed untouched
   per the reading policy); `ChargesService.create` is the reusable entry
   point a future session would call from those modules, and the manual
   API already lets a cashier record a charge against any of them today
   via `sourceModule`.

3. **`ServiceCatalogItem`** (new model, org-scoped: code/name/category/
   price/taxPercent/isActive) is "service catalog with pricing" —
   `category` stays free-text (mirrors `RadiologyCatalogItem.modality`/
   `bodyPart`'s precedent) rather than an enum. Charges and invoice line
   items both denormalize `description`/`unitPrice`/`taxPercent` from the
   catalog item *at creation time* — the same "denormalize at order time"
   idiom as `LabTestItem`/`RadiologyOrder`/`DispenseItem` — so a later
   catalog price edit never retroactively changes an already-billed
   charge or invoice item.

4. **Invoice creation sweeps `PENDING` charges, not just manual line
   items.** `POST /billing/invoices` accepts `items[]` (ad-hoc) and/or
   `chargeIds[]` (existing charges to bill) — at least one is required.
   Swept charges flip to `INVOICED` with `invoiceId` set; cancelling a
   not-yet-paid invoice releases them back to `PENDING` for re-billing
   (mirrors `DispenseService`'s reservation-release-on-cancel pattern).
   `Invoice.encounterId` was added (nullable, unique — mirrors the
   pre-existing `appointmentId`) alongside the pre-existing
   `appointmentId`, since not every billable visit traces through an
   `Appointment` record.

5. **Discount and refund approval workflow is the same shape for both**:
   a caller holding `billing.manage` has their discount/refund
   auto-approved and applied immediately; anyone else's request lands
   `PENDING` (on `Invoice.discountApprovalStatus` / `Refund.status`)
   until a `billing.manage` holder approves or rejects it. No `seed.ts`
   changes were needed — `billing.manage` was already seeded and already
   excluded from the `Cashier` role (only `Hospital Admin`'s wildcard
   grant includes it), so this session's RBAC need ("separate the person
   who requests a discount/refund from the person who can unilaterally
   grant one") was already satisfied by the existing permission catalog.
   An invoice-level discount (`DiscountType`: FLAT/PERCENTAGE) is applied
   on top of the post-item-discount subtotal, before the already-computed
   per-item tax is touched — see `billing-calculations.ts`. Only an
   `APPROVED` discount is ever reflected in `discountAmount`/
   `totalAmount`/`balanceDue`; a `PENDING` one changes nothing until
   resolved, and requesting/approving is blocked once any payment has
   been recorded (a paid invoice's numbers shouldn't move — reject and
   handle via a refund instead).

6. **A completed refund (partial or full) flips the invoice to
   `REFUNDED`**, regardless of whether the full paid amount was
   refunded — the same "even if only some of it came back" semantics
   `DispenseOrder.RETURNED` already established (ADR-0014 point 5).
   `paidAmount`/`balanceDue` are left untouched by a refund (they record
   what was collected, a historical fact); the sum of `COMPLETED` refunds
   against an invoice is the source of truth for how much has been
   refunded.

7. **"Auto-invoice generation from appointment"** is a dedicated
   `AppointmentInvoiceListener` (in the `billing` module) reacting to the
   pre-existing `appointment.status_changed` event — the same
   multiple-independent-listeners-on-one-event pattern `AuditListener`
   already established. On completion, it creates one `CONSULTATION`
   charge priced from `Doctor.consultationFee` (already a required field,
   seeded for every doctor since Milestone 4) with `taxPercent` from
   `Organization.settings.gstRate`, then sweeps it into a new `DRAFT`
   invoice. Idempotent via `Invoice.appointmentId`'s existing unique
   constraint (checked before doing anything). Failures are logged and
   swallowed — an invoicing hiccup must never block the appointment
   status transition that triggered it, the same "best-effort, don't
   fail the primary action" idiom as `DispenseService.dispenseComplete`'s
   prescription-completion call (TD-0023).

8. **Split and partial payments needed no schema change at all** — the
   pre-existing `Payment` model (one row per payment, `invoiceId` not
   unique) already supported multiple rows per invoice; calling
   `POST /billing/invoices/:id/payments` more than once, with different
   `paymentMode`s and/or amounts, *is* both split and partial payment.
   `PaymentMode.INSURANCE` already existed in the schema from the
   original scaffold but is excluded from the frontend's payment-mode
   picker this session (insurance-backed payment collection needs the
   claim workflow Milestone 11 will build).

9. **Receipt/invoice PDFs include a QR placeholder, not a real scannable
   payment code** — no UPI/payment-gateway credentials or merchant VPA
   are configured anywhere in this repo. Generating a QR that *looks*
   scannable but resolves to nothing would be actively misleading (worse
   than simply omitting it), so both PDFs render a labeled bordered box
   ("QR (integration pending)") instead — the same disclosed-placeholder
   practice as the DICOM/ICD-10 placeholders in earlier milestones, not a
   faked payment feature.

**Consequences:** No pre-existing rows were at risk (`Invoice`/
`InvoiceItem`/`Payment`/`InsuranceClaim` were all unused since the
original scaffolding commit, confirmed before this session's migration).
`InsuranceClaim`/`Invoice.insuranceClaim` remain in the schema, unused
by any service — the exact extension point Milestone 11 builds on.
Concurrent-write races on `Charge`/`Invoice`/`Payment` totals have no
DB-level locking, the same accepted-for-now gap as TD-0012/TD-0021 (see
TECH_DEBT). No dedicated frontend page manages the service catalog or
raises ad-hoc charges outside the invoice-creation flow — the backend
fully supports both, but building a standalone admin UI for either was
not requested this session (see TECH_DEBT).
