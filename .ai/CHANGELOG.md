# CHANGELOG.md

> Human-readable log of notable changes. Newest entry on top. This is the
> narrative counterpart to `PROGRESS.md` (which is more granular/session-by-session).

## [Unreleased]

### Added
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
