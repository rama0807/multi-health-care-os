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

`ai`, `appointments`, `audit`, `auth`, `billing`, `departments`, `health`,
`hospitals`, `insurance`, `inventory`, `laboratory`, `medical-records`,
`notifications`, `organizations`, `patients`, `pharmacy`, `prescriptions`,
`radiology`, `roles`, `staff`, `users`.

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

**Status: Foundational scaffolding in place; most modules unaudited. One
module — Doctors — is verified complete for its Milestone 4, Checkpoint 4.1
scope (see below); everything else's percentage is still provisional.**

See `MODULE_STATUS.md` for the authoritative, maintained breakdown. Until a
session performs a full audit of each module's actual implementation depth,
treat any other percentage here as provisional.

## Milestone 4 — Doctor Management & Scheduling

Split into two checkpoints (ADR-0005 in `DECISIONS.md`); one checkpoint per
session.

- **Checkpoint 4.1 — Doctor Management: Complete.** CRUD, professional
  profile, linked-user onboarding (via the generic `StaffOnboardingService`
  at `apps/api/src/common/onboarding/`), search/filters, dashboard stats,
  doctor profile page. Unit + e2e tests passing; lint/typecheck/build clean.
  See `docs/modules/04-doctor-management.md`.
- **Checkpoint 4.2 — Doctor Scheduling: Not started.** Weekly schedules,
  leave management, availability, dashboard availability stats, doctor
  documents, audit timeline. See `.ai/NEXT.md`.

`StaffOnboardingService` is intentionally generic (knows nothing about
`Doctor` specifically) so Nurse, Pharmacist, Lab Technician, Receptionist,
and other future staff-profile modules can reuse it unmodified.

## Milestone Screenshots

None recorded yet — no browser/UI access has been available in any session
so far. When a session with browser access completes a user-facing
milestone, add screenshots to `docs/screens/` and link them here, e.g.:

- `docs/screens/<feature>-<date>.png` — description
