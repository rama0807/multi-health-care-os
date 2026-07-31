# TECH_DEBT.md

> Every deferred feature, known shortcut, and discovered-but-unfixed bug goes
> here. Nothing gets silently dropped. Mark items Resolved (with date) rather
> than deleting them, so the history of what was deferred and why stays
> intact.

Format per entry:

```
## TD-NNNN: <Title>
Opened: YYYY-MM-DD
Status: Open | In Progress | Resolved (YYYY-MM-DD)
Severity: Low | Medium | High

Description: what's deferred/shortcut/broken and why
Impact: what breaks or is at risk if left unaddressed
Resolution plan: how it should eventually be fixed (if known)
```

---

## TD-0001: Module implementation depth unverified

Opened: 2026-07-31
Status: Open
Severity: Medium

**Description:** `MODULE_STATUS.md` currently lists all backend/frontend
modules as unaudited. The single init commit scaffolds directories for every
domain but no session has yet verified line-by-line completeness (tests,
validation, docs) per module.

**Impact:** Completion percentages in `PROJECT_CONTEXT.md` cannot be trusted
until this audit happens; risk of assuming a module is done when it's a
stub.

**Resolution plan:** See `.ai/NEXT.md` — audit each module, update
`MODULE_STATUS.md` with verified state.

---

## TD-0002: CI pipeline not yet verified against current module set

Opened: 2026-07-31
Status: Open
Severity: Medium

**Description:** `.github/workflows/ci.yml` exists but has not been
confirmed to actually run lint/typecheck/test/build cleanly against the
current codebase state as part of this governance setup task.

**Impact:** CI could be green due to skipped/misconfigured steps rather than
genuinely passing checks.

**Resolution plan:** Run `pnpm lint && pnpm typecheck && pnpm test && pnpm
build` locally and compare against what CI actually executes; fix any gap.

---

## TD-0003: No screenshot for Doctor Management milestone

Opened: 2026-07-31
Status: Open
Severity: Low

**Description:** `CLAUDE.md` requires a screenshot under `docs/screens/`
for every completed user-facing milestone. Checkpoint 4.1 (Doctor
Management) is functionally complete and e2e-verified at the API level, but
this and all prior sessions have had no browser/UI access to capture one.

**Impact:** Documentation completeness gap only — no functional risk.

**Resolution plan:** A future session with browser access (or the user)
should load `/dashboard/doctors`, `/dashboard/doctors/new`, and
`/dashboard/doctors/[id]`, save screenshots under `docs/screens/`, and link
them from `PROJECT_CONTEXT.md`.

---

## TD-0004: Local dev/e2e environment needs one-time manual setup (documented, not automated)

Opened: 2026-07-31
Status: Open
Severity: Low

**Description:** Running `pnpm test:e2e` locally requires `apps/api/.env`
(not committed, generated from `.env.example`), a generated JWT RSA
keypair (`pnpm --filter @medicore/api keys:generate`), and both the
`medicore_dev` and `medicore_test` Postgres databases to have all
migrations applied (`prisma migrate deploy` against each
`DATABASE_URL`) — the two databases can drift independently, as
`medicore_test` had (see PROGRESS.md 2026-07-31: it was missing the
`20260730220227_doctor_professional_profile` migration, causing every
doctor-related e2e test to fail with a Prisma "column does not exist"
error until applied). None of this is scripted.

**Impact:** Any session starting fresh must rediscover this setup before
e2e tests can run; a schema change applied to `medicore_dev` but not
`medicore_test` (or vice versa) will produce a confusing runtime error that
looks like an application bug rather than a stale test database.

**Resolution plan:** Add an `pnpm db:migrate:test` (or similar) script that
runs `prisma migrate deploy` against `medicore_test`, and document the full
one-time local setup (or automate it) in a root-level dev-setup doc.
