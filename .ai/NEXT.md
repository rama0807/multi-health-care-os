# NEXT.md

> The next logical task(s) to pick up. Replaced (not appended) whenever a
> milestone completes — this file always describes "start here," not history.

## Immediate Next Task

**Milestone 11 — Insurance Management.**

Milestone 10 (Billing) is now **fully complete**: the Charge Engine
(reusable `Charge` entity any clinical module bills through), a service
catalog with pricing, invoice creation (manual line items and/or
sweeping a patient's pending charges), a discount approval workflow
(flat/percentage, `billing.manage`-gated), GST-compliant invoicing,
multi-mode payments with split/partial support, refunds (same approval
workflow as discounts), invoice/receipt PDFs, auto-invoice generation
from a completed appointment, and a revenue dashboard — all implemented
backend + frontend, with 359 unit + 199 e2e tests passing (zero
failures) and lint/typecheck/build all green, browser-verified with 17
screenshots under `docs/screens/`. See `PROGRESS.md` and `SESSION_LOG.md`
(2026-08-03 entry) for exactly what was built, and `DECISIONS.md`
ADR-0015 for the schema/RBAC/roadmap-split decisions made. Do not
re-implement or re-verify any of it.

**This session's instruction narrowed Milestone 10 to Billing only**
("Insurance is NOT part of this milestone") — `docs/roadmap.md` now
reads: Milestone 10 — Billing (done), **Milestone 11 — Insurance
Management (this task)**, Milestone 12 — General Inventory, with former
Milestones 12–16 (Staff & Attendance through Production Hardening)
shifted to 13–17. See ADR-0015 for the full reasoning — do not re-ask
about this split, it's settled.

### Scope

Per `docs/roadmap.md`'s Milestone 11 deliverables (Week 13):

- Insurance policy management
- TPA/cashless claim workflow
- Claim status tracking
- Frontend: insurance claim management

This is a materially smaller milestone than Billing — a single bounded
feature (insurance claims against an invoice), not six sub-systems.
Check `DECISIONS.md` for precedent before assuming a checkpoint split is
needed (ADR-0005/0006/0009/0011 all split when a session's real scope
turned out narrower or wider than the roadmap's bullet list) — but
Laboratory, Radiology, Pharmacy, and Billing were each completed in a
single session despite looking similarly sized on paper, so don't split
preemptively either.

The `insurance` module already exists at
`apps/api/src/modules/insurance/` — per the pattern hit before every
prior milestone this project (confirm it's still the same 3-line no-op
scaffold this session — expect it to be, per `CLAUDE.md`'s "code is
ground truth" practice, but re-confirm rather than trusting this note).

The `InsuranceClaim` Prisma model already exists in `schema.prisma`
(search for `model InsuranceClaim`), alongside the `InsuranceClaimStatus`
enum (`DRAFT`/`SUBMITTED`/`UNDER_REVIEW`/`APPROVED`/
`PARTIALLY_APPROVED`/`REJECTED`/`SETTLED`, already in
`packages/types/src/enums.ts`) — confirmed unused (no service/controller
references it yet) as of this session. It already carries
`insuranceProvider`/`policyNumber`/`membershipId`/`claimedAmount`/
`approvedAmount`/`rejectedAmount`/`rejectionReason`/`submittedAt`/
`settledAt` fields directly on the claim row — **no separate
`InsurancePolicy` model exists** (confirmed again this session, same as
Milestone 10's note); check its full field list before assuming one is
needed for "insurance policy management" — it's plausible the roadmap
bullet just means "the policy/provider fields on a claim," not a
separate reusable policy record a patient could hold multiple claims
against. Decide deliberately and record the reasoning in a new ADR
either way, rather than assuming.

`Invoice.insuranceClaim InsuranceClaim?` (one-to-one, via
`InsuranceClaim.invoiceId String @unique`) is the integration point —
Milestone 10 built `Invoice`/`Payment` fully, so "insurance policy
management" and the claim workflow now have a real invoice to attach to
(this didn't exist before Milestone 10). Reuse `Invoice`/`Payment` as-is
(don't modify their schema for this) — a claim's `approvedAmount`,
once settled, most likely becomes recorded as a `Payment` with
`paymentMode: INSURANCE` (already in the `PaymentMode` enum, currently
excluded from the frontend's payment-mode picker — see ADR-0015 point
8) against the linked invoice, the natural way an insurance settlement
reduces `balanceDue` using the exact same mechanism a cash/card payment
already does. Confirm this reasoning holds before implementing it,
rather than inventing a parallel "insurance payment" concept.

### Judgment calls to check against `DECISIONS.md` first

- **Own-scope for `insurance.*`**: already seeded as all-scope
  (`RESOURCE_ACTIONS.insurance = ['read','create','update']`) — Cashier
  has `insurance.read` only, Hospital Admin has everything via its
  wildcard grant. Insurance claims are staff-facing (a cashier/billing
  clerk files and tracks claims across every doctor's patients), the
  same reasoning already applied to `billing.*`/`pharmacy.*`
  (ADR-0014/0015) — own-scope doesn't apply here either, by the same
  logic, unless something about claims specifically argues otherwise.
  Decide deliberately and record it, don't just copy this note verbatim
  without checking it still holds.
- **Does `insurance.*` need a `manage` action** (mirroring
  `billing.manage`'s discount/refund approval-gating role)? Consider
  whether claim submission/settlement needs the same
  "requester ≠ approver" separation Billing's discount/refund workflow
  established, or whether a claim's own status progression
  (`DRAFT → SUBMITTED → UNDER_REVIEW → ...`) is naturally gated by
  external TPA/insurer action instead (i.e. the claim's status changes
  because the insurer responded, not because an internal staff member
  "approves" it the way a discount is approved) — these are different
  shapes and shouldn't be conflated by default.
- Do not re-ask whether `BillingModule` should be imported into the new
  `InsuranceModule` for reuse — yes, mirror every prior module's
  cross-module-import pattern (e.g. `PharmacyModule` importing
  `PrescriptionsModule`) if the claim workflow needs to read/update an
  `Invoice`/`Payment`.

### Process reminders (from `CLAUDE.md`)

- Per the repository reading policy: this task touches Insurance,
  Billing (for the `Invoice`/`Payment` integration), Patients, and
  shared types — do not scan unrelated modules (Laboratory/Radiology/
  Pharmacy/AI are explicitly out of scope).
- Run full verification before calling it done: `pnpm lint && pnpm
  typecheck && pnpm test && pnpm build`, plus `pnpm test:e2e`.
- `pnpm --filter @medicore/database db:generate` after any schema change
  (TD-0008), and apply the new migration to **both** `medicore_dev` and
  `medicore_test` (TD-0004) — generate the raw SQL via `prisma migrate
  diff --from-url <db-url> --to-schema-datamodel prisma/schema.prisma
  --script` into a manually created `prisma/migrations/<timestamp>_
  <name>/migration.sql` folder, then `prisma migrate deploy` against
  each database — `prisma migrate dev` does not work non-interactively
  in this environment (hit and worked around this exact way during
  Milestone 10's session).
- If running a full `turbo run build --force` (or `pnpm build`) while a
  dev server is already running (for the browser walkthrough), kill the
  port 3000/4000 listeners and restart `pnpm dev` fresh afterward — a
  stale running process can serve clobbered/mismatched compiled output
  or 404 on brand-new routes despite the build succeeding (TD-0004
  addendum, hit repeatedly across nearly every milestone so far).
- No project skill or committed dependency exists for browser
  verification yet (TD-0010, still open) — Playwright was installed ad
  hoc into the session scratch directory again this session (reusing
  the Chromium binary already cached at `~/Library/Caches/ms-playwright`)
  and driven with a small Node script. Check `which chromium-cli` first
  in case it's since become available. Prefer `getByRole(...,
  {exact: true})`/dialog-scoped locators over bare `text=`/`:has-text()`
  selectors — this session's first walkthrough attempt repeatedly
  mis-clicked elements hidden behind a modal overlay or matched an
  unintended substring (e.g. "Apply discount" matching a `:has-text
  ("Apply")` selector meant for the dialog's "Apply" submit button).
- Update `PROGRESS.md`, `CHANGELOG.md`, `MODULE_STATUS.md`,
  `SESSION_LOG.md`, `TECH_DEBT.md`/`DECISIONS.md`, `PROJECT_CONTEXT.md`,
  and this file when done. Screenshot new UI under `docs/screens/` using
  an `insurance-*.png` naming convention.
- Once Milestone 11 (Insurance Management) is genuinely complete and
  verified per the Milestone Completion Checklist (backend + frontend +
  tests + docs + screenshots), replace `NEXT.md` with **Milestone 12 —
  General Inventory** (per `docs/roadmap.md`, correctly numbered per
  ADR-0015).
