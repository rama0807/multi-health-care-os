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

---

## ADR-0016: Milestone 11 (Insurance Management) — separate Provider/Plan/Coverage models, namespaced RBAC, settlement-as-Payment reuse, and document auto-attach design

Date: 2026-08-04
Status: Accepted

**Context:** `NEXT.md` (written at the close of Milestone 10) framed
Milestone 11 narrowly — reuse `InsuranceClaim`'s existing denormalized
`insuranceProvider`/`policyNumber` fields, and explicitly flagged "no
separate `InsurancePolicy` model exists... decide deliberately" as an
open question rather than a settled answer. This session's instruction
gave the full deliverable list directly: Insurance Company/TPA/
Corporate Plan management with CRUD, Insurance Plans with coverage
terms, per-patient Primary/Secondary coverage, a Pre-Authorization
workflow with documents/audit, a Claims workflow with settlement
(insurance share/patient share/adjustments/write-offs), automatic
claim-document attachment from every other clinical/billing module,
and six frontend routes plus two new tabs on existing pages. Per
`CLAUDE.md`'s rule (only raise a settled decision again if new
information directly contradicts it, and record the update rather than
silently overriding it), this ADR records that expanded scope the same
way ADR-0013/ADR-0014/ADR-0015 recorded theirs.

**Decision:**

1. **Four new models, not just extending `InsuranceClaim`'s
   denormalized fields**: `InsuranceProvider` (Insurance Company/TPA/
   Corporate, org-scoped, unique code), `InsurancePlan` (per provider —
   coverage %/co-pay %/deductible/annual limit/per-visit limit/network
   type), `PatientInsurance` (a patient's enrollment in a plan —
   primary/secondary, member ID/policy number/dates/status), and
   `PreAuthorization` (+ `PreAuthAttachment`). `InsuranceClaim` keeps
   its original `insuranceProvider`/`policyNumber` string columns
   (now denormalized *from* the resolved `InsuranceProvider`/
   `PatientInsurance` at claim-creation time, the same "denormalize at
   order time" idiom as `LabTestItem`/`RadiologyOrder`/`ServiceCatalog
   Item`) rather than dropping them — a claim must always show a
   provider name/policy number even if the structured records backing
   it are later edited or deactivated. This resolves `NEXT.md`'s open
   question: "insurance policy management" meant real, reusable,
   patient-independent Provider/Plan records, not just claim-level
   fields — the roadmap bullet undersold the actual surface needed for
   pre-auth and claims to both reference the same coverage terms.

2. **One active coverage per type, enforced in application code, not a
   DB constraint** (`PatientInsuranceService.create` checks for an
   existing `ACTIVE` row of the same `type` before inserting). A
   unique-index approach would make a patient's coverage *history*
   (an expired policy, later replaced) impossible to keep without
   deleting rows — the same reasoning that kept `DoctorSchedule`
   versioned instead of overwritten. Only `PatientInsurance.status`
   needs to change (`ACTIVE` → `EXPIRED`/`INACTIVE`) to enroll a
   replacement.

3. **RBAC: the flat `insurance` resource (seeded read/create/update
   for Milestone 10's placeholder) is split into five namespaced
   sub-resources** — `insurance.providers`, `insurance.plans`,
   `insurance.claims`, `insurance.preauth`, `insurance.settlement` —
   mirroring `doctors.schedule`/`doctors.leave`/`doctors.documents`'s
   precedent for a module with genuinely distinct sub-workflows rather
   than one CRUD surface. `insurance.settlement` gets a `.manage`
   action, admin-only (excluded from the seeded `Cashier` role, same
   as `billing.manage`) — settling a claim fixes the final insurer-
   vs-patient split and posts a real payment, the same "requester ≠
   approver" separation `billing.manage` already established for
   discounts/refunds; filing/tracking claims and pre-auths (read/
   create/update) stays available to `Cashier`. Patient-coverage
   endpoints reuse `insurance.claims.*` rather than adding a sixth
   resource — coverage enrollment is prerequisite data for claims/
   pre-auth, not an independent workflow with its own approval
   semantics.

4. **A settled claim's insurance share is recorded as a real
   `Payment`** (`paymentMode: INSURANCE`, already present in the
   `PaymentMode` enum since the original scaffold but excluded from
   the frontend's payment-mode picker per ADR-0015 point 8) against
   the linked invoice via the existing `PaymentsService.create` — not
   a parallel "insurance payment" concept. This is the same mechanism
   a cash/card payment already uses to reduce `Invoice.balanceDue`,
   confirmed working end-to-end in this session's e2e tests and
   browser verification. A consequence: settlement requires the
   invoice to already be finalized (`PaymentsService.create` rejects
   payments against a `DRAFT` invoice, unchanged from Milestone 10) —
   the claim workflow doesn't finalize the invoice on the caller's
   behalf, since that's a billing-side decision outside insurance's
   scope.

5. **Claim documents auto-attach by reusing each module's existing PDF
   generator, plus one new purpose-built generator.** `ClaimDocuments
   Service.autoAttachForClaim` calls `InvoicesService.generatePdf`,
   `PrescriptionsService.generatePdf`, `LabTestsService.
   generateReportPdf`, and `RadiologyOrdersService.generateReportPdf`
   for whatever prescriptions/lab tests (status `REPORTED`)/radiology
   orders (status `REPORTED`) exist for the claim's encounter, uploads
   each buffer via the existing `StorageService`, and records a
   `ClaimDocument` row (`autoAttached: true`). No such generator
   existed for "the encounter itself" (clinical notes/diagnoses/
   vitals/procedures combined), so a new `generateEncounterSummaryPdf`
   was added, scoped to insurance auto-attach only — not exposed as a
   standalone medical-records feature, since nothing else needs it
   yet. **A generator failure is logged and skipped, not thrown** — a
   missing/failed report shouldn't block filing the claim itself, and
   the claim's document list always shows exactly what did attach
   (verified with a unit test asserting the claim is still created
   when the invoice-PDF generator throws).

6. **Discharge Summary auto-attach is explicitly deferred, not
   faked** — the milestone's own spec marks it "(future)"; there is no
   `Admission`/discharge-summary model in this repo yet (IPD is
   Milestone 12), so nothing exists to summarize. Recorded as an open
   item, not a placeholder PDF.

7. **The Encounter Insurance tab's "File claim" dialog asks for the
   invoice ID as free text**, rather than a picker — no endpoint
   resolves "the invoice for this encounter" today (`InvoicesController`
   filters by `patientId`, not `encounterId`, even though the column
   exists). Tracked as TD-0028 rather than scope-creeping a Billing
   change into an Insurance-scoped session (the reading policy limited
   this session to reusing Billing as-is).

8. **The claim detail page's "Timeline" is synthesized from the
   claim's own lifecycle timestamp columns** (`createdAt`/
   `submittedAt`/`settledAt`/`closedAt`), not a real per-resource
   audit-trail feed — every transition already emits an audited
   `@OnEvent`, but no endpoint filters `AuditLog` by `resourceId` for a
   single claim/pre-auth today (the Patient page's Timeline/Audit tabs
   are patient-specific, not generic). Tracked as TD-0029.

**Consequences:** `InsuranceClaim` gained `encounterId` (required —
"every claim must reference Patient, Encounter, Invoice, Insurance," so
one nullable-optional field would have violated the requirement) and
structured FKs (`providerId`/`planId`/`patientInsuranceId`/
`preAuthorizationId`, all nullable — a claim can exist even if its
backing provider/plan is later deleted, though `onDelete: SetNull` is
used rather than `Cascade` so historical claims never silently vanish).
`InsuranceClaimStatus` gained `PARTIALLY_SETTLED`/`CLOSED` (the
original scaffold only went as far as `SETTLED`). No `InsurancePolicy`
model was created as a separate concept from `PatientInsurance` — the
roadmap's "policy management" language and this session's "Patient
Coverage" feature are the same thing, just named differently between
the roadmap and the milestone brief.

---

## ADR-0017: Insert Milestone 12 — IPD & Bed Management ahead of General Inventory; every later milestone shifts by one

Date: 2026-08-04
Status: Accepted

**Context:** The instruction that closed out this session's Milestone
11 work explicitly directed `NEXT.md` to be replaced with "Milestone
12 — IPD & Bed Management." No such milestone existed anywhere in
`docs/roadmap.md` (Milestone 12 was "General Inventory") — this is a
genuinely new milestone being inserted, not a rename or a scope
clarification of an existing one. The `Ward`/`Bed`/`Admission` domain
has no models in the schema yet, but the frontend sidebar already has
a "Wards & Beds" nav item (`departments.read`-gated, pointing at
`/dashboard/wards`) sitting unbuilt since at least Milestone 4 —
consistent with IPD being planned but not yet scheduled anywhere.

**Decision:** Mirroring ADR-0011/ADR-0013/ADR-0014/ADR-0015's
insert-and-shift-everything-after precedent: `docs/roadmap.md` gets a
new **Milestone 12 — IPD & Bed Management** (ward/bed inventory,
admission → bed assignment/transfer → discharge, IPD billing
integration reusing the Milestone 10 Charge Engine, bed occupancy
dashboard), and every milestone from the old 12 onward shifts by one
(General Inventory 12→13, Staff & Attendance 13→14, AI Features
14→15, Reports & Analytics 15→16, Notifications 16→17, Production
Hardening 17→18) — content unchanged for all of them, only the number
and week label move. `NEXT.md` is replaced with Milestone 12 (IPD &
Bed Management) per the instruction, not Milestone 13 (General
Inventory) as the old numbering would have implied.

**Consequences:** No code changes — this is a planning-document-only
decision. The next session picking up Milestone 12 starts from a
clean slate (no `Ward`/`Bed`/`Admission` models exist yet); it should
decide bed/ward schema design fresh rather than assuming anything
carries over from Insurance or Billing, beyond reusing the Charge
Engine for IPD billing as explicitly scoped above.

---

## ADR-0018: Checkpoint 12.1 schema — extend the unaudited scaffolded `Ward`/`Bed`/`Admission` models, add `Room`/`BedAllocation`/`BedTransfer`, defer discharge/billing

Date: 2026-08-04
Status: Accepted

**Context:** ADR-0017's claim that "no `Ward`/`Bed`/`Admission` models
exist yet" was **wrong** — they do, and always have: `model Ward`,
`model Bed`, and `model Admission` (plus `enum BedType`/`BedStatus`/
`AdmissionStatus`) were all present in the very first scaffolding
migration (`20260730185306_auth_org_rbac`) and never touched since —
the exact same category of unaudited scaffold as `Medication` (replaced
by `Drug`, ADR-0014) and the flat `MedicalRecord` (replaced by
`Encounter`, ADR-0008). `patients.service.ts`'s `getTimeline()`/
`getSummaryCounts()` already query `prisma.admission` using its
existing `admissionNumber`/`admissionReason`/`admittedAt`/`status`/
`patientId` fields (wired ahead of any real IPD module, like
`PatientTimelineEntryType.ADMISSION` and `PatientSummaryCounts.
admissions` in `@medicore/types`) — those field names are preserved
so that code keeps working unmodified.

This checkpoint (12.1) explicitly excludes Nursing Notes, Medication
Administration, and Discharge Summary (Checkpoint 12.2), which in turn
means the roadmap's "IPD billing integration reusing the Charge Engine"
is also out of scope here — every prior milestone's charge-generation
trigger point is a terminal clinical event (a completed appointment,
a settled claim), and the only terminal event this checkpoint has is
discharge, which doesn't exist yet. Billing integration is deferred to
whichever session implements discharge (12.2), not invented as a
mid-stay manual charge to hit today's scope.

**Decisions:**

1. **Hierarchy: `Hospital → Ward → Room → Bed`.** A `Room` model is
   new (the scaffold never had one) — `Ward` is the clinical/admin
   grouping (ICU, General, etc.), `Room` is the physical space with its
   own capacity and per-day rate, `Bed` is the billable/allocatable unit
   within a room. `Bed` keeps a denormalized `wardId` alongside `roomId`
   (mirrors this repo's existing denormalization precedent — e.g.
   `LabTest.patientId` next to `encounterId`) so ward-level occupancy
   queries (dashboard, bed grid) don't need a join through `Room`.
   `Ward.departmentId` (already in the scaffold) stays a single
   optional FK — a ward's *home* department for org-chart purposes;
   `Admission.departmentId` is captured independently per-admission
   (the spec lists "Department" as its own Admission field), since the
   admitting department doesn't have to match the ward's home
   department (e.g. a Cardiology patient admitted into a shared ICU).
2. **Dedicated `Status` enums for `Ward`/`Room`/`Bed`, not the
   `isActive` boolean this repo otherwise defaults to for catalog
   entities** (`Department`, `Drug`, `LabTestCatalogItem`, etc.) —
   the checkpoint brief explicitly names "Status" as its own field for
   all three, and `Bed` in particular needs a real operational state
   machine (`AVAILABLE`/`RESERVED`/`OCCUPIED`/`CLEANING`/
   `MAINTENANCE`/`BLOCKED` — the exact list the brief specifies, not
   the scaffold's narrower `AVAILABLE`/`OCCUPIED`/`RESERVED`/
   `UNDER_MAINTENANCE`). `WardType`/`BedType` are two separate enums
   with the same value set (`GENERAL`/`SEMI_PRIVATE`/`PRIVATE`/`ICU`/
   `NICU`/`PICU`/`HDU`) rather than one shared enum, matching this
   repo's convention of a dedicated enum per domain concept even when
   two enums' values overlap (e.g. `DiagnosisType` vs. other
   primary/secondary splits).
3. **`Admission.bedId`/`roomId` are optional at creation time.** The
   brief lists "Bed Allocation" (`Allocate`/`Transfer`/`Vacate`/
   `Reserve`/`History`/`Audit`) as its own section distinct from
   "Admission," which reflects real intake flow — an Emergency
   admission is often opened against a ward before a specific bed is
   ready. Admission still *accepts* an optional `bedId`/`roomId` up
   front for the common one-step case (ward round already knows the
   bed); either path produces the same `BedAllocation` audit row and
   the same `Bed.status → OCCUPIED` transition.
4. **`Admission.encounterId` is optional and reused, not always
   freshly created.** If the caller passes an existing encounter (the
   natural shape for "Transfer from OPD" — the OPD encounter is still
   the active clinical episode), it's validated and reused as-is; if
   omitted, the admission creates a fresh `Encounter{type: IPD}` so
   Checkpoint 12.2's nursing notes/vitals/discharge summary have
   somewhere to attach. `EncounterType` gains an `IPD` member (it only
   had `OPD`/`TELECONSULTATION`/`FOLLOW_UP`/`EMERGENCY`/`WALK_IN`).
   One admission-creation code path handles all four `AdmissionType`s
   (`EMERGENCY`/`SCHEDULED`/`INSURANCE`/`TRANSFER_FROM_OPD`) — the type
   only changes which fields the frontend wizard collects, not the
   backend logic.
5. **`Admission.patientInsuranceId` (optional FK to the existing
   `PatientInsurance`, Milestone 11)** is the entire "Insurance
   Admission" implementation — it records which coverage the stay is
   billed against. No new pre-auth/claim workflow is built; the
   existing Insurance module's pre-authorization/claims pages already
   do that once billing exists to claim against (12.2+).
6. **`AdmissionStatus` keeps `DISCHARGED`/`ABSCONDED` as enum values
   this checkpoint never sets** — only `ADMITTED` (on create) and
   `CANCELLED` (a same-stay "admission was opened in error, no
   clinical care occurred" cancel action, which also releases any
   allocated bed) are reachable via the API here. This mirrors
   `InvoiceStatus.OVERDUE` (TD-0026) — an enum value that exists for a
   workflow this repo hasn't built the trigger for yet, not a fake
   implementation. Discharge (12.2) is what will make `DISCHARGED`
   reachable.
7. **Bed transfer history gets two models, not one:** `BedAllocation`
   (every allocate/reserve/vacate/reservation-cancel event against a
   single bed, tied to one admission) and `BedTransfer` (a from→to pair
   across bed/room/ward, tied to one admission) — a transfer is
   logically "vacate bed A, allocate bed B" but the brief asks to
   "track complete history" of transfers *as transfers* (so the UI can
   render "Bed 204 → Bed 310" in one row), which a pair of independent
   `BedAllocation` rows can't cleanly express. Both are audited via the
   existing `@OnEvent` + `AuditLog` mechanism, same as every other
   module.

**Consequences:** `Bed`'s unique constraint moves from
`[bedNumber, wardId]` to `[bedNumber, roomId]` (a room, not a ward, is
the natural uniqueness scope for a bed number in real hospitals — e.g.
"Bed 1" and "Bed 2" repeat in every room). The scaffold's `Ward.
totalBeds` denormalized counter is dropped — every other dashboard
stat in this repo (pharmacy low-stock, billing revenue, radiology
today's-studies) is computed by query at read time, not maintained as
a write-time counter, and a ward's bed count is cheap to `count()`.
`AdmissionStatus.TRANSFERRED` is dropped — a mid-stay transfer is a
`BedTransfer` event, not a change to the admission's own status (the
admission stays `ADMITTED` throughout). IPD billing integration and
discharge remain explicitly deferred to Checkpoint 12.2, tracked in
`TECH_DEBT.md`.

---

## ADR-0019: Checkpoint 12.2 — Nursing/MAR/Discharge schema, reuse decisions, all-scope RBAC, and billing trigger

Date: 2026-08-04
Status: Accepted

**Context:** `NEXT.md` framed four judgment calls to check before
building: whether nursing notes are a genuinely separate model from
`ClinicalNote`, whether IPD vitals charting needs a new model, how
discharge reaches `AdmissionStatus.DISCHARGED`, and whether MAR reuses
`Prescription`/`PrescriptionItem` with an admin-log child table (the
`DispenseOrder`/`DispenseItem` precedent) or is a standalone model.

**Decisions:**

1. **Nursing notes/assessments/I-O charting/orders/tasks are
   admission-scoped, new models — not `ClinicalNote` reuse.**
   `ClinicalNote` is doctor-authored, per-consultation, and versioned
   (one row per edit, `@@unique([encounterId, version])`); IPD nursing
   documentation is nurse-authored, materially higher-frequency
   (multiple entries per shift), and conceptually tied to the *stay*
   (`admissionId`) rather than any single consultation. Five new
   models: `NursingNote` (general/shift-handover/assessment/incident +
   an `isEscalated` flag — the "escalation flag" deliverable, since no
   paging/notification system exists in this repo), `NursingAssessment`
   (one consolidated row per charting event for pain score, fall risk,
   Braden score, and GCS — mirrors `Vital`'s "one row, many fields"
   shape rather than one model per scale), `IntakeOutputRecord`,
   `IpdOrder` (doctor's diet/fluid/activity/oxygen/isolation orders),
   and `NursingTask` (nurse to-dos, optionally spawned from an
   `IpdOrder` via `sourceOrderId`).
2. **Vitals charting reuses the existing encounter-scoped `Vital`
   model as-is — no new model.** Every admission has a real
   `encounterId` (ADR-0018), and `Vital` already supports arbitrarily
   frequent entries (no charting-frequency assumption baked into its
   schema); the existing `VitalsService.create`/list on the Objective
   tab already handles IPD's higher charting cadence without a new
   query shape. A dedicated IPD vitals-trend endpoint was judged
   unnecessary — the existing per-encounter history list already
   serves this.
3. **MAR reuses `Prescription`/`PrescriptionItem` as the source of
   truth for what's prescribed; `MedicationAdministration` is the
   admin-log child table** — directly mirroring `DispenseOrder`/
   `DispenseItem`'s precedent (Milestone 9) rather than a parallel
   prescribing model. One row per scheduled/PRN/STAT dose instance
   (`type`, `scheduledAt`, `status`: `PENDING → ADMINISTERED`/
   `MISSED`/`REFUSED`/`HELD`/`DELAYED`). `barcodeVerified`/
   `scannedCode` are the disclosed "barcode-ready architecture" hook
   (TD-0033) — no physical scanner integration exists in this repo.
   `nurseSignature` is a typed-name attestation, not a cryptographic
   signature; the full audit trail is the existing `AuditLog` via
   `AuditListener`, not a duplicate log table.
4. **All new IPD sub-resources (`ipd.nursing`/`ipd.orders`/
   `ipd.tasks`/`ipd.mar`/`ipd.discharge`) are all-scope only** —
   mirroring `ipd.beds`/`ipd.transfer`'s precedent (any nurse/doctor
   manages any patient's ward-level operations) rather than
   `ipd.admissions`' own-scope carve-out. `ipd.discharge` splits
   `create` (doctor approval), `update` (nursing checklist + summary
   edits), and `manage` (finalize) — mirroring `billing.manage`'s
   requester/approver separation. This means a doctor can approve/
   finalize discharge for any admission, not only ones where they're
   attending (TD-0032, disclosed rather than silently accepted).
5. **Discharge is a four-step workflow, not a single action:**
   `approve` (doctor; stamps `dischargeApprovedAt`/`ByUserId`, seeds
   all 8 `DischargeChecklistItem` rows idempotently) → nurse toggles
   checklist items + drafts `DischargeSummary` (one row per admission,
   not versioned like `ClinicalNote`/`RadiologyReport` — a discharge
   summary is a single evolving draft until finalized, not a clinical
   history that must preserve every edit) → `complete` (requires
   approval + every checklist item `completed` + a summary with a
   final diagnosis; vacates the bed via the existing
   `BedAllocationService.vacate`, raises the room charge, closes the
   encounter, sets `AdmissionStatus.DISCHARGED`).
6. **IPD billing: `days-stayed = ceil(elapsed time since admittedAt /
   24h), minimum 1` × `Room.chargesPerDay`**, raised as a real `Charge`
   row (`sourceModule: ChargeSourceModule.IPD` — a new enum member —
   `sourceId: admission.id`) via the existing Charge Engine
   (`ChargesService.create`) at discharge finalize, closing TD-0030.
   This is a straightforward elapsed-time rounding rule, not "both
   admission and discharge date count as a full day" — simpler to
   reason about and to test.
7. **Fall-risk and Braden risk levels are derived server-side from
   disclosed, documented score thresholds** (Morse-style: <25 Low,
   25-44 Medium, ≥45 High; Braden: ≥19 Low, 15-18 Moderate, 13-14 High,
   ≤9 Severe) — mirrors `laboratory`'s `abnormal-flagging.ts` precedent
   (ADR-0012) of a disclosed, non-clinically-validated scoring rule
   rather than a black-box "AI" assessment.

**Consequences:** Eight new Prisma models (`NursingNote`,
`NursingAssessment`, `IntakeOutputRecord`, `IpdOrder`, `NursingTask`,
`MedicationAdministration`, `DischargeChecklistItem`,
`DischargeSummary`) plus two new `Admission` fields
(`dischargeApprovedAt`/`dischargeApprovedByUserId`) and one new
`ChargeSourceModule` enum member (`IPD`). RBAC gains five new
resources (`ipd.nursing`/`ipd.orders`/`ipd.tasks`/`ipd.mar`/
`ipd.discharge`). The Admission Detail page gained four new tabs
(Nursing, Orders & Tasks, MAR, Discharge) alongside the existing
Overview tab; new top-level pages `/dashboard/nursing`,
`/dashboard/nursing/tasks`, `/dashboard/nursing/patients`, and
`/dashboard/ipd/discharges`. TD-0030 (IPD billing/discharge deferred)
is now resolved; TD-0032 (all-scope discharge RBAC) and TD-0033
(barcode hardware) are opened, disclosed rather than silently accepted.

---

## ADR-0020: Milestone 13 backend design (retroactive) — Item Master lookup grouping, per-store/per-batch stock ledger, the PR→PO→GRN→Invoice procurement chain, and namespaced RBAC

Date: 2026-08-05
Status: Accepted (recorded retroactively)

**Context:** The full General Inventory backend (Item Master, Stores,
Stock, Vendors, Purchase Requests, Purchase Orders, Goods Receipt
Notes, Vendor Returns, Vendor Invoices, Store Requisitions, Stock
Audits, Assets + Maintenance) landed in commit `e7f4abb` with its own
code comments already citing "ADR-0020" (e.g.
`stores.controller.ts`'s `/** ... — see ADR-0020. */`), but no such
entry was ever written to this file — the commit predated any `.ai/`
sync, and the following frontend-checkpoint-1 session (2026-08-05)
explicitly did not re-audit the backend. This session read every
controller/service in `apps/api/src/modules/inventory/` end-to-end
while building the remaining frontend, so the design is recorded here
now rather than left as a dangling reference — closing the gap without
re-opening a full backend audit (out of scope by this session's own
resume instruction).

**Decision (design as implemented):**
1. **Item Master is one catalog row per item, not per batch** —
   `InventoryItem` (name/code/type: Asset|Consumable/HSN/GST/barcode/
   QR/track-batch-serial-expiry flags/unit cost) references five
   shared lookup tables (`InventoryCategory`, `InventoryItemGroup`,
   `InventoryUnit`, `InventoryManufacturer`, `InventoryBrand`), each a
   near-identical soft-deactivate CRUD surface — grouped into one
   `ItemMasterService`/controller rather than five parallel modules,
   mirrored on the frontend by Checkpoint 1's single tabbed Lookups
   page.
2. **Stock is tracked per store per item** (`InventoryStock`, unique
   on `[itemId, storeId]`) with `current/reserved/damaged/expired/lost`
   buckets and a computed `availableStock`; batch/serial/expiry detail
   lives in a child `InventoryBatch` table only for items with a
   tracking flag set. `StockService` centralizes the only two mutation
   primitives every other workflow needs — `receiveStock`/`issueStock`
   (plus `recordLedger` for the `InventoryStockAdjustment` audit trail)
   — so GRN completion, requisition issue/receive, and transfer
   dispatch/receive all share one bookkeeping path instead of each
   reimplementing it.
3. **The procurement chain is four independent, sequentially-linked
   entities, not one workflow object:** `PurchaseRequest` (Draft →
   Submitted → Approved/Rejected → Converted/Cancelled) →
   `PurchaseOrder` (optionally `purchaseRequestId`-linked; Draft →
   Submitted → Approved → Sent → Partially Received/Received,
   Cancelled from any non-terminal state) → `GoodsReceiptNote` (Draft →
   Completed, one row per receipt event against remaining
   `PurchaseOrderItem.quantityOrdered - quantityReceived`; completing
   one calls `StockService.receiveStock` and recomputes the PO's
   fulfillment status) → `VendorInvoice` (Pending → Verified/Disputed →
   Paid, `paidAmount` accumulated via repeatable `recordPayment` calls
   mirroring Billing's split-payment precedent from ADR-0015). A PO
   can also be raised with no source PR (ad hoc), and a `VendorReturn`
   exists as a fifth, independent goods-leaving-the-store path (sent →
   acknowledged) not gated behind any of the other four.
4. **`StoreRequisition` (inter-store transfer via approval) and
   `InventoryStockTransfer` (direct store-to-store move, no approval
   step) are two separate models**, not one parametrized by an
   `approvalRequired` flag — a requisition's `issue`/`receive` split
   into partial-fulfillment-capable steps (mirrors `DispenseOrder`'s
   partial-dispense precedent, ADR-0014) while a transfer's
   `dispatch`/`receive` moves the whole line at once.
5. **`StockAudit` snapshots `InventoryStock.currentStock` as
   `systemQuantity` at creation time**, not at count time — so a
   count taken hours or days later still reconciles against what stock
   *was* when the audit was scheduled; `complete` applies each item's
   `varianceQuantity` as an `AUDIT`-type `InventoryStockAdjustment`,
   the same ledger every other mutation path writes to.
6. **RBAC is namespaced per sub-domain** — `inventory.items`/`stores`/
   `stock`/`vendors`/`procurement`/`requests`/`audit`/`assets` — with
   `procurement` further split by action (`.create`/`.update`/
   `.approve`/`.manage`, the last gating vendor-invoice creation/
   payment and vendor-return acknowledgement) and `audit`/`requests`
   each getting their own `.approve`/`.manage` tier — mirroring
   `billing.manage`'s requester/approver-separation precedent (ADR-
   0015) rather than a single flat `inventory.*` permission.
7. **Sequential human-readable numbering** (`PR-`/`PO-`/`GRN-`/
   `TRF-`/`REQ-`/`AUD-`/`VRTN-` + org + year + sequence) via a shared
   `generateInventoryNumber` helper, advisory-locked per organization —
   the same pattern as `LAB-`/`RAD-`/`ADM-` in every prior clinical
   module.

**Consequences:** This entry documents behavior already live in
production code (commit `e7f4abb`) — no schema or backend logic
changed to write it. Every dangling `// see ADR-0020` code comment in
`apps/api/src/modules/inventory/` now resolves to a real entry. Any
future session touching this backend should treat points 1-7 above as
the established shape rather than re-deriving it from scratch.

---

## ADR-0021: Milestone 13 frontend — deep-link query-param prefill for the procurement chain, free-text ID inputs for staff/user pickers, Vendor Returns UI deferred, no browser walkthrough this session

Date: 2026-08-05
Status: Accepted

**Context:** This session built the remaining ten Milestone 13
frontend surfaces (Stores, Stock + Transfers, Vendors, Purchase
Requests, Purchase Orders, Goods Receipt, Vendor Invoices, Store
Requisitions, Stock Audits, Assets + Maintenance) on top of the
backend recorded in ADR-0020. Three judgment calls came up that
weren't dictated by the backend contract, plus one explicit
instruction override for this session only.

**Decision:**
1. **Purchase Order creation from an approved Purchase Request, and
   Goods Receipt creation from a Sent Purchase Order, use a
   `?fromPr=<id>`/`?fromPo=<id>` query param to auto-open the create
   dialog pre-filled** — mirroring the existing `?wardId=`/`?roomId=`
   deep-link pattern on `/dashboard/ipd/beds` (ADR-0018) rather than
   inventing a wizard or a separate "convert" route. Both list pages
   wrap their `useSearchParams()` read in a `<Suspense>` boundary, the
   same requirement `/dashboard/ipd/beds` already established.
2. **No staff/user picker exists anywhere in this repo's frontend** —
   confirmed by checking `apps/web/src/lib/api/` before building
   (nothing lists `/users`, and that endpoint is `users.read`-gated,
   a permission inventory-facing roles aren't guaranteed to hold).
   Store-manager assignment (`AssignStoreManagerDto.userId`) and
   asset-to-user assignment (`AssignAssetDto.assignedToUserId`) both
   take a free-text internal user ID instead, disclosed on-page — the
   same shape as the Encounter Insurance tab's free-text invoice ID
   (TD-0028). Asset-to-*department* assignment does have a real picker
   (`listDepartments`, already used elsewhere and `departments.read`-
   gated, a broadly-held permission).
3. **`VendorReturn` (the backend's fifth procurement-adjacent
   workflow, `goods-receipt.controller.ts`'s `/vendor-returns` routes)
   has no frontend this session** — the user's explicit remaining-work
   list named Stores/Stock/Vendors/Purchase Request/Purchase Order/
   Goods Receipt/Store Requisition/Stock Audit/Vendor Invoice/Assets
   only; Vendor Returns wasn't in it. Recorded as TD-0034 rather than
   silently built anyway or silently dropped.
4. **No browser walkthrough or screenshots this session** — the
   session's own verification instructions explicitly said "Do NOT use
   Playwright. Do NOT open a browser. Do NOT generate screenshots. Do
   NOT perform manual UI walkthroughs," overriding the standing
   Milestone Completion Checklist screenshot requirement for this
   session only. Automated verification (lint/typecheck/unit+e2e
   tests/build) is real and green; no page has been clicked through in
   a real browser. Disclosed per the Verification Policy rather than
   claimed as browser-verified.

**Consequences:** `docs/screens/inventory-*.png` remain owed (TD-0035)
— every prior milestone in this repo has browser-verified screenshots
and this one doesn't, purely because this session was instructed not
to attempt it. `TD-0034` (Vendor Returns UI) and `TD-0035` (no
screenshots) are both opened in `TECH_DEBT.md`. If a future session
adds a real staff/user directory endpoint or picker component, both
`StoresPage`'s manager-assignment dialog and `AssetDetailPage`'s
assign dialog should be revisited to replace the free-text ID input.

## ADR-0022: Milestone 14 — Staff & Attendance scope (non-doctor staff only), schema design, and RBAC

Date: 2026-08-05
Status: Accepted

**Context:** `docs/roadmap.md`'s Milestone 14 deliverable list:
"Staff profiles and employee records, Department and role assignment,
Shift management, Attendance marking (manual + biometric hook), Leave
management, Doctor duty roster, Staff reports, Frontend: staff
management, Frontend: attendance dashboard." This session's actual
instruction gave a materially more detailed breakdown (Staff
Management/Attendance/Leave Management/Shift Scheduling/Payroll
Preparation/Dashboard/RBAC, each with named sub-items), which this ADR
treats as the authoritative scope per this repo's precedent of later,
more specific instructions superseding the roadmap's original framing
(mirrors ADR-0013/ADR-0016's pattern). A `Staff` model and a 3-line
no-op `staff` module scaffold already existed, unaudited, from the
original scaffolding migration — the same category of pre-existing
scaffold as `Medication` (ADR-0014), the flat `MedicalRecord`
(ADR-0008), and `Ward`/`Bed`/`Admission` (ADR-0018) before their own
milestones. Read and audited before any schema change.

**Decision:**

1. **Scope is the non-doctor employee population** (Nurse,
   Receptionist, Lab Technician, Radiology Technician, Pharmacist,
   Cashier, HR, Inventory Manager — every `SystemRole` other than
   `DOCTOR`/`SUPER_ADMIN`/`ORG_ADMIN`). Doctors already have their own
   complete scheduling/leave system (`DoctorSchedule`/`DoctorLeave`/
   `AvailabilityService`, Checkpoint 4.2) — this session did not build
   a second, competing roster for them or attempt to merge the two
   systems into one. "Doctor duty roster" from the roadmap's original
   framing is therefore *already satisfied* by the existing
   Checkpoint 4.2 system, not a gap — recorded explicitly in TD-0039
   rather than left ambiguous.
2. **`Staff` (extended, not replaced)** gained `hospitalId` (it was
   missing — every other professional-profile model in this repo has
   one), `employmentType`/`employmentStatus` enums (replacing the
   scaffold's `isActive` boolean and unused `shiftType` field — mirrors
   the `Ward`/`Room`/`Bed` precedent of ADR-0018: "dedicated Status
   enums... rather than this repo's usual `isActive` boolean"),
   `reportsToId` (a self-relation for the reporting-hierarchy
   deliverable), `dateOfLeaving`, and `monthlySalary` (nullable —
   Payroll Prep's only compensation input). The scaffold's `shiftType:
   ShiftType` field (MORNING/AFTERNOON/NIGHT/ROTATING, a simple enum
   with no timing data) is dropped in favor of a real `Shift` catalog +
   `ShiftRoster` assignment table below — the enum itself
   (`ShiftType`) is kept unremoved since `NursingNote.shift` (Milestone
   12) still uses it for shift-handover tagging, unrelated to this
   milestone.
3. **New models**: `StaffDocument` (mirrors `DoctorDocument` exactly —
   same upload/list/delete service shape, reuses `StorageService`).
   `Shift` (org-scoped catalog — name/code/`HH:mm` start+end/break/
   grace-period/night-shift flag, mirrors `DoctorScheduleDay`'s
   "HH:mm string, read/written as a whole unit" convention).
   `ShiftRoster` (one row per staff per date — `@@unique([staffId,
   date])` — rather than `DoctorSchedule`'s versioned weekly-template
   design; a roster is inherently per-day-assignable (rotating/night
   shifts change day to day for the same person), whereas a doctor's
   schedule is a stable weekly pattern with rare version changes. Two
   different real-world shapes, two different models — not a
   duplicated concept). `Attendance` (one row per staff per date,
   `AttendanceStatus` enum PRESENT/LATE/HALF_DAY/ABSENT/ON_LEAVE/
   HOLIDAY/WEEK_OFF, derived server-side at clock-in/out from the
   day's `ShiftRoster` entry and the shift's grace period/half-day
   threshold — mirrors `laboratory/abnormal-flagging.ts`'s "disclosed,
   documented rule" precedent). `Holiday` (org-scoped calendar).
   `LeaveTypeConfig` (per-org annual-day quota per `LeaveType` —
   reuses the existing `LeaveType`/`LeaveStatus` enums seeded for
   `DoctorLeave`, since the same leave taxonomy applies to any
   employee). `StaffLeave` (mirrors `DoctorLeave` exactly — apply/
   approve/reject/cancel, overlap conflict check, `days` computed on
   read rather than stored).
4. **Leave balance is computed, not a mutable counter**:
   `annualDays` (from `LeaveTypeConfig`) minus the sum of approved
   `StaffLeave` day-spans starting in the requested calendar year —
   mirrors this repo's standing preference for computed fields
   (`Vital.bmi`, `IntakeOutputRecord`'s balance) over a counter that
   can drift from the source rows. A leave spanning a year boundary is
   attributed to its start-date year only — a disclosed simplification
   (see TECH_DEBT), not a fabricated one.
5. **Payroll Prep has no new persisted model** — it's a read-only
   computation over `Attendance`/`StaffLeave`/`ShiftRoster`/`Staff.
   monthlySalary` for a given month, plus a CSV export (hand-built
   string, no new dependency — mirrors no other module needing a CSV
   library either). Deliberately stops at preparation/export; no
   pay-run, payslip, or disbursement model — that's a materially
   different feature (bank file generation, statutory deductions,
   payslip PDFs) explicitly deferred, not attempted partially.
6. **RBAC**: `staff`/`staff.documents` mirror `doctors`/`doctors.
   documents`'s precedent. Three new namespaces — `attendance`
   (`read`/`create`/`update`/`manage` — `create` covers both self
   clock-in/out and HR bulk-marking depending on scope; `manage` gates
   HR's backdated `mark()` override and the Payroll Prep endpoints,
   since both are administrative reads/writes over the same
   attendance data), `leave` (`read`/`approve`/`manage` — deliberately
   mirrors `doctors.leave`'s exact action set, where `manage` covers
   apply+cancel and also gates holiday-calendar CRUD, since both are
   "the staff-leave-and-calendar surface" rather than two distinct
   resources), `shifts`/`shifts.roster` (catalog vs. assignment, same
   split rationale as `ipd.beds` vs. `ipd.transfer`). Every non-doctor
   role in `seed.ts` (Nurse/Receptionist/Lab Technician/Radiology
   Technician/Pharmacist/Cashier/Inventory Manager) is granted
   `.own`-scoped `attendance.read`/`create`/`update`,
   `leave.read`/`manage`, and `shifts.roster.read` — genuine
   self-service, resolved the same way `ipd.admissions`' own-scope
   carve-out resolves a doctor's own profile (a new `StaffRefService.
   findStaffProfileForUser`, mirroring `DoctorRefService`). HR gets
   the full all-scope set across every new namespace plus its own
   self-service grants (an HR employee is themselves staff). Doctors
   are **not** granted any of the new namespaces — their attendance/
   leave stays on the existing `DoctorSchedule`/`DoctorLeave` system,
   deliberately, per point 1.

**Consequences:** Two parallel "time-and-leave" systems now exist in
this repo — Doctor-specific (`DoctorSchedule`/`DoctorLeave`) and
generic-staff (`Shift`/`ShiftRoster`/`Attendance`/`StaffLeave`) — by
design, not oversight (TD-0039). If a future milestone wants one
unified system, that is a deliberate migration decision, not a
silent merge. No biometric hardware integration exists (TD-0039); no
per-organization payroll policy configuration exists yet (TD-0037);
attendance corrections apply immediately with no approval gate
(TD-0038); no browser walkthrough this session (TD-0036), matching
Milestone 13's TD-0035 precedent under the same kind of explicit
instruction.

---

## ADR-0023: Milestone 15 split into five checkpoints; 15.1 delivers the AI platform layer plus seven clinical generators

**Date:** 2026-08-05
**Status:** Accepted
**Context:** Milestone 15 ("AI Features") is the largest single
milestone left on `docs/roadmap.md`: a provider abstraction, prompt
management, PDF/image/voice ingestion, a streaming scheduling chatbot,
per-org usage tracking, and frontend surfaces across half the modules
in the system. Delivering it in one pass would violate this repo's
own 45–60-minute/one-checkpoint session rule and would couple an
untested platform layer to three separate new input-ingestion paths.

The session's explicit instruction also expanded the first checkpoint
beyond `NEXT.md`'s prior framing: seven named clinical generators
(SOAP note, clinical note summarization, lab result summarization,
radiology report summarization, prescription explanation, discharge
summary, referral letter) plus the full non-functional list
(abstraction over four providers, prompt templates, conversation
logging, audit logging, streaming, usage tracking, RBAC, feature
flags, retry/error handling, token accounting, config-driven provider
selection).

**Decision:**

1. **Five checkpoints** (full scope in `NEXT.md`): 15.1 AI Clinical
   Assistant, 15.2 AI Document Intelligence, 15.3 AI Voice & Ambient
   Documentation, 15.4 Conversational Assistant & Scheduling Chatbot,
   15.5 AI Governance/Analytics/Admin.

2. **15.1 is the platform checkpoint.** It builds every cross-cutting
   AI concern once and proves it against the seven generators, which
   were chosen precisely because they are *text-in/text-out over data
   the repo already stores*. No new upload path, no new file parsing,
   no new external dependency beyond the provider HTTP call itself.
   Checkpoints 15.2–15.5 each add exactly one new capability on top of
   an already-verified layer.

3. **The provider abstraction lives in `apps/api/src/common/ai/`, not
   in `modules/ai/`** — mirroring `common/storage`'s driver pattern
   (`STORAGE_DRIVER` symbol + a `useFactory` that picks the driver from
   `ConfigService`) exactly. `AI_PROVIDER` is a DI symbol resolving to
   one of four adapters (OpenAI, Anthropic, Gemini, Ollama);
   `AiClientService` is the only thing any domain module ever injects,
   so switching providers is a config change, not a code change.
   `modules/ai/` holds domain logic only (context building, prompt
   selection, the generators, conversation/usage read APIs).

4. **Providers are real HTTP clients, not stubs.** Each adapter targets
   its vendor's real endpoint (`/v1/chat/completions`, `/v1/messages`,
   `:generateContent`, `/api/chat`) with real request/response and SSE
   parsing. This repo has no AI credentials (`apps/api/.env` holds
   placeholder `sk-xxxxxxxxxxxx` strings), so **when no provider is
   configured every AI endpoint returns `503 Service Unavailable` with
   an explicit message** — it never returns fabricated clinical text.
   This follows the standing precedent for credential-blocked features
   (TD-0015 SMS, TD-0018 lab AI, TD-0019 PACS, TD-0027 payment
   gateway, TD-0039 biometric) and is recorded as **TD-0041**.
   Adapters are unit-tested against a mocked `fetch`, which verifies
   request shaping, response/usage mapping, SSE decoding, and error
   classification without inventing a model response.

5. **Prompt templates: bundled defaults + optional DB override.**
   `DEFAULT_PROMPT_TEMPLATES` (a typed record in
   `modules/ai/prompts/`) is the source of truth and always works with
   an empty database; `AiPromptTemplate` rows are org-scoped, versioned
   overrides looked up per (organization, feature) with the highest
   active version winning. Rationale: a nullable `organizationId` in a
   `@@unique` would have Postgres NULL-distinctness semantics, and a
   seeded-per-org copy would drift silently from the code that renders
   it. Templates are `{{placeholder}}`-rendered — deliberately not a
   template engine, so a prompt can never execute code.

6. **Token accounting is honest about its source.** Providers that
   return real usage (OpenAI/Anthropic non-streaming, Gemini,
   Ollama) have it recorded verbatim. Where a stream omits usage, a
   documented `ceil(chars / 4)` heuristic fills in and
   `AiUsageLog.tokensEstimated` is set `true`, so no consumer can
   mistake an estimate for a metered count. Cost is likewise
   config-driven (`AI_INPUT_COST_PER_1K`/`AI_OUTPUT_COST_PER_1K`,
   default `0`) rather than a hardcoded price table that would go
   stale — a `0` cost reads as "not configured," not "free."

7. **RBAC:** new `ai` resource with `read`/`generate`/`manage`, plus
   `ai.templates` with `read`/`manage`. `ai.generate` is **own-scope
   capable**, resolved exactly like `medical_records`/`prescriptions`
   (`PermissionsService.getScope` + `DoctorRefService.
   findDoctorProfileForUser`): a doctor may only generate against
   encounters/orders/prescriptions/admissions where they are the
   treating doctor. Nurses get all-scope `read`/`generate` for the
   ward-level summarization features, matching `ipd.nursing`'s
   precedent.

8. **Two feature-flag layers.** `AI_ENABLED` is a global kill switch;
   `AI_DISABLED_FEATURES` is a comma-separated per-feature list. Both
   are checked before any context is assembled — a disabled feature
   never reads patient data, which matters because context assembly is
   itself a PHI read.

9. **Streaming is SSE over `POST`, not Nest's `@Sse()`.** `@Sse()`
   implies `GET`, and these requests carry a body (feature +
   context refs) that does not belong in a query string next to
   patient identifiers. The streaming controller therefore writes
   `text/event-stream` to the raw Fastify reply, deliberately
   bypassing `ResponseTransformInterceptor`. Both transports share one
   code path in `AiClientService`; only the sink differs.

10. **One generic `POST /ai/generate` (+ `/stream`) over a
    discriminated-union DTO**, not seven bespoke endpoints. The
    features differ only in which context builder runs and which
    template is selected; seven controllers would have duplicated the
    flag check, scope check, conversation write, and audit write seven
    times. The zod discriminated union keeps each feature's required
    context refs strictly typed at the edge.

**Consequences:** Checkpoints 15.2–15.5 inherit a verified platform and
must not introduce a second provider path, a second usage-logging
table, or a second prompt-rendering mechanism. Until real credentials
exist, every AI surface in the product is reachable, RBAC-gated,
audited, and honest — and produces no clinical content (TD-0041).
Because a `503` is the correct configured-off response, the e2e suite
asserts *that* contract rather than asserting generated text, and will
need extending once a key is available.

---

## ADR-0024: Milestone 3 (Patient Management) completion — family linkage, patient merge, and CSV import

**Date:** 2026-08-05
**Status:** Accepted
**Context:** AI development was explicitly paused after Checkpoint
15.1 with instruction to resume the next unfinished *non-AI* HMS
milestone. `docs/roadmap.md`'s Milestone 3 — Patient Management — had
every deliverable checkbox unchecked despite the module being in daily
use by every later-built milestone (`MODULE_STATUS.md` listed
`patients` as "In Progress / Unaudited," the only pre-Milestone-15
clinical/admin module without a "Completed" row). Reading
`patients.service.ts`/`patients.controller.ts` end to end confirmed
CRUD, UHID generation, search (name/UHID/phone/DOB), the patient
profile/timeline, document upload, emergency contacts, and duplicate
*detection* were all already real and tested — the same "unaudited
scaffold that's actually mostly built" pattern Inventory (Milestone 13)
and Staff (Milestone 14) hit before their own milestones. Exactly three
roadmap deliverables were genuinely missing: **family linkage** (head
of family → members), **patient merge** (duplicate detection existed;
nothing acted on a confirmed duplicate), and **CSV import**.

**Decision:**

1. **Family linkage is one level deep by construction** —
   `Patient.headOfFamilyId` (self-relation) with no separate junction
   table. A head of family cannot itself be someone else's dependent,
   and a patient who already has dependents cannot join another
   family — both enforced in `PatientsService`, not the DB, so listing
   a family is a single `headOfFamilyId` lookup rather than a
   variable-depth graph walk. Reparenting an existing family isn't
   supported (every member must be unlinked first) — a disclosed
   simplification, not a silent gap.

2. **Merge reassigns every other module's `patientId` column inside
   one transaction, then soft-deletes the source with a new
   `mergedIntoId` pointer** — reusing the existing soft-delete plumbing
   (`deletedAt`/`isActive`) rather than inventing a third patient
   lifecycle state. `PATIENT_LINKED_MODELS` in `patients.service.ts` is
   the authoritative list of every model with a direct `patientId`
   column (16 total, including `Payment`/`Charge`, which carry a bare
   `patientId` string with **no** Prisma relation to `Patient` by
   original schema design — the column is still real and still gets
   reassigned). `restore()` now refuses a merged record, since its data
   has already moved to the survivor — attempting to resurrect it
   independently would silently orphan nothing but confuse the UI.

3. **CSV import reuses `PatientsService.create()` per row**, not a
   parallel bulk-insert path — identical UHID generation, phone-
   conflict detection, and Zod validation as a manual registration.
   Rows are processed sequentially (not in parallel) since UHID
   generation counts existing patients per organization inside a
   per-org advisory lock; a 500-row cap bounds worst-case request time.
   A hand-rolled RFC 4180 parser (`csv-parser.util.ts`) was used instead
   of a new dependency — the grammar is small, and `PayrollService`
   already writes CSV by hand elsewhere in this repo (Milestone 14).
   Per the repo's standing rule against fabricated success, a failing
   row is recorded with its reason and the rest of the file still
   processes — no row silently disappears and no fabricated patient is
   ever created from unparseable input.

4. **`patients.manage` is a new permission**, gating merge and CSV
   import only — ordinary `create`/`update` do not imply it. Mirrors
   `billing.manage`/`insurance.settlement`'s requester/approver
   precedent for bulk or hard-to-reverse actions; granted to Hospital
   Admin only by default (via the "every permission" blanket grant),
   not to Receptionist alongside their existing `patients.create`/
   `update`.

**Consequences:** Milestone 3 is now fully complete against
`docs/roadmap.md`'s deliverable list. Any future module that adds a
`patientId` column must be added to `PATIENT_LINKED_MODELS` or a merge
will silently leave that module's records pointing at the deactivated
source patient — flagged here so it isn't missed the way `Payment`'s
un-related Prisma relation would otherwise have been easy to overlook.
