# MODULE_STATUS.md

> Per-module status and completion percentage. Status values: **Completed /
> In Progress / Blocked / Deferred / Planned**. Update after every completed
> task; percentages are estimates of real implementation depth (code +
> tests + docs), not just "folder exists."

## Overall Project Completion: unaudited (folders scaffolded for full domain surface; depth not yet verified — see TECH_DEBT TD-0001)

## Backend (`apps/api/src/modules/`)

| Module | Status | Completion | Notes |
|---|---|---|---|
| auth | In Progress | Unaudited | JWT guard, CSRF guard, permissions guard present |
| users | In Progress | Unaudited | |
| roles | In Progress | Unaudited | Superseded in part by permissions module (ADR-0003) |
| organizations | In Progress | Unaudited | Multi-tenancy root entity likely |
| hospitals | In Progress | Unaudited | |
| departments | In Progress | Unaudited | |
| staff | In Progress | Unaudited | |
| doctors | **Completed** | **100% for Checkpoint 4.1** | CRUD, professional profile, linked-user onboarding, search/filters, dashboard stats, `/me`. Unit + e2e tests passing. Checkpoint 4.2 (scheduling/leave/documents/audit timeline) not started — see `NEXT.md`. |
| patients | In Progress | Unaudited | |
| appointments | In Progress | Unaudited | Controller/service/module present |
| medical-records | In Progress | Unaudited | |
| prescriptions | In Progress | Unaudited | |
| laboratory | In Progress | Unaudited | |
| radiology | In Progress | Unaudited | |
| pharmacy | In Progress | Unaudited | |
| inventory | In Progress | Unaudited | |
| billing | In Progress | Unaudited | |
| insurance | In Progress | Unaudited | |
| notifications | In Progress | Unaudited | |
| audit | In Progress | Unaudited | Listener + service present |
| ai | In Progress | Unaudited | Controller/service/module present |
| health | In Progress | Unaudited | Likely health-check endpoint |

## Backend — Common (`apps/api/src/common/`)

| Component | Status | Notes |
|---|---|---|
| JWT auth guard | In Progress | `guards/jwt-auth.guard.ts` |
| Permissions guard/service | In Progress | Has spec tests (`permissions.guard.spec.ts`, `permissions.service.spec.ts`) |
| CSRF guard | In Progress | Has spec test (`csrf.guard.spec.ts`) |
| Email module/service/templates | In Progress | |
| Redis module/service | In Progress | |
| Audit (decorators/filters/interceptors) | In Progress | |
| Staff onboarding (`common/onboarding/`) | **Completed** | Generic `StaffOnboardingService` — creates/links a `User` + role in a caller-owned transaction; role-agnostic by design so Nurse/Pharmacist/Lab Tech/Receptionist modules reuse it as-is. Has unit tests. |

## Frontend (`apps/web`)

| Area | Status | Notes |
|---|---|---|
| Doctors pages (`dashboard/doctors/*`) | **Completed** | List (search/filter/sort/bulk-deactivate/stats), multi-step registration form w/ draft recovery, profile page (editable + live stats). |
| App Router structure (`app/`) | In Progress | Unaudited (excluding doctors, above) |
| Shared components (`components/`) | In Progress | Unaudited |
| Providers / middleware | In Progress | `middleware.ts` present |
| Design system (`packages/ui`) | In Progress | Unaudited |

## Shared Packages

| Package | Status | Notes |
|---|---|---|
| `@medicore/database` | In Progress | Prisma-based, has db:generate/migrate/push/seed/studio scripts |
| `@medicore/types` | In Progress | Unaudited |
| `@medicore/config` | In Progress | Unaudited |
| `@medicore/ui` | In Progress | Unaudited |

## Infra / Ops

| Item | Status | Notes |
|---|---|---|
| CI (`.github/workflows/ci.yml`) | In Progress | Not yet verified end-to-end (TD-0002) |
| Docker (dev + prod compose) | In Progress | Unaudited |
| `infra/` | Planned/In Progress | Unaudited |

---

**Next step:** Run the audit described in `NEXT.md` and replace every
"Unaudited" cell above with a verified status and real completion percentage.
