# DECISIONS.md

> Architectural decision log (ADR-style). Before asking the user an
> architecture question, check here first — if a decision already exists,
> follow it without asking again. Add a new entry whenever a real
> architectural choice is made (not for routine implementation details).

Format per entry:

```
## ADR-NNNN: <Title>
Date: YYYY-MM-DD
Status: Accepted | Superseded by ADR-XXXX | Deprecated

Context: why this decision was needed
Decision: what was decided
Consequences: tradeoffs accepted
```

---

## ADR-0001: Monorepo with pnpm workspaces + Turborepo

Date: 2026-07-31 (recorded retroactively; original decision predates `.ai/`)
Status: Accepted

**Context:** Backend (NestJS) and frontend (Next.js) share types, database
client, and UI primitives; independent repos would duplicate config and drift.

**Decision:** Single pnpm-workspace monorepo, orchestrated with Turborepo,
with `apps/api`, `apps/web`, and shared `packages/{config,database,types,ui}`.

**Consequences:** Single CI pipeline and versioning; requires discipline to
keep `packages/*` genuinely shared rather than backend- or frontend-specific.

---

## ADR-0002: NestJS modular-by-domain backend structure

Date: 2026-07-31 (recorded retroactively)
Status: Accepted

**Context:** Hospital domain has many bounded contexts (patients, billing,
pharmacy, lab, radiology, etc.) that need independent evolution.

**Decision:** One NestJS module per domain under `apps/api/src/modules/`,
with cross-cutting concerns (auth, permissions, audit, email, redis) in
`apps/api/src/common/`.

**Consequences:** Clear ownership boundaries per module; requires care that
shared logic doesn't get duplicated across modules instead of living in
`common/`.

---

## ADR-0003: Permission-based authorization, not just role-based

Date: 2026-07-31 (recorded retroactively, inferred from code)
Status: Accepted

**Context:** `roles.decorator.ts` and `roles.guard.ts` were removed in favor
of `permissions.decorator.ts` and `permissions.guard.ts`, backed by a
`PermissionsModule`/`PermissionsService`.

**Decision:** Authorization is enforced via fine-grained permissions rather
than coarse roles, even though the product still exposes roles (Admin,
Doctor, Nurse, Receptionist, Lab Tech, Pharmacist) at the UX level.

**Consequences:** More flexible access control (e.g. a custom role can be
composed of specific permissions) at the cost of more setup per new
protected route. New endpoints must use `@Permissions(...)` +
`PermissionsGuard`, not a role check.

---

## ADR-0004: `.ai/` project memory + `CLAUDE.md` constitution adopted

Date: 2026-07-31
Status: Accepted

**Context:** Multi-session AI-assisted development risks losing context,
re-litigating settled decisions, and drifting on code quality standards
between sessions.

**Decision:** Adopt `CLAUDE.md` as the standing constitution for all Claude
Code sessions in this repo, backed by a `.ai/` directory
(`PROJECT_CONTEXT.md`, `PROGRESS.md`, `NEXT.md`, `DECISIONS.md`,
`TECH_DEBT.md`, `SESSION_LOG.md`, `MODULE_STATUS.md`, `CHANGELOG.md`) that
every session must read before making changes and update after every
completed task.

**Consequences:** Slight overhead per task (must update several files), in
exchange for continuity, no repeated architecture debates, and an accurate
completion picture at all times.

---

## ADR-0005: Milestone 4 redefined as Doctor Management, split into two checkpoints

Date: 2026-07-31
Status: Accepted

**Context:** The original `docs/roadmap.md` Milestone 4 was "Appointments &
Scheduling." A prior (undocumented-in-`.ai/`) session had already built a
substantial Doctor Management feature — `apps/api/src/modules/doctors/`,
`apps/api/src/common/onboarding/staff-onboarding.*`, a Prisma migration
adding doctor professional-profile fields, and frontend pages under
`apps/web/src/app/dashboard/doctors/` — as groundwork for appointments
(you need doctors before you can schedule them). The user asked to reduce
scope per session and formalize this as Milestone 4's actual content.

**Decision:** Milestone 4 is redefined as "Doctor Management & Scheduling,"
split into:
- **Checkpoint 4.1 — Doctor Management:** CRUD, professional profile,
  linked-user onboarding, search/filters, dashboard stats, profile page,
  tests, docs.
- **Checkpoint 4.2 — Doctor Scheduling:** weekly schedules, leave
  management, availability, dashboard availability stats, doctor documents,
  audit timeline, remaining tests.

Only one checkpoint is implemented per session. Patient-facing appointment
*booking* (slot generation, conflict detection, booking flow, status
machine, calendar UI) remains deferred beyond Milestone 4 — see
`docs/roadmap.md`.

The generic `StaffOnboardingService` (`apps/api/src/common/onboarding/`)
is kept deliberately role-agnostic — it only handles the "create/link a
`User` + grant a role" half of onboarding and knows nothing about `Doctor`
specifically — so Nurse, Pharmacist, Lab Technician, Receptionist, and other
future staff-profile modules can call it as-is instead of reimplementing
account provisioning per role.

**Consequences:** `docs/roadmap.md`'s Milestone 4 section no longer matches
its original Week-5 scope; appointment booking work that was implicitly
"Milestone 4" is now unscheduled until a later milestone is defined. Doctor
scheduling (4.2) must not introduce new schema beyond what's needed for its
own checkpoint — the existing `Doctor.availabilitySlots` JSON field and
`DoctorAvailabilityStatus` enum (already in the schema from Checkpoint 4.1's
migration) are reserved for 4.2 rather than extended speculatively now.
