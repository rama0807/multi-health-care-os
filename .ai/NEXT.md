# NEXT.md

> The next logical task(s) to pick up. Replaced (not appended) whenever a
> milestone completes — this file always describes "start here," not history.

## Immediate Next Task

**Milestone 7 — Laboratory Management.**

Milestone 6 (Clinical: Medical Records — both Checkpoint 6.1 EMR
Foundation and Checkpoint 6.2 Orders & Prescriptions) is now **fully
complete**: Encounter, versioned Clinical Notes, Vitals, Diagnoses,
Procedures, Attachments, and Prescriptions are all implemented backend +
frontend, with 175 unit + 102 e2e tests passing (one unrelated
pre-existing flake, TD-0017) and lint/typecheck/build all green,
browser-verified with screenshots under `docs/screens/`. See
`PROGRESS.md` and `SESSION_LOG.md` (2026-08-01, Checkpoint 6.2 entry) for
exactly what was built. Do not re-implement or re-verify any of it.

Per **ADR-0011** (`DECISIONS.md`), `docs/roadmap.md`'s former Milestone 7
("Laboratory & Radiology") has been split: **Milestone 7 is now
Laboratory Management only** (this task); **Radiology Management is its
own Milestone 8**, to be picked up as a separate follow-up after this one
— not in the same session. Do not implement Radiology deliverables while
working this task. Milestones 8–14 were renumbered to 9–15 accordingly
(Week labels bumped by one each) — `docs/roadmap.md` is the source of
truth for current numbering.

### Scope

Per `docs/roadmap.md`'s Milestone 7 deliverables (Laboratory only):

- Lab test catalog (configurable per org)
- Lab order creation from consultation
- Sample collection tracking
- Result entry (manual) and PDF upload
- Abnormal value flagging with reference ranges
- Lab result PDF generation
- AI-powered lab report summarization (async)
- Frontend: lab order list and result entry form

**Explicitly out of scope for this task:** Radiology order creation,
radiology report upload/viewing, and the radiology order queue frontend
— all deferred to Milestone 8. Do not touch
`apps/api/src/modules/radiology/` or any `Radiology*` Prisma model while
working this task, per the reading-policy restriction below.

The `laboratory` module already exists at
`apps/api/src/modules/laboratory/` but — per the pattern seen in every
prior milestone this session (`appointments`, `medical-records`,
`prescriptions` were all 3-line no-op scaffolds before their turn) —
check whether it's still a scaffold or already has real depth before
assuming either way. The `LabTest` Prisma model already exists in
`schema.prisma` (search for `model LabTest`, right after the
`Prescription`/`PrescriptionItem` models Checkpoint 6.2 worked on) with
`labOrderNumber`, `patientId`, `doctorId`, `appointmentId`, `status:
LabTestStatus` — audit what's actually there and reuse it (the same
"code is ground truth" practice used for `Appointment`, `Encounter`, and
`Prescription` in every milestone so far) rather than redesigning from
scratch.

"Lab order creation from consultation" implies an integration point with
`Encounter` (Checkpoint 6.1) — likely a new tab on the encounter detail
page, similar to how Prescriptions was added in Checkpoint 6.2.
"AI-powered lab report summarization" needs an LLM/AI provider — check
whether any AI provider credentials or SDK are already configured
anywhere in this repo (the `ai` module exists per `MODULE_STATUS.md` but
is unaudited) before assuming it's available; if genuinely missing, treat
it the way SMS (Milestone 5) and the ICD-10/drug-interaction lookups
(Milestone 6) were treated — implement everything else, defer that one
piece explicitly with a TECH_DEBT entry, don't fake it.

### Process reminders (from `CLAUDE.md`)

- Per the repository reading policy: this task touches Laboratory,
  Encounter (for the consultation-order link), Patients, and shared
  types — do not scan unrelated modules, and explicitly do not touch
  Radiology (deferred to Milestone 8, see above).
- Run full verification before calling it done: `pnpm lint && pnpm
  typecheck && pnpm test && pnpm build`, plus `pnpm test:e2e`.
- `pnpm --filter @medicore/database db:generate` after any schema change
  (TD-0008).
- If running a full `turbo run build --force` while a dev server is
  already running (for the browser walkthrough), restart both `pnpm dev`
  processes (api + web) afterward — a stale running process can serve
  clobbered/mismatched compiled output or 404 on brand-new routes despite
  the build succeeding (TD-0004 addendum, hit three times now across
  Checkpoints 6.1 and 6.2).
- Before assuming a new own-scope permission needs seeding, check whether
  `seed.ts`'s `ROLE_SPECS`/`OWN_SCOPE_PERMISSIONS` needs the same-pattern
  fix already hit once this project (`medical_records.update`/
  `prescriptions.update` were missing from the `Doctor` role despite the
  API supporting them) — a new module's own-scope permissions need
  explicit grants in `seed.ts`'s `ROLE_SPECS`, not just the permission
  catalog (`RESOURCE_ACTIONS`/`OWN_SCOPE_PERMISSIONS`).
- Update `PROGRESS.md`, `CHANGELOG.md`, `MODULE_STATUS.md`,
  `SESSION_LOG.md`, `TECH_DEBT.md`/`DECISIONS.md`, and this file when done.
  Screenshot new UI under `docs/screens/`.
- Once Milestone 7 (Laboratory Management) is genuinely complete and
  verified per the Milestone Completion Checklist (backend + frontend +
  tests + docs + screenshots, with any genuinely credential/data-blocked
  sub-item explicitly deferred, not silently dropped), replace `NEXT.md`
  with **Milestone 8 — Radiology Management** (per `docs/roadmap.md`,
  now correctly numbered per ADR-0011).

### Standing instruction override (2026-08-01)

The user explicitly asked to **stop after Milestone 6** rather than
auto-continue into Milestone 7 — the standing `/loop` autonomous-
continuation instruction from earlier sessions is paused. **Do not begin
Milestone 7 automatically.** Wait for explicit user instruction to
resume before starting any implementation work described above. The user
is reviewing and committing the Milestone 6 work first.
