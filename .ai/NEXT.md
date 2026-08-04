# NEXT.md

> The next logical task(s) to pick up. Replaced (not appended) whenever a
> milestone completes — this file always describes "start here," not history.

## Immediate Next Task

**Milestone 13 — General Inventory.**

Milestone 12 (IPD & Bed Management) is now **fully complete** — both
Checkpoint 12.1 (Admission, Wards & Bed Management) and Checkpoint 12.2
(Nursing, Medication Administration & Discharge). See `PROGRESS.md` and
`SESSION_LOG.md` (2026-08-04 entries) for exactly what was built in
each checkpoint, and `DECISIONS.md` ADR-0018/ADR-0019 for the
schema/RBAC/workflow decisions made. Do not re-implement or re-verify
any of it.

### Scope

Per `docs/roadmap.md`'s Milestone 13 deliverables:

- General (non-drug) inventory module — equipment, consumables,
  supplies
- Purchase order management
- Expiry tracking
- Inventory reports
- Frontend: inventory management

### Judgment calls to check against `DECISIONS.md` first

- **`InventoryItem` model already exists, unaudited.** Per the pattern
  established repeatedly this project (`Ward`/`Bed`/`Admission` before
  ADR-0018, `Medication` before ADR-0014, the flat `MedicalRecord`
  before ADR-0008) — check whether `InventoryItem` (referenced in
  `Organization.inventoryItems` and the `inventory` backend module
  directory, both currently unaudited per `MODULE_STATUS.md`) already
  has usable fields before assuming a clean slate. Read the schema and
  any existing `inventory` module code first.
- **Relationship to Pharmacy's `Drug` model.** Milestone 9 built a
  parallel drug-specific catalog/stock/dispensing system (`Drug`,
  `DispenseOrder`/`DispenseItem`, `DrugReturn`) explicitly scoped to
  drugs only, deferring "general (non-drug) inventory" to this
  milestone (see ADR-0014). Decide whether `InventoryItem` should
  mirror `Drug`'s batch-tracking shape (one row per batch: quantity,
  reorder level, expiry) or take a different shape suited to
  equipment/consumables (e.g. serialized equipment vs. bulk
  consumables may need different tracking). Check whether any
  existing charge/billing integration point should reuse the Charge
  Engine (`ChargeSourceModule` — would need a new member, mirroring
  how `IPD` was added this session) if inventory items get billed to
  patients (e.g. consumables used during a procedure).
- **Purchase orders are a new workflow** — no existing precedent in
  this repo to mirror as directly as MAR mirrored `DispenseOrder`.
  Consider a simple status state machine (e.g. Draft → Ordered →
  Received → Cancelled) consistent with every other module's
  state-machine precedent (`LabTestStatus`, `RadiologyStatus`,
  `DischargeChecklistItemKey`'s completion pattern, etc.) rather than
  free-text status fields.
- **Expiry tracking** likely mirrors `Drug`'s existing near-expiry
  query pattern (`pharmacy-dashboard.service.ts` / stock page) —
  reuse that querying approach rather than inventing a new one.

### Process reminders (from `CLAUDE.md`)

- Per the repository reading policy: this task touches Inventory (new
  or unaudited-existing module), possibly Billing (if items get
  charged to patients), Pharmacy (as a precedent to mirror, not to
  modify), Prisma schema, and shared types — do not scan unrelated
  modules (IPD, Nursing, Insurance, etc. are all complete and stable).
- Run full verification before calling it done: `pnpm lint && pnpm
  typecheck && pnpm test && pnpm build`, plus `pnpm test:e2e`.
- `pnpm --filter @medicore/database db:generate` after any schema
  change (TD-0008), and apply the new migration to **both**
  `medicore_dev` and `medicore_test` (TD-0004) — generate the raw SQL
  via `prisma migrate diff --from-url <db-url> --to-schema-datamodel
  prisma/schema.prisma --script` into a manually created
  `prisma/migrations/<timestamp>_<name>/migration.sql` folder, then
  `prisma migrate deploy` against each database — `prisma migrate dev`
  does not work non-interactively in this environment.
- If running a full `turbo run build --force` (or `pnpm build`) while
  a dev server is already running (for the browser walkthrough), kill
  the port 3000/4000 listeners and restart `pnpm dev` fresh afterward
  — a stale running process can serve clobbered/mismatched compiled
  output or 404 on brand-new routes despite the build succeeding
  (TD-0004 addendum, hit again in the Checkpoint 12.2 session — two
  stale dev-server processes from an even earlier session were still
  squatting ports 3000/4000).
- No project skill or committed dependency exists for browser
  verification yet (TD-0010, still open) — Playwright was installed ad
  hoc into the session scratch directory again this session (reusing
  the Chromium binary cached at `~/Library/Caches/ms-playwright` where
  possible). One real automation gotcha hit this session worth
  knowing: a loose `waitForURL` regex (e.g.
  `/\/dashboard\/ipd\/[a-z0-9]+$/`) can false-match a *static* list
  route whose slug happens to be all-lowercase-letters (e.g.
  `/dashboard/ipd/admissions` matched `[a-z0-9]+$`) — wait for a real
  page-specific element instead of a URL pattern when the detail-page
  ID could collide with a sibling static route's name.
- Update `PROGRESS.md`, `CHANGELOG.md`, `MODULE_STATUS.md`,
  `SESSION_LOG.md`, `TECH_DEBT.md`/`DECISIONS.md`, `PROJECT_CONTEXT.md`,
  and this file when done. Screenshot new UI under `docs/screens/`
  using an `inventory-*.png` naming convention.
- Once Milestone 13 is genuinely complete and verified per the
  Milestone Completion Checklist, replace `NEXT.md` with
  **Milestone 14 — Staff & Attendance** (per `docs/roadmap.md`,
  correctly numbered per ADR-0017).
