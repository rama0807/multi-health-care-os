# Module Overview

MediCore is organized into 16 core modules. Each module is a self-contained NestJS module with its own controller, service, repository, DTOs, and guards.

## Module List

| # | Module | Path | Status |
|---|--------|------|--------|
| 1 | Authentication | `src/modules/auth` | M2 |
| 2 | Organizations | `src/modules/organizations` | M2 |
| 3 | Users | `src/modules/users` | M2 |
| 4 | Patients | `src/modules/patients` | M3 |
| 5 | Appointments | `src/modules/appointments` | M4 |
| 6 | Medical Records | `src/modules/medical-records` | M5 |
| 7 | Prescriptions | `src/modules/prescriptions` | M5 |
| 8 | Laboratory | `src/modules/laboratory` | M6 |
| 9 | Radiology | `src/modules/radiology` | M6 |
| 10 | Billing | `src/modules/billing` | M7 |
| 11 | Insurance | `src/modules/insurance` | M7 |
| 12 | Pharmacy | `src/modules/pharmacy` | M8 |
| 13 | Inventory | `src/modules/inventory` | M8 |
| 14 | Staff | `src/modules/staff` | M9 |
| 15 | Notifications | `src/modules/notifications` | M12 |
| 16 | AI Copilot | `src/modules/ai` | M10 |

## Standard Module Structure

```
src/modules/example/
├── example.module.ts      # NestJS module definition
├── example.controller.ts  # HTTP route handlers
├── example.service.ts     # Business logic
├── example.repository.ts  # Data access (Prisma calls)
├── dto/
│   ├── create-example.dto.ts
│   ├── update-example.dto.ts
│   └── example-response.dto.ts
├── guards/
│   └── example-ownership.guard.ts (if needed)
├── events/
│   └── example.events.ts
└── __tests__/
    ├── example.service.spec.ts
    └── example.controller.spec.ts
```

## Cross-Module Dependencies

All shared types are in `@medicore/types`. Modules import each other's **services** only — never each other's repositories or direct Prisma models.
