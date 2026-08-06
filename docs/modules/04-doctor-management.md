# Module: Doctor Management (Milestone 4, Checkpoint 4.1)

> Scope note: the original roadmap's Milestone 4 ("Appointments & Scheduling")
> was split. Checkpoint 4.1 (this document) covers the doctor's own
> professional profile and directory. Checkpoint 4.2 covers doctor
> scheduling (weekly availability, leave, documents, audit timeline) - see
> `.ai/NEXT.md`. Appointment booking itself remains a later milestone.

## Purpose

Directory and professional-profile management for doctors. A `Doctor` is a
professional profile attached to a `User` account - it is the record every
other clinical module (appointments, prescriptions, lab/radiology orders)
references via `doctorId`.

## Responsibilities

- Doctor CRUD (create, read, update, soft-deactivate/restore)
- Professional profile fields (registration number, specialization,
  sub-specialization, qualification, experience, languages, bio,
  consultation fee, availability status, joining date)
- Linked user onboarding - creates (or reuses) the doctor's login account and
  grants the `DOCTOR` system role, via the shared `StaffOnboardingService`
- Search (name, specialization, registration number) and filters (hospital,
  department, language, availability status, active/inactive)
- Dashboard stats (total / active doctor counts)
- Doctor profile page (professional details + live clinical-record counts)

## Database Entities

- `Doctor` - professional profile (`packages/database/prisma/schema.prisma`)
- `User` - the linked login account (one-to-one via `Doctor.userId`)

`Doctor.availabilitySlots` (JSON) and `DoctorAvailabilityStatus` exist in the
schema already but only `availabilityStatus` is used by this checkpoint -
weekly-schedule structure and leave records are Checkpoint 4.2 scope.

## REST Endpoints

All under `/api/v1/doctors`, guarded by `PermissionsGuard` with
`doctors.{read,create,update,delete}` (`.all` or `.own` scope).

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/doctors` | List doctors (paginated, searched, filtered, sorted) | `doctors.read` |
| GET | `/doctors/stats/dashboard` | Total/active doctor counts | `doctors.read` |
| GET | `/doctors/me` | Caller's own linked doctor profile | *(any authenticated user)* |
| GET | `/doctors/:id` | Doctor profile + clinical-record summary counts | `doctors.read` |
| POST | `/doctors` | Register a new doctor (creates/links login + profile) | `doctors.create` |
| PATCH | `/doctors/:id` | Update professional profile | `doctors.update` |
| POST | `/doctors/:id/restore` | Reactivate a deactivated doctor | `doctors.update` |
| DELETE | `/doctors/:id` | Soft-deactivate (`isActive = false`) | `doctors.delete` |

## Linked User Onboarding

`DoctorsService.create` runs inside a single Prisma transaction:

1. `StaffOnboardingService.onboardUserInTransaction` - creates a new `User`
   with a random temporary password (or, if the email already belongs to a
   user in the same organization, grants that user the `DOCTOR` role instead
   of creating a duplicate account).
2. Rejects if the resolved user already has a `Doctor` profile.
3. Creates the `Doctor` row.

The onboarding email (new-account credentials, or "role granted" notice) is
sent **after** the transaction commits - never inside it - so a rollback can
never leave a user holding an email that promised access that doesn't exist.

`StaffOnboardingService` (`apps/api/src/common/onboarding/`) is deliberately
generic: it knows nothing about `Doctor` specifically and is reused as-is for
Nurse, Pharmacist, Lab Technician, Receptionist, and future staff modules -
each calls it from inside its own transaction before creating its own
profile row.

## Search & Filters

`GET /doctors` query params: `q` (name/specialization/registration number,
case-insensitive), `specialization`, `departmentId`, `hospitalId`,
`language`, `availabilityStatus`, `isActive`, `sortBy`
(`createdAt|firstName|specialization|experienceYears`), `sortOrder`, `page`,
`limit`.

## Frontend

- `/dashboard/doctors` - list with search, filters, sortable columns, bulk
  deactivate, dashboard stat cards
- `/dashboard/doctors/new` - multi-step registration form (account →
  professional info → review), with debounced localStorage draft recovery
- `/dashboard/doctors/[id]` - profile tabs (editable professional profile;
  live statistics: appointments/patients/prescriptions/lab tests/radiology
  orders), deactivate/restore

## Dependencies

- `StaffOnboardingService`, `EmailService` - account creation + notification
- `HospitalsService`, `DepartmentsService` - validates `hospitalId`, and that
  `departmentId` (if given) belongs to that hospital

## Events Published

- `doctor.created`
- `doctor.updated`
- `doctor.deactivated`
- `doctor.restored`

## Tests

- `apps/api/src/modules/doctors/doctors.service.spec.ts` - unit tests
- `apps/api/src/common/onboarding/staff-onboarding.service.spec.ts` - unit tests
- `apps/api/test/doctors.e2e-spec.ts` - full create → list → search → filter
  → update → deactivate → restore flow, permission checks, conflict handling

## Deferred to Checkpoint 4.2

- Weekly schedule / availability slots
- Leave management
- Dashboard availability stats (e.g. "on leave today")
- Doctor documents (certificates, ID proofs)
- Audit timeline view for a doctor's profile
