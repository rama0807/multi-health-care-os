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
Milestone 9 (Pharmacy Management), Milestone 10 (Billing),
Milestone 11 (Insurance Management), Milestone 12 (IPD & Bed
Management — both Checkpoint 12.1 Admission/Wards/Beds and
Checkpoint 12.2 Nursing/MAR/Discharge), Milestone 13 (General
Inventory), and Milestone 14 (Staff & Attendance) are complete
end-to-end (backend, frontend, tests, docs); everything else's
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

See `.ai/DECISIONS.md` ADR-0016 for the Milestone 11 scope decision.

## Milestone 11 — Insurance Management: Complete

Completed in a single session (2026-08-04), no checkpoint split needed.
The session's instruction gave a materially larger deliverable list
than `NEXT.md`'s prior framing — see **ADR-0016** for the full scope
decision and reasoning.

- Insurance Provider (`InsuranceProvider` — Insurance Company/TPA/
  Corporate) and Plan (`InsurancePlan` — coverage %/co-pay %/
  deductible/annual limit/per-visit limit/network type) management,
  org-scoped.
- Per-patient coverage (`PatientInsurance` — primary/secondary, member
  ID/policy number/effective+expiry dates); one active coverage per
  type enforced at the application layer, not a DB constraint, so a
  patient's coverage history (expired enrollments) stays queryable.
- Cashless/TPA pre-authorization workflow (`PreAuthorization` — Draft →
  Submitted → Under Review → Approved/Partially Approved/Rejected/
  Cancelled) with clinical notes and file attachments (reuses the
  existing `StorageService`).
- Claims workflow plus settlement (`InsuranceClaim` — Draft →
  Submitted → Under Review → Approved/Partially Approved/Rejected →
  Settled/Partially Settled → Closed). Settling a claim records the
  insurance share as a real `Payment` (`paymentMode: INSURANCE`)
  against the linked invoice via the existing `PaymentsService` — the
  same mechanism a cash/card payment already uses.
- Automatic claim-document attachment (`ClaimDocument`) — Invoice,
  Prescription, Lab Report, and Radiology Report PDFs are auto-attached
  by reusing each module's existing PDF generator, plus a new
  purpose-built Encounter Summary generator; manual uploads also
  supported. A generator failure is logged and skipped rather than
  blocking claim creation.
- Insurance dashboard (today's claims, pending approval, rejected,
  settled, insurance revenue, outstanding claims).
- All-scope RBAC split into `insurance.providers`/`plans`/`claims`/
  `preauth`/`settlement` (the last `.manage`-gated admin-only, mirroring
  `billing.manage`'s requester/approver separation), audit integration —
  all in `apps/api/src/modules/insurance/`.
- Frontend: an Insurance dashboard (`/dashboard/insurance`), Providers
  and Plans list pages, a Pre-Authorization queue, a Claims queue, a
  claim detail page (`/dashboard/insurance/[claimId]` — settlement
  panel, lifecycle timeline, document list, every workflow action). The
  Patient detail page's placeholder "Insurance" tab now shows real
  coverage records; the Encounter detail page gained a new "Insurance"
  tab (pre-auth/claim list + request-preauth/file-claim actions).
- Unit + e2e tests passing (46 new unit, 11 new e2e — 359 unit / 210
  e2e total); lint/typecheck/test/build all clean; browser-verified end
  to end (provider/plan creation, patient coverage, a pre-auth walked to
  Approved, a claim filed with real auto-attached documents and walked
  through Submit → Under Review → Approved → Settled → Closed,
  confirming a real `Payment` landed against the invoice). One real bug
  caught and fixed during this pass: the "Add provider" dialog sent
  empty strings instead of `undefined` for unfilled optional fields,
  which broke `email`'s Zod format validation.
- **Deferred, disclosed, not faked**: Discharge Summary auto-attach
  (explicitly future — IPD/discharge doesn't exist yet); an
  encounter→invoice lookup endpoint, so filing a claim from the
  Encounter Insurance tab asks for the invoice ID as free text
  (TD-0028); the claim detail page's "Timeline" is synthesized from the
  claim's own lifecycle timestamps, not a full audit-trail feed like the
  Patient page's dedicated Timeline/Audit tabs (TD-0029).

## Milestone 12, Checkpoint 12.1 — IPD Admission, Wards & Bed Management: Complete

Completed in a single session (2026-08-04). The `Ward`/`Bed`/
`Admission` models existed unaudited since the original scaffolding
migration (never wired to any module) — extended rather than built
from scratch; see **ADR-0018** for the full schema audit and design
decisions.

- Ward (name/code/floor/block/type/status), Room (room number/ward/
  floor/capacity/charges-per-day/status), and Bed (bed number/room/
  ward/type/status — `AVAILABLE`/`RESERVED`/`OCCUPIED`/`CLEANING`/
  `MAINTENANCE`/`BLOCKED`) inventory CRUD, all org-scoped, soft-
  deactivate only.
- Admission workflow (`Admission`, sequential `ADM-` numbering) —
  supports Emergency/Scheduled/Insurance/Transfer-from-OPD via one
  code path; auto-creates a fresh `IPD`-type `Encounter` or reuses a
  passed-in one (the natural shape for Transfer-from-OPD); accepts an
  optional bed at creation or leaves the admission ward-only for later
  allocation; a cancel action releases any held bed.
- Bed Allocation workflow (`BedAllocation`/`BedTransfer`) — allocate/
  reserve/cancel-reservation/vacate/transfer, each producing a full
  audit trail; a vacated or transferred-from bed lands in `CLEANING`
  (a real ward workflow), not directly back in `AVAILABLE`.
- IPD dashboard (available/occupied beds, ICU occupancy, admissions
  today, transfers today, and a discharges-today stat that's a real
  query but always reads 0 this checkpoint since nothing sets
  `AdmissionStatus.DISCHARGED` yet).
- All-scope RBAC on `ipd.wards`/`ipd.rooms`/`ipd.beds`/`ipd.transfer`,
  own-scope-capable `ipd.admissions` (a doctor manages only admissions
  where they're attending, mirroring `medical_records`/
  `prescriptions`), audit integration — all in
  `apps/api/src/modules/ipd/`.
- Frontend: an IPD dashboard (`/dashboard/ipd`), Wards/Rooms list pages
  with add/edit dialogs, a color-coded Bed Grid (`/dashboard/ipd/beds`,
  grouped by ward/room, deep-linkable via `?wardId=`/`?roomId=`), an
  Admissions queue with a 5-step Admit Patient wizard
  (`/dashboard/ipd/admissions`), and an admission detail page
  (`/dashboard/ipd/[admissionId]` — allocate/reserve/cancel-
  reservation/vacate/transfer actions, a merged bed-allocation-and-
  transfer history timeline). The Patient detail page gained a real
  "Admissions" tab (current admission + full history, encounter link).
  The sidebar's dormant "Wards & Beds" nav item (unbuilt since
  Milestone 4) is now "IPD & Beds", pointing at `/dashboard/ipd`.
- Unit + e2e tests passing (47 new unit, 16 new e2e — 406 unit / 226
  e2e total across the whole API, zero failures); lint/typecheck/build
  all clean; browser-verified end to end (ward/room/bed creation, a
  full Admit Patient wizard walkthrough producing a real
  `ADM-MED-2026-000002` admission with an auto-created IPD encounter,
  a bed transfer with the vacated bed correctly landing in "Cleaning,"
  the bed grid and dashboard reflecting real live counts, the
  patient's new Admissions tab).
- **Deferred, disclosed, not faked**: Nursing Notes, Medication
  Administration, and Discharge Summary are explicitly Checkpoint
  12.2 by instruction; IPD billing integration is deferred alongside
  discharge, since a per-stay charge's only sensible trigger is
  discharge itself (TD-0030 — resolved in Checkpoint 12.2). Deactivating
  a ward/room doesn't check for occupied beds inside it, unlike
  bed-level deactivation which already blocks on `OCCUPIED` (TD-0031).

## Milestone 12, Checkpoint 12.2 — Nursing, Medication Administration & Discharge: Complete

Completed in a single session (2026-08-04). See **ADR-0019** for the
reuse decisions (nursing docs as new admission-scoped models vs.
`ClinicalNote` reuse, vitals reusing the existing `Vital` model as-is,
MAR reusing `Prescription`/`PrescriptionItem` with an admin-log child
table) and the discharge/billing workflow design.

- Nursing documentation — `NursingNote` (general/shift-handover/
  assessment/incident + an `isEscalated` flag), `NursingAssessment`
  (one consolidated row per charting event: pain score, fall risk
  score + server-derived level, Braden score + server-derived
  pressure-ulcer risk level, Glasgow Coma Scale eye/verbal/motor +
  server-computed total, general notes), `IntakeOutputRecord`
  (server-computed total intake/output/balance) — all admission-scoped,
  nurse-authored, distinct from the doctor-authored `ClinicalNote`.
  IPD vitals charting reuses the existing encounter-scoped `Vital`
  model unchanged.
- IPD Orders (`IpdOrder` — diet/fluid/activity/oxygen/isolation
  precautions, doctor-placed, discontinuable) and Nursing Tasks
  (`NursingTask` — an org-wide queue across every ward, optionally
  spawned from an order via `sourceOrderId`, priority/status
  workflow ending in Completed/Missed/Cancelled).
- Medication Administration Record (`MedicationAdministration`, one
  row per scheduled/PRN/STAT dose instance against a
  `PrescriptionItem`) — schedule multiple doses at once (times × days),
  ad hoc PRN/STAT recording, administer (with dose given/route/nurse
  signature/barcode-verified+scanned-code hooks) or record an
  exception (missed/refused/held/delayed with a required reason), a
  full medication timeline/dose-history per admission.
- Discharge workflow — doctor approval (seeds an 8-item nursing
  checklist idempotently) → nursing completes the checklist and
  drafts a discharge summary (final diagnosis, hospital course,
  procedures, condition at discharge, medication reconciliation,
  follow-up instructions/appointment/doctor, optional linked discharge
  prescription) → finalize (`DischargeService.complete` — requires
  every checklist item complete and a summary with a final diagnosis;
  vacates the bed via the existing `BedAllocationService.vacate`,
  raises a real per-stay room `Charge` via the Charge Engine
  — `days-stayed × Room.chargesPerDay`, elapsed time rounded up to
  the next whole day, minimum 1 — closes the linked encounter, and
  sets `AdmissionStatus.DISCHARGED`). A structured, system-generated
  discharge-summary PDF (`pdfkit`) is downloadable once discharge is
  finalized.
- IPD dashboard now reports real `inpatients`/`occupancyPercent`/
  `pendingDischarge`/`pendingNursingTasks` alongside the existing
  bed/ICU/admissions/discharges/transfers stats.
- All-scope RBAC on `ipd.nursing`/`ipd.orders`/`ipd.tasks`/`ipd.mar`
  (mirrors `ipd.beds`/`ipd.transfer`'s precedent) and `ipd.discharge`
  split into `create` (doctor approval)/`update` (nursing checklist +
  summary)/`manage` (finalize, mirrors `billing.manage`), audit
  integration on every new action — all in
  `apps/api/src/modules/ipd/`.
- Frontend: four new tabs on the Admission Detail page (Nursing,
  Orders & Tasks, MAR, Discharge — alongside the existing Overview),
  a Discharges queue (`/dashboard/ipd/discharges`), a Nursing
  Dashboard (`/dashboard/nursing`), a Nursing Tasks queue
  (`/dashboard/nursing/tasks`), and an Assigned Patients / patient
  census page (`/dashboard/nursing/patients`). New "Nursing" sidebar
  nav item.
- Unit + e2e tests passing (35 new unit, 15 new e2e — 441 unit / 241
  e2e total across the whole API, zero failures); lint/typecheck/
  test/build all clean; browser-verified end to end (a real admission
  walked through nursing note → assessment with a real derived "High"
  fall-risk badge → I/O chart with a real computed balance → a doctor
  order spawning a nursing task, completed → a real vitals entry on
  the linked encounter → MAR dose scheduling and administration with
  a real nurse signature and a missed-dose exception → discharge
  approval → all 8 checklist items completed → discharge summary
  saved → discharge finalized with the bed correctly landing in
  "Cleaning" → a genuine downloaded discharge-summary PDF → the
  Discharges queue, Nursing Dashboard, Nursing Tasks queue, and IPD
  dashboard all reflecting the real activity).
- **Deferred, disclosed, not faked**: no per-nurse ward-assignment
  model exists, so "Assigned patients" is the full patient census
  (TD noted in-page); discharge-approval/finalize RBAC is all-scope
  rather than doctor-own-scoped, mirroring `ipd.transfer`'s existing
  precedent (TD-0032); MAR's barcode-ready fields have no real
  scanner hardware integration (TD-0033).

**Milestone 12 is now fully complete.**

## Milestone 13 — General Inventory: Complete

Backend landed in commit `e7f4abb` ahead of any `.ai/` sync; frontend
built across two sessions (2026-08-05 Checkpoint 1: Dashboard/Item
Master/Lookups; 2026-08-05 follow-on: everything else). See **ADR-0020**
(backend design, recorded retroactively) and **ADR-0021** (frontend
decisions).

- Item Master (`InventoryItem`, one row per catalog item — Asset or
  Consumable — referencing 5 shared lookup tables: Category/Item
  Group/Unit/Manufacturer/Brand).
- Stores (multi-store CRUD, manager assignment).
- Stock (`InventoryStock` per store per item, `InventoryBatch` for
  batch/serial/expiry-tracked items, opening stock, damage/loss/
  expiry/correction adjustments, low-stock/expiring/expired queries)
  and direct store-to-store Transfers (dispatch/receive/cancel).
- Vendors (CRUD, star ratings, purchase history, outstanding balance).
- The procurement chain: Purchase Requests (Draft → Submitted →
  Approved/Rejected → Converted/Cancelled) → Purchase Orders
  (optionally from an approved request; Draft → Submitted → Approved →
  Sent → Partially Received/Received) → Goods Receipt Notes (against
  a Sent PO, completing one updates stock) → Vendor Invoices (Pending →
  Verified/Disputed → Paid, repeatable payment recording). Vendor
  Returns is a fifth, independent path with a working backend but no
  frontend yet (TD-0034).
- Store Requisitions (inter-store request with approval, partial
  issue/receive).
- Stock Audits (snapshot system stock, record physical counts,
  complete applies variances as adjustments).
- Assets + Maintenance (asset registration from Asset-type catalog
  items, assignment to a user/department/store, maintenance records
  with breakdown/due-for-maintenance tracking).
- Inventory Dashboard (12 stat tiles) linking to all 10 sub-areas.
- RBAC namespaced `inventory.items`/`stores`/`stock`/`vendors`/
  `procurement`/`requests`/`audit`/`assets`.
- Unit (471 API total) + e2e (264 total) tests passing, lint/
  typecheck/build clean across all 6 packages. **Not browser-verified**
  — the session that built the remaining frontend was explicitly
  instructed not to use a browser or capture screenshots this time
  (TD-0035), the only milestone in this repo without one.
- **Deferred, disclosed, not fabricated:** Vendor Returns frontend
  (TD-0034); no staff/user picker exists anywhere yet, so store-manager
  and asset-user assignment take a free-text internal user ID
  (same shape as the pre-existing TD-0028).

## Milestone 14 — Staff & Attendance: Complete

Completed in a single session (2026-08-05), no checkpoint split
needed. Scope is the non-doctor employee population (Nurse,
Receptionist, Lab Technician, Radiology Technician, Pharmacist,
Cashier, HR, Inventory Manager) — Doctors keep their existing
dedicated `DoctorSchedule`/`DoctorLeave` system from Checkpoint 4.2,
deliberately not merged or duplicated. See **ADR-0022** for the full
schema/RBAC design.

- Staff directory (`Staff` model extended, not replaced — gained
  `hospitalId`, `employmentType`/`employmentStatus` enums, a
  `reportsToId` self-relation for reporting hierarchy, `dateOfLeaving`,
  `monthlySalary`), `StaffDocument` (mirrors `DoctorDocument`),
  onboarding via the existing generic `StaffOnboardingService`.
- Shift catalog (`Shift` — name/code/`HH:mm` start+end/break/grace-
  period/night-shift flag) and per-staff-per-date roster
  (`ShiftRoster`) supporting weekly, rotating, and night-shift
  assignment, including a bulk staff-assignment action.
- Attendance (`Attendance`, one row per staff per date) — clock in/
  out with a server-derived Present/Late/Half-Day/Week-Off status
  (disclosed rule based on the day's roster shift's grace period and
  standard hours), manual marking, corrections (applied immediately —
  TD-0038), a monthly calendar, and a dashboard.
- Leave management — per-org annual-day quota per `LeaveType`
  (`LeaveTypeConfig`), `StaffLeave` (mirrors `DoctorLeave` — apply/
  approve/reject/cancel, overlap conflict check), a computed leave
  balance (quota minus approved day-spans, not a mutable counter), and
  a holiday calendar (`Holiday`).
- Payroll Preparation — a read-only summary (present/late/half-day/
  absent days, paid/unpaid leave days, overtime minutes/amount, a
  leave-deduction amount, net payable days) over existing Attendance/
  StaffLeave/Shift data plus a CSV export. No pay-run, payslip, or
  disbursement processing — explicitly out of scope (TD-0037).
- Staff Dashboard (headcount, today's present/late/absent/on-leave,
  pending leave approvals, staff-by-department, shift coverage).
- RBAC: `staff`/`staff.documents` (mirrors `doctors`/`doctors.
  documents`), new `attendance`/`leave`/`shifts`/`shifts.roster`
  namespaces — every non-doctor role granted genuine `.own`-scoped
  self-service (clock in/out, apply/cancel own leave, view own
  roster), HR granted the full all-scope admin set.
- Frontend: a Staff Dashboard (`/dashboard/staff`, with a self clock-
  in/out widget), Directory (`/directory`, search/filter + add-staff
  dialog with a real hospital/department picker), a Profile page
  (`/[staffId]` — Overview/Documents/Attendance-calendar/Leave-with-
  balance tabs), Shifts (`/shifts`, catalog CRUD), Roster (`/roster`,
  weekly grid + assign dialog — the first real staff-picker `Select`
  in this repo's frontend), Attendance (`/attendance`, org-wide list +
  correction dialog), Leave (`/leave`, requests/leave-types/holidays
  tabs), and Payroll Prep (`/payroll`, summary table + CSV export).
  Reused the pre-existing dormant sidebar "Staff" link unchanged.
- Unit (513 API total) + e2e (278 total) tests passing; lint/
  typecheck/build clean across all 6 packages.
- **Deferred, disclosed, not faked**: no browser-verified screenshots
  this session (TD-0036, explicit instruction, mirrors Milestone 13's
  TD-0035); no biometric attendance-hardware integration exists
  anywhere in this repo (TD-0039, same category as the SMS/AI-
  provider/payment-gateway/PACS credential-blocked gaps); the
  per-day/per-hour payroll rate is a disclosed convention
  (`monthlySalary / 30`), not a configurable pay policy (TD-0037).

See `.ai/NEXT.md` for **Milestone 15 — AI Features**, next.

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
- `docs/screens/insurance-dashboard.png` — Insurance dashboard: six
  stat tiles and the claim-status breakdown bar chart with real data.
- `docs/screens/insurance-providers.png` — Providers list showing the
  created "Star Health Insurance" provider.
- `docs/screens/insurance-plans.png` — Plans list showing the "Gold
  Plan" (80% coverage, 20% co-pay, ₹500 deductible) under that provider.
- `docs/screens/insurance-patient-coverage-tab.png` — Patient detail
  page's Insurance tab, showing a real primary coverage record.
- `docs/screens/insurance-encounter-tab-empty.png` — Encounter detail
  page's new Insurance tab before any pre-auth/claim exists.
- `docs/screens/insurance-encounter-tab-preauth.png` — Same tab after a
  pre-authorization was submitted and marked Under Review.
- `docs/screens/insurance-preauth-queue-under-review.png` and
  `insurance-preauth-queue-approved.png` — Pre-Authorization queue
  before and after approving that request.
- `docs/screens/insurance-encounter-tab-claim.png` — Encounter Insurance
  tab showing the filed claim linked to the approved pre-auth.
- `docs/screens/insurance-claim-detail-under-review.png`,
  `insurance-claim-detail-settled.png`, and
  `insurance-claim-detail-closed.png` — the claim detail page at three
  points in its lifecycle, the settled view showing a real ₹800
  insurance-share payment recorded and the auto-attached Invoice +
  Encounter Summary documents.
- `docs/screens/insurance-claims-queue.png` — Claims queue showing the
  settled claim.
- `docs/screens/ipd-dashboard-empty.png` and `ipd-dashboard-populated.png`
  — the IPD dashboard before and after real activity (2 admissions
  today, 2 transfers today, ICU occupancy reflecting a live count).
- `docs/screens/ipd-ward-dialog-filled.png` and `ipd-wards-list.png` —
  Add-ward dialog filled in, then the Wards list showing occupancy.
- `docs/screens/ipd-rooms-list.png` — Rooms list with capacity and
  per-day charges.
- `docs/screens/ipd-bed-grid-available.png` and
  `ipd-bed-grid-mixed-status.png` — the color-coded Bed Grid, first
  all-available then showing a real `CLEANING`/`AVAILABLE` mix after a
  transfer and vacate.
- `docs/screens/ipd-admissions-queue.png` and
  `ipd-admissions-queue-populated.png` — Admissions queue empty, then
  showing two real admissions (one Admitted, one Cancelled).
- `docs/screens/ipd-admit-wizard-step1.png` through `-step4.png` and
  `ipd-admit-wizard-review.png` — the 5-step Admit Patient wizard
  (Patient & Type → Care Team → Ward/Room/Bed → Details → Review) with
  a real patient/doctor/bed selected.
- `docs/screens/ipd-admission-detail-admitted.png`,
  `ipd-transfer-dialog-filled.png`, `ipd-admission-detail-transferred.png`,
  and `ipd-admission-detail-vacated.png` — the admission detail page
  through allocate → transfer → vacate, each with the merged bed
  allocation/transfer history timeline updating correctly and the
  vacated bed correctly landing in "Cleaning."
- `docs/screens/ipd-patient-admissions-tab.png` — the Patient detail
  page's new Admissions tab, showing the current admission and linked
  encounter.
- `docs/screens/nursing-dashboard-before.png` and
  `nursing-dashboard-after.png` — the Nursing Dashboard before and
  after this session's activity (patient census, bed occupancy,
  pending nursing tasks, pending discharge, STAT-task alert panel).
- `docs/screens/admit-wizard-step1-patient.png`,
  `admit-wizard-step3-bed.png`, `admit-wizard-review.png`, and
  `admission-created-bed-assigned.png` — admitting Ramesh Gupta into
  ICU Ward Bed 34 for Checkpoint 12.2's walkthrough.
- `docs/screens/nursing-note-recorded.png`,
  `nursing-assessment-recorded.png` (a real derived "Fall risk: High" /
  "Pressure ulcer: Moderate" / "GCS 15/15"), and
  `nursing-intake-output-recorded.png` (a real computed "Balance:
  100ml") — the admission detail page's new Nursing tab.
- `docs/screens/nursing-orders-and-tasks.png` — the Orders & Tasks tab
  showing a real doctor order and a nursing task created from it,
  completed.
- `docs/screens/vitals-form-filled.png` and `vitals-recorded.png` — a
  real vitals entry on the admission's linked encounter (Objective
  tab), confirming IPD vitals charting reuses the existing `Vital`
  feature unchanged.
- `docs/screens/encounter-prescription-for-mar.png` — a prescription
  added to the linked encounter, feeding the MAR tab.
- `docs/screens/mar-tab-empty.png`, `mar-doses-scheduled.png`, and
  `mar-dose-administered.png` — the MAR tab: scheduling three
  Amoxicillin doses, then administering one with a real nurse
  signature ("Nurse Anjali Verma").
- `docs/screens/discharge-tab-before-approval.png`,
  `discharge-approved-checklist-seeded.png` (all 8 checklist items
  seeded, unchecked), `discharge-checklist-complete.png`,
  `discharge-summary-saved.png`, and
  `discharge-completed-bed-vacated.png` ("Patient discharged — bed
  vacated" toast, status "Discharged") — the full Discharge tab
  workflow.
- `docs/screens/bed-grid-after-discharge.png` — Bed 34 correctly
  landing in "Cleaning" (not directly back to "Available") after
  discharge.
- `docs/screens/discharges-queue-discharged.png` — the new Discharges
  queue page showing the completed discharge.
- `docs/screens/nursing-tasks-queue.png` and
  `nursing-patients-census.png` — the org-wide Nursing Tasks queue and
  the Assigned Patients / patient census page.
- `docs/screens/ipd-dashboard-with-nursing-stats.png` — the IPD
  dashboard showing real inpatients/occupancy/pending-discharge/
  pending-nursing-tasks stats alongside the existing bed/ICU/
  admissions/transfers stats.
