# CHANGELOG.md

> Human-readable log of notable changes. Newest entry on top. This is the
> narrative counterpart to `PROGRESS.md` (which is more granular/session-by-session).

## [Unreleased]

### Added
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
