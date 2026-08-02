# PROJECT_CONTEXT.md

> Source of truth for "what is this system." Update whenever a milestone
> completes or the architecture shifts. See `DECISIONS.md` for the *why*
> behind choices referenced here.

## What MediCore Is

MediCore is a production-grade, AI-powered, multi-tenant SaaS Hospital
Management System for hospitals, clinics, and diagnostic centers. It covers
the full operational lifecycle of a healthcare facility: patient
registration through discharge, clinical workflows (OPD/IPD/emergency),
diagnostics (lab/radiology), billing/insurance, pharmacy/inventory, and an
AI copilot layer (summarization, OCR, scheduling assistance, anomaly
detection).

Full feature/vision detail lives in `README.md` and `ARCHITECTURE.md` at the
repo root — read those for depth; this file tracks current state.

## Repository Layout

Monorepo managed with `pnpm` workspaces + `turbo`.

```
apps/
  api/         NestJS backend (REST API, modular by domain)
  web/         Next.js frontend (App Router)
packages/
  config/      Shared config (eslint, tsconfig, etc.)
  database/    Prisma schema + client (@medicore/database)
  types/       Shared TypeScript types
  ui/          Shared UI component library
infra/         Infrastructure/deploy assets
docs/          Documentation, including docs/screens/ for milestone screenshots
```

## Backend (`apps/api`) — NestJS

Domain modules under `apps/api/src/modules/`:

`ai`, `appointments`, `audit`, `auth`, `billing`, `departments`, `doctors`,
`health`, `hospitals`, `insurance`, `inventory`, `laboratory`,
`medical-records`, `notifications`, `organizations`, `patients`, `pharmacy`,
`prescriptions`, `radiology`, `roles`, `scheduling`, `staff`, `users`.

Cross-cutting concerns under `apps/api/src/common/`: decorators (current-user,
permissions, public), guards (jwt-auth, permissions, csrf), email module,
permissions module, redis module, filters, interceptors.

See `MODULE_STATUS.md` for per-module completion state.

## Frontend (`apps/web`) — Next.js

App Router structure under `apps/web/src/`: `app/`, `components/`, `hooks/`,
`lib/`, `middleware.ts`, `providers/`, `types/`. Styled with Tailwind
(`tailwind.config.ts`), component primitives likely shadcn/ui-based
(`components.json`).

## Stack Summary

- Package manager: pnpm (>=9), Node >=20, orchestrated via Turborepo
- Backend: NestJS, Prisma (via `@medicore/database`), Redis, JWT auth
- Frontend: Next.js (App Router), Tailwind CSS
- Testing: Jest (`jest.config.ts`, `jest-e2e.config.ts` in `apps/api`)
- CI: `.github/workflows/ci.yml`
- Containerization: `docker-compose.yml` / `docker-compose.prod.yml`

## Key Root Commands

```
pnpm dev            # turbo run dev (all apps)
pnpm build           # turbo run build
pnpm lint / lint:fix
pnpm typecheck
pnpm test / test:coverage / test:e2e
pnpm db:generate / db:migrate / db:migrate:dev / db:push / db:seed / db:studio
```

## Overall Completion

**Status: Foundational scaffolding in place; most modules unaudited.
Milestone 4 (Doctors + Scheduling), Milestone 5 (Appointment Management),
Milestone 6 (Clinical: Medical Records — both Checkpoint 6.1 EMR
Foundation and Checkpoint 6.2 Orders & Prescriptions), Milestone 7
(Laboratory Management), Milestone 8 (Radiology Management),
Milestone 9 (Pharmacy Management), and Milestone 10 (Billing) are
complete end-to-end (backend, frontend, tests, docs); everything else's
percentage is still provisional.**

See `MODULE_STATUS.md` for the authoritative, maintained breakdown. Until a
session performs a full audit of each module's actual implementation depth,
treat any other percentage here as provisional.

## Milestone 4 — Doctor Management & Scheduling: Complete

Split into two checkpoints (ADR-0005 in `DECISIONS.md`).

- **Checkpoint 4.1 — Doctor Management: Complete.** CRUD, professional
  profile, linked-user onboarding (via the generic `StaffOnboardingService`
  at `apps/api/src/common/onboarding/`), search/filters, dashboard stats,
  doctor profile page. Unit + e2e tests passing; lint/typecheck/build clean.
  See `docs/modules/04-doctor-management.md`.
- **Checkpoint 4.2 — Doctor Scheduling: Complete (2026-07-31).** Weekly
  schedules, leave management, availability engine, dashboard availability
  stats, doctor documents (upload/list/delete), and a per-doctor audit
  timeline — all implemented in `apps/api/src/modules/scheduling/` plus a
  new endpoint on `DoctorsController`. Full frontend (5 new tabs: Schedule,
  Leave, Availability, Documents, Audit) on the doctor profile page. Unit +
  e2e tests passing; lint/typecheck/test/build all clean; browser-verified
  end to end against the local dev servers.

`StaffOnboardingService` is intentionally generic (knows nothing about
`Doctor` specifically) so Nurse, Pharmacist, Lab Technician, Receptionist,
and other future staff-profile modules can reuse it unmodified.

## Milestone 5 — Appointment Management: Complete

Split into two checkpoints (ADR-0006, ADR-0007 in `DECISIONS.md`),
mirroring Milestone 4's precedent.

- **Checkpoint 5.1 — Core booking: Complete (2026-08-01).**
  Conflict-aware booking (reuses `AvailabilityService` from Checkpoint 4.2,
  subtracts existing-appointment overlaps), the full status state machine
  (scheduled → confirmed → arrived → in-consultation → completed, plus
  cancel/no-show), email confirmation (`EmailService` reuse), and a
  per-doctor audit-timeline integration — all in
  `apps/api/src/modules/appointments/`. Full frontend (day-view queue +
  booking dialog) at `apps/web/src/app/dashboard/appointments/`.
- **Checkpoint 5.2 — Queue & Recurring: Complete (2026-08-01).** A
  dedicated walk-in flow (`isWalkIn` flag, auto-assigns the next available
  slot today) and recurring appointments (`recurrenceGroupId`, independent
  rows per occurrence, partial-success reporting) — see ADR-0007. Frontend:
  a walk-in quick-book dialog and a "Recurring booking" toggle in the
  existing booking dialog. **SMS confirmations are explicitly deferred**
  (genuinely credential-blocked — no SMS provider configured anywhere in
  this repo; see TECH_DEBT TD-0015) rather than faked.

Both checkpoints: unit + e2e tests passing; lint/typecheck/test/build all
clean; browser-verified end to end (real booking, real slot computation,
real status walk, real walk-in auto-assignment, real recurring series).

`docs/roadmap.md` has been reconciled — "Appointment Management" is now
the roadmap's actual Milestone 5, with every subsequent milestone
renumbered accordingly.

## Milestone 6 — Clinical: Medical Records: Complete

Split into two checkpoints (ADR-0009 in `DECISIONS.md`), mirroring
Milestones 4/5's precedent.

- **Checkpoint 6.1 — EMR Foundation: Complete (2026-08-01).** `Encounter`
  replaces the flat `MedicalRecord` scaffold as the central per-consultation
  entity (ADR-0008): type (OPD/Teleconsultation/Follow-up/Emergency/
  Walk-in) and a status state machine (In Progress → Completed → Amended).
  Append-only, versioned Clinical Notes (never overwrites history), Vitals
  (server-computed BMI + cross-encounter trend), Diagnoses
  (primary/secondary/differential + ICD-10 placeholder), Procedures, and
  Attachments (reuses `StorageService`) — all in
  `apps/api/src/modules/medical-records/`. Full REST + Swagger + RBAC
  (own/all-scope) + audit integration + pagination/filtering. Frontend:
  `/dashboard/medical-records` (patient timeline) and
  `/dashboard/medical-records/[encounterId]` (SOAP-style encounter view).
  Unit + e2e tests passing; lint/typecheck/test/build all clean;
  browser-verified end to end (encounter creation, clinical-note
  versioning/autosave, vitals with BMI, diagnoses, procedures, attachment
  upload, status transitions).
- **Checkpoint 6.2 — Orders & Prescriptions: Complete (2026-08-01).**
  Prescription CRUD from an encounter (reuses the pre-existing
  `Prescription`/`PrescriptionItem` models from the original scaffolding
  commit; `status` converted to a proper enum — ADR-0010), a basic
  bundled drug-interaction check (non-blocking, explicitly disclosed as
  non-exhaustive — TECH_DEBT TD-0016), and PDF generation/download
  (`pdfkit`) — all in `apps/api/src/modules/prescriptions/`. Own/all-scope
  RBAC on the existing `prescriptions.*` permission resource, audit
  integration. Frontend: a Prescriptions tab on the encounter detail page
  (multi-item prescribe form, interaction warnings, PDF download, status
  actions) and a "Recent prescriptions" panel on the patient timeline.
  Unit + e2e tests passing; lint/typecheck/test/build all clean;
  browser-verified end to end (prescription creation with a real detected
  interaction warning, PDF download verified as a genuine PDF, status
  transition to Discontinued, patient-timeline panel).

Both checkpoints: unit + e2e tests passing; lint/typecheck/test/build all
clean; browser-verified end to end. **Milestone 6 is now fully complete.**

Per **ADR-0011**, the former "Laboratory & Radiology" milestone was split
into **Milestone 7 — Laboratory Management** and its own **Milestone 8 —
Radiology Management** follow-up (`docs/roadmap.md`'s Milestones 8–14
renumbered to 9–15 accordingly).

## Milestone 7 — Laboratory Management: Complete

Completed in a single session (2026-08-02), no checkpoint split needed.

- Lab test catalog (`LabTestCatalogItem`, org-scoped — numeric reference
  range, text reference range, or both; optional explicit critical
  bounds) — see **ADR-0012**.
- `LabTest.encounterId` added so orders can be created directly from a
  consultation (`Encounter`), mirroring `Prescription.encounterId`.
- Lab order creation (catalog-sourced or ad-hoc items), sample collection
  tracking, structured per-item result entry with server-computed
  abnormal-value flagging (HIGH/LOW/CRITICAL_HIGH/CRITICAL_LOW — the
  exact rule is disclosed in `abnormal-flagging.ts`), a full status state
  machine (Ordered → Sample Collected → In Progress → Completed →
  Reported, Cancelled from any non-terminal state).
  Two independent report paths: external report file upload and a
  structured, system-generated PDF (`pdfkit`).
  Own/all-scope RBAC on `laboratory.*` (Doctor is own-scoped; Lab
  Technician/Nurse remain all-scope — see ADR-0012), audit integration —
  all in `apps/api/src/modules/laboratory/`.
- Frontend: a Lab Orders tab on the encounter detail page, a "Recent lab
  orders" panel on the patient timeline, and a new `/dashboard/laboratory`
  org-wide queue page with a catalog-management dialog.
- Unit + e2e tests passing (33 new unit, 19 new e2e — 208 unit / 121 e2e
  total); lint/typecheck/test/build all clean; browser-verified end to
  end (catalog item creation, order creation from a real encounter,
  sample collection, an abnormal result correctly flagged "Critical
  high," a genuine downloaded PDF report).
- **AI-powered lab report summarization is explicitly deferred**
  (genuinely credential-blocked — no AI/LLM provider is configured
  anywhere in this repo; see TECH_DEBT TD-0018) rather than faked.

## Milestone 8 — Radiology Management: Complete

Completed in a single session (2026-08-02), no checkpoint split needed.
Explicit user instruction this session asked for a full Radiology
Information System — materially more than `NEXT.md`'s narrower framing
(see **ADR-0013** for the scope-expansion decision).

- Radiology catalog (`RadiologyCatalogItem`, org-scoped — name, code,
  category, modality, body part, contrast required, price, estimated
  duration).
- `RadiologyOrder.encounterId`/`catalogItemId` added so orders can be
  created directly from a consultation (`Encounter`) or from the
  catalog, mirroring `LabTest`'s pattern (ADR-0012/0013).
- Scheduling (appointment date/time, room, machine, technician,
  radiologist, duration) with reschedule support.
- Versioned reports (`RadiologyReport`, append-only, mirrors
  `ClinicalNote`) — clinical indication, technique, findings,
  impression, recommendations — with a sequential verify → release
  workflow before an order reaches `REPORTED`.
- Image attachments (`RadiologyAttachment`) — real image/PDF uploads via
  `StorageService`, plus metadata-only external-imaging/DICOM-placeholder
  references for studies held in an outside PACS (no real PACS/DICOM
  integration — this is the designed extension point for one).
- A full status state machine (`ORDERED → SCHEDULED → IN_PROGRESS →
  COMPLETED → REPORTED`, `CANCELLED` from any non-terminal state,
  `REJECTED` from `ORDERED`), a structured system-generated PDF report,
  an independent external report-file upload path, and dashboard stats.
- Own/all-scope RBAC on `radiology.*` (Doctor is own-scoped; a new
  Radiology Technician role and Nurse remain all-scope — see ADR-0013),
  audit integration — all in `apps/api/src/modules/radiology/`.
- Frontend: a Radiology dashboard (`/dashboard/radiology`), an org-wide
  orders queue (`/dashboard/radiology/orders`), a catalog management
  page (`/dashboard/radiology/catalog`), an order detail page
  (`/dashboard/radiology/[orderId]`, Scheduling/Report/Attachments
  tabs), a Radiology tab on the encounter detail page, and a "Recent
  imaging" panel on the patient timeline.
- Unit + e2e tests passing (34 new unit, 29 new e2e — 242 unit / 150
  e2e total); lint/typecheck/test/build all clean; browser-verified end
  to end (catalog item creation, order creation from a real encounter,
  scheduling, the full study → report → verify → release lifecycle
  ending in a genuine "Reported" status, a real downloaded PDF, an
  uploaded image attachment, an external/DICOM-placeholder attachment).
- **AI-powered image interpretation and real PACS/DICOM server
  integration are explicitly out of scope by instruction** (see
  TECH_DEBT TD-0019) rather than faked.

## Milestone 9 — Pharmacy Management: Complete

Completed in a single session (2026-08-03), no checkpoint split needed.
Explicit user instruction reordered the roadmap ahead of `NEXT.md`'s plan
(Billing & Insurance) — see **ADR-0014** for the reorder-and-split
decision (`docs/roadmap.md` now: Milestone 9 Pharmacy, Milestone 10
Billing & Insurance, Milestone 11 General Inventory).

- Drug catalog (`Drug`, org-scoped — one row per batch: generic/brand
  name, strength, dosage form, manufacturer, batch number, expiry,
  price, tax, active, current/reserved/available stock, minimum stock,
  reorder level). Replaces the unused `Medication` model from the
  original scaffolding commit — see ADR-0014.
- Dispensing workflow (`DispenseOrder`/`DispenseItem`, one order per
  prescription) — a full status state machine (`PENDING → PREPARING →
  READY → DISPENSED`, plus `CANCELLED`/`RETURNED`): create from a
  prescription, batch selection (reserves stock), mark ready, partial
  dispense (repeatable), complete dispense (completes the source
  prescription), reject/cancel (releases reservations).
- Medicine returns (`DrugReturn`) — restocks the drug and moves the
  order to `RETURNED`, fully audited.
- All-scope RBAC on `pharmacy.*` (staff-facing, like billing/insurance —
  no doctor own-scope; Pharmacist gained `prescriptions.update` to
  complete the source prescription on full dispense), pagination/
  filtering/sorting, dashboard stats, audit integration — all in
  `apps/api/src/modules/pharmacy/`.
- Frontend: a Pharmacy dashboard (`/dashboard/pharmacy`), a drug catalog
  page (`/dashboard/pharmacy/catalog`), a dispensing queue
  (`/dashboard/pharmacy/dispense`, with a "New dispense" picker), a
  dispense detail page (`/dashboard/pharmacy/[dispenseId]`, batch
  selection/workflow actions/returns), a stock page
  (`/dashboard/pharmacy/stock`, low-stock/expiring filters + inline
  adjustment), and a "Dispense" button on the encounter detail page's
  Prescriptions tab.
- Unit + e2e tests passing (25 new unit, 20 new e2e — 267 unit / 170
  e2e total); lint/typecheck/test/build all clean; browser-verified end
  to end (drug batch creation including a low-stock/near-expiry one,
  full dispense lifecycle from a real prescription through partial
  dispense/complete/return, source prescription confirmed "Completed,"
  a separately rejected order). One real bug caught and fixed during
  this pass: the dashboard's "Dispensed today" stat undercounted orders
  that had since moved to `RETURNED`.
- **General (non-drug) inventory and pharmacy↔billing integration are
  explicitly out of scope** — deferred to Milestones 11 and 10
  respectively (Billing itself is out of scope entirely this session).

## Milestone 10 — Billing: Complete

Completed in a single session (2026-08-03), no checkpoint split needed.
Explicit user instruction narrowed this session's scope to Billing only
("Insurance is NOT part of this milestone") — see **ADR-0015** for the
scope decision and roadmap split (Insurance is now its own Milestone 11).

- Charge Engine (`Charge`, org-scoped) — the reusable entity any
  clinical module (or a manual cashier action) bills a patient through,
  via a `sourceModule`/`sourceId` pair rather than a hard FK into each
  module's own tables.
- Service catalog with pricing (`ServiceCatalogItem`, org-scoped).
- Invoice creation from manual line items and/or by sweeping a
  patient's existing pending charges; manual line-item addition to a
  draft invoice.
- Discount management (flat or percentage) with a full approval
  workflow — a `billing.manage` holder's request auto-approves and
  applies immediately, anyone else's lands pending until approved or
  rejected.
- GST-compliant invoicing (per-item and invoice-level tax breakdown,
  reusing `Organization.settings.gstRate`).
- Multiple payment modes (cash, card, UPI, bank transfer/NEFT/RTGS,
  cheque) — split and partial payments both work by recording more than
  one payment against an invoice, no separate endpoint needed.
- Refunds (partial or full, same approval-workflow shape as discounts) —
  any completed refund flips the invoice to "Refunded," mirroring
  `DispenseOrder`'s "Returned" precedent from Milestone 9.
- Invoice and payment-receipt PDF generation — hospital branding,
  itemized GST breakdown, a disclosed QR placeholder (no payment gateway
  is configured anywhere in this repo — see TECH_DEBT TD-0027).
- Auto-invoice generation from a completed appointment (a consultation
  charge priced from the doctor's consultation fee, swept into a new
  draft invoice) via a dedicated event listener.
- Revenue dashboard (today's revenue, pending invoices, outstanding
  balance, refunds today, pending discount/refund approvals, 7-day
  collection trend).
- All-scope RBAC on `billing.*` (staff-facing, no doctor own-scope),
  audit integration, pagination/filtering — all in
  `apps/api/src/modules/billing/`.
- Frontend: a Billing dashboard (`/dashboard/billing`), an invoices list
  + create dialog + detail page (`/dashboard/billing/invoices*` —
  discount/payment/refund actions, PDF download), a payments list
  (`/dashboard/billing/payments`), and a refunds list
  (`/dashboard/billing/refunds`).
- Unit + e2e tests passing (46 new unit, 29 new e2e — 359 unit / 199 e2e
  total); lint/typecheck/test/build all clean; browser-verified end to
  end (invoice creation, discount approval, finalize, split/partial
  payment to "Paid," refund to "Refunded," all list pages and the
  dashboard reflecting real activity). Two real bugs caught and fixed
  during this pass: the new-invoice dialog didn't navigate to the
  created invoice, and the dashboard's collection-trend bars didn't
  render (a CSS percentage-height bug).
- **Insurance is explicitly out of scope this milestone** (by
  instruction, now its own Milestone 11) — see TECH_DEBT/DECISIONS for
  the reasoning. No standalone Service Catalog/Charges admin UI was
  built (TD-0024); `InvoiceStatus.OVERDUE` is never automatically set,
  since no scheduled-job infrastructure exists in this repo (TD-0026).

See `.ai/NEXT.md` for **Milestone 11 — Insurance Management**, next.

## Milestone Screenshots

- `docs/screens/doctors-list.png` — Doctors list (search/filter/stats).
- `docs/screens/doctors-registration-form.png` — Multi-step doctor
  registration form.
- `docs/screens/doctor-profile-tabs-overview.png` — Doctor profile page,
  Profile tab, showing all 7 tabs.
- `docs/screens/doctor-schedule-tab.png` — Schedule tab: current effective
  schedule + version history.
- `docs/screens/doctor-schedule-new-version-dialog.png` — New schedule
  version editor (7-day/shift/break form).
- `docs/screens/doctor-leave-tab.png` — Leave tab: an approved leave
  request.
- `docs/screens/doctor-availability-tab.png` — Availability tab: today
  status + bookable slots for a working day.
- `docs/screens/doctor-documents-tab.png` — Documents tab: an uploaded
  document.
- `docs/screens/doctor-audit-tab.png` — Audit tab: schedule/leave/document
  events for one doctor.
- `docs/screens/appointments-empty.png` — Appointments day-view queue, empty
  state, with date navigator and filters.
- `docs/screens/appointments-booking-dialog.png` — Booking dialog: patient
  picked, doctor dropdown open.
- `docs/screens/appointments-booking-slots.png` — Booking dialog: live
  available-slot chips computed from the doctor's real schedule.
- `docs/screens/appointments-queue.png` — Queue view with a booked
  appointment (Scheduled → Confirmed transition button visible).
- `docs/screens/appointments-status-transitions.png` — Queue view after
  walking the appointment to Arrived (next transition: In consultation).
- `docs/screens/appointments-walkin-dialog.png` — Walk-in quick-book
  dialog with patient and doctor selected.
- `docs/screens/appointments-walkin-queue.png` — Queue showing a booked
  walk-in with its badge and the "Walk-in booked" toast.
- `docs/screens/appointments-recurring-dialog.png` — Booking dialog with
  the Recurring toggle enabled (start date/time/frequency/occurrences).
- `docs/screens/appointments-recurring-toast.png` — "Booked 4/4
  occurrences" success toast.
- `docs/screens/appointments-recurring-queue.png` — Queue showing one
  occurrence of a recurring series with its badge.
- `docs/screens/medical-records-list.png` — Medical Records patient
  timeline: encounter list with filters.
- `docs/screens/medical-records-new-encounter-dialog.png` — New encounter
  dialog: patient/doctor/type/notes.
- `docs/screens/encounter-detail-subjective.png` — Encounter detail page,
  Subjective tab (clinical notes form), freshly created.
- `docs/screens/encounter-clinical-notes-autosave.png` — Subjective tab
  after filling all 8 fields, autosave indicator showing "Saved as new
  version."
- `docs/screens/encounter-clinical-notes-version-history.png` — Version
  history dialog showing Version 1's full content.
- `docs/screens/encounter-objective-vitals-form.png` — Objective tab:
  vitals form filled in, ready to save.
- `docs/screens/encounter-objective-vitals-recorded.png` — Objective tab
  after saving: BMI computed (23.5), BMI trend chart, vitals history row.
- `docs/screens/encounter-assessment-diagnoses.png` — Assessment tab: a
  Primary diagnosis with an ICD-10 placeholder code added.
- `docs/screens/encounter-plan-procedures.png` — Plan tab: a procedure
  added, encounter notes shown read-only.
- `docs/screens/encounter-status-completed.png` — Encounter header after
  the In Progress → Completed status transition (next available
  transition: Amended).
- `docs/screens/encounter-attachments-before-upload.png` — Attachments
  tab with a file chosen, before clicking Upload.
- `docs/screens/encounter-attachments-uploaded.png` — Attachments tab
  after uploading a document, showing it listed with a delete action.
- `docs/screens/encounter-prescriptions-empty.png` — Prescriptions tab,
  freshly created encounter, empty prescribe form.
- `docs/screens/encounter-prescriptions-form.png` — Prescriptions tab
  with a 2-item prescription filled in (Aspirin + Warfarin).
- `docs/screens/encounter-prescriptions-interaction-warning.png` —
  Prescriptions tab after saving, showing the detected "severe" drug
  interaction warning.
- `docs/screens/encounter-prescriptions-list.png` — Prescriptions tab
  with two prescriptions listed for the encounter.
- `docs/screens/encounter-prescriptions-discontinued.png` — Prescriptions
  tab after discontinuing one prescription, showing its updated badge.
- `docs/screens/medical-records-recent-prescriptions.png` — Patient
  timeline list page's "Recent prescriptions" panel for a filtered patient.
- `docs/screens/lab-queue-empty.png` — `/dashboard/laboratory` org-wide
  queue page, empty state, with doctor/status/priority filters.
- `docs/screens/lab-catalog-dialog.png` — Manage Catalog dialog, a new
  test filled in before submitting.
- `docs/screens/lab-catalog-added.png` — Manage Catalog dialog after
  adding the "Fasting Blood Sugar" catalog item.
- `docs/screens/lab-orders-tab-empty.png` — Encounter detail page's new
  Lab Orders tab, freshly opened, empty order form.
- `docs/screens/lab-order-form-filled.png` — Lab Orders tab with a
  catalog test selected in the new-order form.
- `docs/screens/lab-order-created.png` — Lab Orders tab after saving,
  showing the order with a real `LAB-MED-2026-000001` order number and
  "Ordered" status.
- `docs/screens/lab-sample-collected.png` — Lab Orders tab after
  collecting the sample, status updated to "Sample collected."
- `docs/screens/lab-result-entry-form.png` — Inline result-entry form
  with a result value typed in, before saving.
- `docs/screens/lab-abnormal-result.png` — Lab Orders tab after saving
  results, showing the item's abnormal "Critical high" badge and the
  order's "Completed" status.
- `docs/screens/radiology-dashboard.png` — `/dashboard/radiology`
  dashboard, stat tiles + recent urgent/STAT studies (empty state).
- `docs/screens/radiology-catalog-dialog.png` — Catalog page, a new
  study filled in before submitting.
- `docs/screens/radiology-catalog-added.png` — Catalog page after
  adding the "X-Ray Chest" study, "Catalog item added" toast.
- `docs/screens/radiology-encounter-tab-empty.png` — Encounter detail
  page's new Radiology tab, freshly opened.
- `docs/screens/radiology-encounter-order-form-filled.png` — Radiology
  tab with a catalog study selected in the new-order form.
- `docs/screens/radiology-encounter-order-created.png` — Radiology tab
  after saving, showing the order with a real `RAD-MED-2026-000001`
  order number and "Ordered" status.
- `docs/screens/radiology-order-detail-scheduling-empty.png` — Order
  detail page, Scheduling tab, freshly opened.
- `docs/screens/radiology-order-schedule-filled.png` — Scheduling tab
  with date/time/room/machine filled in, before saving.
- `docs/screens/radiology-order-scheduled.png` — Order detail page
  after scheduling, status updated to "Scheduled."
- `docs/screens/radiology-order-in-progress.png` — Order detail page
  after starting the study, status "In progress."
- `docs/screens/radiology-order-completed.png` — Order detail page
  after completing the study, status "Completed."
- `docs/screens/radiology-report-form-filled.png` — Report tab with all
  5 fields (clinical indication/technique/findings/impression/
  recommendations) filled in.
- `docs/screens/radiology-report-saved.png` — Report tab after saving
  version 1.
- `docs/screens/radiology-report-verified.png` — Report tab after
  verification, showing the "Verified" timestamp.
- `docs/screens/radiology-report-released.png` — Report tab after
  release, status "Reported," version history showing v1, PDF download
  button visible.
- `docs/screens/radiology-attachment-external-added.png` — Attachments
  tab after adding a DICOM-placeholder reference (accession number,
  no file).
- `docs/screens/radiology-attachment-image-uploaded.png` — Attachments
  tab after uploading a real image file, listed alongside the external
  reference.
- `docs/screens/radiology-orders-queue.png` — `/dashboard/radiology/orders`
  org-wide queue showing the created order with its real order number
  and "Reported" status.
- `docs/screens/medical-records-recent-imaging.png` — Patient
  timeline's "Recent imaging" panel for the filtered patient.
- `docs/screens/pharmacy-dashboard-empty.png` — `/dashboard/pharmacy`
  dashboard, empty state, stat tiles + quick links.
- `docs/screens/pharmacy-catalog-empty.png` — Catalog page, empty state,
  new-batch form.
- `docs/screens/pharmacy-catalog-dialog-filled.png` — New-batch form
  filled in for a Paracetamol batch, before submitting.
- `docs/screens/pharmacy-catalog-populated.png` — Catalog page with
  three drugs, showing "Low stock"/"Expiring soon" badges on Ibuprofen.
- `docs/screens/pharmacy-stock-overview.png` — Stock page, all batches
  with current/reserved/available columns and warning badges.
- `docs/screens/pharmacy-stock-low-stock-filter.png` — Stock page
  filtered to low-stock batches only.
- `docs/screens/pharmacy-dispense-queue-empty.png` — Dispensing queue,
  empty state.
- `docs/screens/pharmacy-new-dispense-dialog.png` — "New dispense"
  dialog with an active prescription selected.
- `docs/screens/pharmacy-dispense-detail-pending.png` — Dispense detail
  page, freshly created order, status "Pending," no batches selected.
- `docs/screens/pharmacy-dispense-batches-selected.png` — Detail page
  with a batch selected for each item, before saving.
- `docs/screens/pharmacy-dispense-preparing.png` — Detail page after
  saving batch selection, status "Preparing."
- `docs/screens/pharmacy-dispense-ready.png` — Detail page after
  marking ready, status "Ready," partial-dispense quantity inputs shown.
- `docs/screens/pharmacy-dispense-partial.png` — Detail page after a
  partial dispense (4 of 10 units), status still "Ready."
- `docs/screens/pharmacy-dispense-dispensed.png` — Detail page after
  completing the dispense, status "Dispensed," Returns section shown.
- `docs/screens/pharmacy-prescription-completed-on-encounter.png` — The
  source encounter's Prescriptions tab, confirming the prescription
  flipped to "Completed."
- `docs/screens/pharmacy-dispense-returned.png` — Detail page after
  recording a partial return, status "Returned," return listed.
- `docs/screens/pharmacy-dispense-rejected.png` — A second order after
  being rejected with a reason, status "Cancelled."
- `docs/screens/pharmacy-dashboard-populated.png` — Dashboard with real
  counts (pending/low-stock/expiring) and a pending-prescriptions panel.
- `docs/screens/pharmacy-dispense-queue-populated.png` — Dispensing
  queue showing all three created orders (Pending/Returned/Cancelled).
- `docs/screens/billing-dashboard-empty.png` — Billing dashboard, empty
  state, stat tiles + collection-trend chart.
- `docs/screens/billing-invoices-list-empty.png` — Invoices list, empty
  state, with the "New invoice" button.
- `docs/screens/billing-new-invoice-patient-search.png` — New-invoice
  dialog, patient search results shown.
- `docs/screens/billing-new-invoice-line-item.png` — New-invoice dialog
  with a manual "General Consultation" line item filled in.
- `docs/screens/billing-invoice-detail-draft.png` — Invoice detail page,
  freshly created draft, ₹944 total (₹800 + 18% GST).
- `docs/screens/billing-discount-dialog.png` — Apply-discount dialog,
  10% percentage discount with a reason filled in.
- `docs/screens/billing-invoice-discount-approved.png` — Invoice detail
  after the discount auto-approved (admin holds `billing.manage`), total
  recomputed to ₹864.
- `docs/screens/billing-invoice-finalized.png` — Invoice detail after
  finalizing, status "Issued."
- `docs/screens/billing-record-payment-dialog.png` — Record-payment
  dialog, ₹400 cash payment before submitting.
- `docs/screens/billing-invoice-partially-paid.png` — Invoice detail
  after the first ₹400 payment, status "Partially paid," balance ₹464.
- `docs/screens/billing-invoice-paid.png` — Invoice detail after the
  second ₹400 payment, status "Paid," balance ₹0.
- `docs/screens/billing-refund-dialog.png` — Request-refund dialog, ₹200
  partial refund with a reason filled in.
- `docs/screens/billing-invoice-refunded.png` — Invoice detail after the
  refund completed (admin holds `billing.manage`), status "Refunded,"
  both payments and the refund listed.
- `docs/screens/billing-payments-list.png` — Org-wide payments list
  showing both recorded payments with receipt-download actions.
- `docs/screens/billing-refunds-list.png` — Org-wide refunds list
  showing the completed refund.
- `docs/screens/billing-invoices-list-populated.png` — Invoices list
  showing all three created invoices with real status badges.
- `docs/screens/billing-dashboard-populated.png` — Dashboard with real
  counts (₹800 today's revenue, 2 pending invoices, ₹200 refunds today)
  and a rendered 7-day collection-trend chart.
