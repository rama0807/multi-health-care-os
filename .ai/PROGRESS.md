# PROGRESS.md

> Running log of what has actually been built, most recent first. Update
> after every completed task. Pair with `CHANGELOG.md` (human-facing summary)
> and `MODULE_STATUS.md` (per-module state).

## 2026-07-31 — Milestone 4, Checkpoint 4.1 (Doctor Management) verified and closed out

- Found, on session start, that a prior session had already built most of
  Doctor Management (`apps/api/src/modules/doctors/`, the generic
  `StaffOnboardingService` at `apps/api/src/common/onboarding/`, a Prisma
  migration adding doctor professional-profile fields, and frontend pages
  under `apps/web/src/app/dashboard/doctors/`) without ever recording it in
  `.ai/` — the code was ground truth, so this session audited it against the
  Checkpoint 4.1 requirement list instead of re-implementing anything.
- Verified against the checklist: Doctor CRUD, professional profile, linked
  user onboarding, search, filters, dashboard stats, doctor profile page,
  unit tests, and e2e tests were all already implemented and wired
  end-to-end (permissions seeded for `doctors.*`, module registered in
  `app.module.ts`, frontend pages linked from the sidebar).
- Ran full verification and fixed everything it turned up:
  - `pnpm lint` (api + web): 2 real violations fixed — an import-order error
    in `doctors.controller.ts` and an unescaped-apostrophe JSX error in the
    doctor detail page.
  - `pnpm typecheck` (api + web): clean, no changes needed.
  - `pnpm test` (api + web): 76 unit tests passed, no changes needed.
  - `pnpm test:e2e`: required first-time local environment setup (`apps/api/.env`
    generated from `.env.example`, JWT RSA keypair via
    `pnpm keys:generate`, pointed at the already-running `medicore-postgres`/
    `medicore-redis` dev containers on their mapped ports 5434/6381). Found
    two real issues once the suite could run: the `medicore_test` database
    was missing the `20260730220227_doctor_professional_profile` migration
    (applied it — this was a stale test DB, not an app bug), and
    `doctors.e2e-spec.ts` had one assertion expecting `201` from
    `POST /auth/login` where the endpoint correctly returns `200` (fixed the
    test). All 14 e2e tests pass after both fixes.
  - `pnpm build`: all packages build cleanly.
- Wrote `docs/modules/04-doctor-management.md` (backend/frontend surface,
  onboarding flow, deferred-to-4.2 list).
- Updated `docs/roadmap.md`: Milestone 4 retitled and split into Checkpoint
  4.1 (marked complete) / 4.2 (not started); original appointment-booking
  deliverables moved to a "Deferred beyond Milestone 4" section.
- Recorded ADR-0005 in `DECISIONS.md` for the Milestone-4 scope split and
  the decision to keep `StaffOnboardingService` generic across staff roles.
- **Not done, by explicit instruction:** Checkpoint 4.2 (doctor scheduling)
  is intentionally not started this session.
- **Not done, environment limitation:** no screenshot saved under
  `docs/screens/` — this session has no browser/UI access, only CLI +
  API-level (e2e) verification. A future session with browser access should
  capture the doctors list, registration form, and profile page.

---

## 2026-07-31 — Project governance scaffolding

- Created `CLAUDE.md` at repo root as the standing project constitution.
- Created `.ai/` project memory directory with all required files
  (`PROJECT_CONTEXT.md`, `PROGRESS.md`, `NEXT.md`, `DECISIONS.md`,
  `TECH_DEBT.md`, `SESSION_LOG.md`, `MODULE_STATUS.md`, `CHANGELOG.md`).
- No application code changed in this task.

---

## Prior History (pre-`.ai/`, reconstructed from repo state)

- Monorepo initialized (pnpm + turbo) with `apps/api` (NestJS) and
  `apps/web` (Next.js), plus shared `packages/` (config, database, types, ui).
- Backend module directories scaffolded for the full domain surface: auth,
  users, roles, organizations, hospitals, departments, staff, patients,
  appointments, medical-records, prescriptions, laboratory, radiology,
  pharmacy, inventory, billing, insurance, notifications, audit, ai, health.
- Common infra added: JWT auth guard, permissions guard + service, CSRF
  guard, audit listener/service, email module, Redis module.
- This was committed as a single large init commit
  (`56857d3 init: setup of the mono-repo done for hospital management system`)
  before `.ai/` tracking existed — module-level implementation depth has not
  yet been individually verified. First session using this file should audit
  each module and populate `MODULE_STATUS.md` accurately rather than trusting
  directory existence as a proxy for completeness.
