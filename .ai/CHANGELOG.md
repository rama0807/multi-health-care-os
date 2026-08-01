# CHANGELOG.md

> Human-readable log of notable changes. Newest entry on top. This is the
> narrative counterpart to `PROGRESS.md` (which is more granular/session-by-session).

## [Unreleased]

### Added
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
