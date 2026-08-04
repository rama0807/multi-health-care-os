# NEXT.md

> The next logical task(s) to pick up. Replaced (not appended) whenever a
> milestone completes — this file always describes "start here," not history.

## Immediate Next Task

**Milestone 14 — Staff & Attendance**, per `docs/roadmap.md`. Milestone 13
(General Inventory) is now fully complete — backend (commit `e7f4abb`,
retroactively documented as ADR-0020) and frontend (Checkpoint 1 +
this session, 20 routes) both done, tests green. Do not re-implement or
re-verify anything from Milestone 13.

### Scope, per `docs/roadmap.md`

- Staff profiles and employee records
- Department and role assignment
- Shift management
- Attendance marking (manual + biometric hook)
- Leave management
- Doctor duty roster
- Staff reports
- Frontend: staff management
- Frontend: attendance dashboard

### What's already in the repo — verify before assuming either way

A quick look (not a full audit — do that first) found:
- `apps/api/src/modules/staff/` already exists (`staff.controller.ts`/
  `staff.service.ts`/`staff.module.ts`) — check whether it's a 3-line
  no-op scaffold (the `billing`/`insurance`/`pharmacy` precedent before
  their milestones) or something real.
- A `Staff` model already exists in `packages/database/prisma/
  schema.prisma` (line ~799) — **read it before designing anything
  new**. Every prior milestone in this repo (Medication → Drug,
  MedicalRecord → Encounter, Ward/Bed/Admission → extended) found an
  unaudited pre-existing scaffold model that shaped the actual design;
  assume this one does too until proven otherwise.
- No `Attendance`/`Shift`/`Leave`(staff-side)/`DutyRoster` models exist
  yet in the schema — these are likely new.
- `StaffOnboardingService` (`apps/api/src/common/onboarding/`) is the
  existing generic staff-onboarding path used by Doctor/Nurse/etc. —
  reuse it, don't reimplement user-linking.
- Doctor scheduling (`apps/api/src/modules/scheduling/`) already has
  weekly schedules + leave management for doctors specifically
  (Checkpoint 4.2) — decide explicitly whether Milestone 14's "Shift
  management"/"Leave management"/"Doctor duty roster" reuse/extend that
  module or are a separate general-staff system; record the decision as
  an ADR either way, don't silently duplicate or silently merge.

### Process reminders (from `CLAUDE.md`)

- Per the repository reading policy: this task touches Staff/HR only.
  Do not re-scan Inventory/IPD/Nursing/Insurance/Billing beyond reading
  one page as a UI pattern reference if needed.
- Run full verification before calling any task done: `pnpm lint &&
  pnpm typecheck && pnpm test && pnpm test:e2e && pnpm build`. The test
  DB containers are named `medicore-postgres`/`medicore-redis` (mapped
  to host ports 5434/6381 per `apps/api/.env`) — start them with
  `docker start medicore-postgres medicore-redis`, not `docker compose
  up`, which creates a *different*, unmapped container pair
  (`medicore_postgres`/`medicore_redis`, no matching `.env` port) that
  will silently fail to connect. If Docker Desktop itself isn't
  running, `open -a Docker` and wait for `docker info` to succeed.
- Take screenshots under `docs/screens/` and browser-verify the golden
  path once a working UI flow exists, unless explicitly instructed
  otherwise for that session (Milestone 13's frontend session was told
  not to — see TD-0035 — that was an explicit override, not a new
  default).
- Given the scope above is large (8 deliverables, 2 frontend areas),
  treat this as at least one checkpoint; split further if the Staff
  profile/shift/attendance/leave/roster pieces turn out to be as
  substantial as Milestone 13's procurement chain was.
