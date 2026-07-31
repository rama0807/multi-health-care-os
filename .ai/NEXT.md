# NEXT.md

> The next logical task(s) to pick up. Replaced (not appended) whenever a
> milestone completes — this file always describes "start here," not history.

## Immediate Next Task

**Milestone 4, Checkpoint 4.2 — Doctor Scheduling.**

Checkpoint 4.1 (Doctor Management — CRUD, professional profile, linked-user
onboarding, search/filters, dashboard, profile page, tests, docs) is
complete and verified (see `PROGRESS.md` 2026-07-31, ADR-0005 in
`DECISIONS.md`, `docs/modules/04-doctor-management.md`). Do not re-implement
or re-verify it; read the doc if context is needed.

### Scope for this checkpoint only

- Weekly schedules — a doctor's recurring weekly availability (e.g. per
  day-of-week time blocks). The `Doctor.availabilitySlots` JSON field and
  `DoctorAvailabilityStatus` enum already exist in the schema from
  Checkpoint 4.1's migration — reuse/extend them rather than adding new
  top-level tables unless the shape genuinely can't fit (check with the
  user before adding new models/migrations if unsure — see ADR-0005's
  consequence note on not introducing schema complexity speculatively).
- Leave management — doctor leave requests/records affecting availability.
- Availability — surfacing real-time or day-specific availability derived
  from schedule + leave (beyond the existing static `availabilityStatus`
  enum value).
- Dashboard availability stats — extend `GET /doctors/stats/dashboard`
  (currently `totalDoctors`/`activeDoctors` only) with availability-related
  counts (e.g. on-leave-today, available-now).
- Doctor documents — upload/list/delete for a doctor's own documents
  (certificates, ID proofs). Check how `patients` module already does
  document upload (`PatientDocument`, `StorageService`) before designing a
  new pattern — likely reuse the same storage abstraction.
- Audit timeline — a per-doctor view of audit events. The `audit` module
  (listener/service) already exists — check what it captures before adding
  new capture points.
- Remaining tests — unit + e2e for everything above, following the pattern
  in `doctors.service.spec.ts` / `doctors.e2e-spec.ts`.

### Process reminders (from `CLAUDE.md` + this session's instructions)

- Finish this checkpoint completely in one session; do not also start a
  Checkpoint 4.3 or drift into appointment booking (that's deferred beyond
  Milestone 4 per ADR-0005).
- Run full verification before calling it done: `pnpm lint && pnpm
  typecheck && pnpm test && pnpm build`, plus `pnpm test:e2e` (see TD-0004
  for the one-time local env setup this requires — `.env`, JWT keys, and
  keeping `medicore_dev`/`medicore_test` migrations in sync).
- Update `PROGRESS.md`, `CHANGELOG.md`, `MODULE_STATUS.md`,
  `SESSION_LOG.md`, and this file when done.
- Screenshot under `docs/screens/` if browser/UI access is available this
  session (TD-0003 — no session so far has had it; say so explicitly if
  still unavailable rather than skipping silently).
