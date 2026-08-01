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
and Milestone 6 (Clinical: Medical Records — both Checkpoint 6.1 EMR
Foundation and Checkpoint 6.2 Orders & Prescriptions) are complete
end-to-end (backend, frontend, tests, docs); everything else's percentage
is still provisional.**

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

Per **ADR-0011**, the autonomous continuation loop was explicitly paused
by the user after Milestone 6 for review and commit — see `.ai/NEXT.md`
for **Milestone 7 — Laboratory Management** (the former "Laboratory &
Radiology" milestone split into Laboratory Management, next, and its own
**Milestone 8 — Radiology Management** follow-up; `docs/roadmap.md`'s
Milestones 8–14 renumbered to 9–15 accordingly). Do not begin Milestone 7
without explicit user instruction to resume.

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
