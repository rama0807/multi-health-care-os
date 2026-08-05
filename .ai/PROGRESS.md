# PROGRESS.md

> Running log of what has actually been built, most recent first. Update
> after every completed task. Pair with `CHANGELOG.md` (human-facing summary)
> and `MODULE_STATUS.md` (per-module state).

## 2026-08-06 — Milestone 18 (Communication & Notification Platform) — complete

Instruction: build Milestone 18 in full (Checkpoints 18.1–18.7), audit
first, treat the repository as the source of truth, reuse existing
services, do not rebuild existing functionality, and **do not integrate
paid providers** — abstractions and local implementations only. AI work
stayed paused and untouched throughout.

### What the audit found, and how it changed the work

- `apps/api/src/modules/notifications/` **existed but was an empty stub**:
  a service whose constructor took `PrismaService` and did nothing with
  it, and a controller with zero routes. Nothing anywhere in the repo read
  or wrote the `Notification` table. So there was no write path to reuse —
  but also no data to migrate, which is why the model could be reshaped
  freely.
- `common/email/` was already the working sender (Resend, with a console
  fallback) for appointment confirmations, password resets and onboarding
  mail. A second sender was never on the table; the email channel adapter
  wraps it.
- `EventEmitter2` was already wired with **125 distinct events** emitted
  across every module, and `AuditListener` already demonstrated the
  many-listeners-on-one-event pattern. Event integration therefore added
  listeners, not emitters — with four genuine exceptions (below).
- `bullmq` was a dependency **used nowhere**. It stayed that way, on
  purpose (ADR-0027).
- `@nestjs/schedule` and `firebase-admin`/`firebase` were **not**
  dependencies, and none were added.

### Architecture (ADR-0027)

- **The `notification_deliveries` table is the queue.** Delivery history
  has to be durable and queryable for the admin console regardless; a
  broker would duplicate exactly those rows and eventually disagree with
  them. A row whose `nextAttemptAt` has elapsed *is* a queued job.
  Claiming is a compare-and-set on `status`, so two workers racing for one
  row produce one winner and one no-op.
- **One notification, many deliveries.** The notification's aggregate
  status is *derived* from its delivery rows on every attempt, never set
  directly — except that `READ` is sticky, so a late retry cannot make a
  read notification look unread again.
- **A suppressed channel is `SKIPPED`, never `FAILED`.** Nothing was
  attempted, so counting it as a failure would corrupt every success rate
  the console reports.
- **Preferences are evaluated at dispatch time**, so a delivery retried
  three hours later is re-checked against quiet hours as they are *then*.
- **`CRITICAL` overrides every preference; `SILENT` is in-app only.**
- **In-app is never optional** — it is the durable record the centre reads.
- **Channel providers mirror `StorageModule`/`AiCommonModule`**: one
  interface, five implementations, selected by channel.

### Files added

`apps/api/src/config/notifications.config.ts`;
`apps/api/src/modules/notifications/` — `channels/`
(`channel-provider.interface.ts`, `in-app.provider.ts`, `email.provider.ts`,
`fcm-push.provider.ts`, `sms.provider.ts`, `whatsapp.provider.ts`),
`default-templates.ts`, `notification-template.service.ts`,
`notification-preference.service.ts`, `notification-history.service.ts`,
`notification-queue.service.ts`, `notification-dispatcher.service.ts`,
`notification-scheduler.service.ts`, `notification-stats.service.ts`,
`user-device.service.ts`, `notification-events.listener.ts`,
`notification-admin.controller.ts`, `platform-notifications.controller.ts`,
`dto/notification.dto.ts`, plus four spec files;
`apps/api/src/modules/reports/cron-match.util.ts` (+ spec) and
`scheduled-reports.dispatcher.ts`;
`apps/api/test/notifications.e2e-spec.ts`;
`packages/types/src/notification.ts`;
`apps/web/src/lib/api/notifications.ts`,
`apps/web/src/lib/push/use-push-notifications.ts`,
`apps/web/public/push-sw.js`,
`apps/web/src/components/notifications/notification-bell.tsx`,
`apps/web/src/app/dashboard/notifications/{page,preferences/page,admin/page}.tsx`,
`apps/web/src/app/platform/notifications/page.tsx`.

### Files modified

`packages/database/prisma/schema.prisma` (+ migration
`20260805200000_notification_platform`), `packages/database/prisma/seed.ts`
(`notifications` and `platform.notifications` permission resources),
`packages/types/src/{index,enums}.ts` (`NotificationChannel` moved into
`notification.ts`), `apps/api/src/app.module.ts`,
`apps/api/src/modules/notifications/{notifications.service,
notifications.controller,notifications.module}.ts` (the stub, replaced),
`apps/api/src/modules/reports/reports.module.ts`.

**Four one-line `emit` additions** — the only changes to other modules'
business services, none of which moved any logic:
`inventory/stock.service.ts` (`inventory_stock.changed`),
`staff/shift-roster.service.ts` (`staff.roster.assigned`),
`hospitals/hospitals.service.ts` (`hospital.created`),
`auth/auth.service.ts` (`organization.onboarded`). Their three existing
spec files were updated for the new constructor argument.

### TD-0053 closed

Scheduled reports now genuinely dispatch. `ScheduledReportsDispatcher`
listens on `notifications.tick` (the notification worker's clock — no
second scheduler exists), matches the stored cron with a new
dependency-free `cron-match.util.ts`, claims each run by compare-and-set on
`lastRunAt`, runs the report through the existing registry, exports it
through the same `ReportExportService` the on-screen button uses, emails
the recipients, and notifies the report's owner in-app.

### Verification

`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm build`
— all pass. **727 API unit tests** (+64), **6 web unit tests**, and
**408 e2e tests across 21 suites** (+30). Web build emits
`/dashboard/notifications`, `/dashboard/notifications/admin`,
`/dashboard/notifications/preferences` and `/platform/notifications`.
No browser verification and no screenshots, by explicit instruction
(TD-0066).

### Honest gaps recorded

TD-0058 (the browser cannot mint an FCM token here — no Firebase SDK or
project; reported explicitly, never faked), TD-0059 (SMS/WhatsApp are
abstractions with a log driver only, by instruction), TD-0060 (scheduled
report linked, not attached), TD-0061 (email digest batching unimplemented,
disclosed on screen), TD-0062 (low-stock alerts cover only stock-service
movements, one alert per threshold), TD-0063 (the centre polls; no
websocket), TD-0064 (provider config is deployment-wide, not per tenant),
TD-0065 (no user picker for broadcasts), TD-0066 (not browser-verified).

---

## 2026-08-05 — Milestone 17 (Reports & Analytics) — complete

Instruction: build Milestone 17 in full, *"Everything should be generated
from existing data. Do NOT duplicate business logic. Reuse existing
services wherever possible."* AI work stayed paused and untouched.

The session opened with an audit, as instructed, and the audit changed
what got built:

- `reports: ['read', 'export']` **already existed** in the seed permission
  catalog, and the sidebar **already had** a dormant `reports.read`-gated
  `/dashboard/reports` link. No new permission or nav entry was needed —
  the route simply had nothing behind it.
- `recharts` was **already** a frontend dependency (the encounter
  weight-trend chart uses it), so no chart library was added. `NEXT.md`
  had flagged this as "check first"; it checked out.
- Five dashboard-shaped aggregation services already existed
  (`Billing`/`Ipd`/`Insurance`/`Staff`/`Inventory`), and their idioms —
  `Promise.all` fan-out, JS bucketing, `.toFixed(2)` money strings — were
  followed rather than replaced.
- Three roadmap metrics turned out **not to be derivable** from the
  schema. They were implemented as the closest honest measure and
  disclosed, not faked: no appointment arrival timestamp exists
  (TD-0051), no radiology machine-capacity model exists (TD-0052), and
  the laboratory module raises no `Charge` rows and `LabTestCatalogItem`
  has no price column (TD-0055).

### What was built

**Checkpoint 17.1 — Operational reports.** `apps/api/src/modules/reports/`
with a shared `report-range.util.ts` (exclusive-`to` windows, local-time
bucket keys, zero-filled series, null-safe comparisons) and eleven
services, each `GET /reports/<module>`:

| Report | Notable derivations |
|---|---|
| Patients | Cohort = registered-in-period plus seen-in-period; ages computed as at window end so a historical report is reproducible |
| Appointments | Doctor utilisation = booked minutes over real `DoctorSchedule` availability (breaks excluded), reusing `toMinutes`/`weekdayOf` from the scheduling module |
| Doctors | OPD from non-IPD encounters, IPD from `Admission.attendingDoctorId` — counting the auto-created IPD encounter instead would double-count the stay |
| Laboratory | Turnaround over orders *reported* in the window; revenue allocated evenly across an order's tests |
| Radiology | Machine **share of scheduled minutes**; unassigned studies grouped, not dropped |
| Pharmacy | Revenue is exact (`quantityDispensed x Drug.price`); unresolved items carry `null`, not a guess. Stock alerts are point-in-time by design |
| Inventory | Consumption from the `InventoryStockAdjustment` ledger, excluding inter-store `TRANSFER`; valuation excludes damaged/expired/lost |
| Billing | Invoiced revenue and collected cash kept **separate**; GST per slab backed out of tax-inclusive stored line totals; outstanding aged from due date, and measured live rather than scoped to the range |
| Insurance | Settlement ratio against **decided** claims; settled value from `insuranceShare`, not `approvedAmount` |
| IPD | Live occupancy snapshot **and** a true bed-days rate reconstructed from overlapping stays |
| Staff | Overtime reuses `ShiftsService.standardMinutes` — the same rostered-shift rule `PayrollService` applies |

**Checkpoint 17.2 — Executive dashboards.** `DashboardsService` builds
CEO / Medical Director / Operations / Finance / Department views by
composing the 17.1 services; it runs exactly one Prisma query of its own
(resolving a department name). One parameterised route,
`GET /reports/dashboards/:key`.

**Checkpoint 17.3 — Report builder.** `ReportRegistryService` pairs 23
`ReportDefinition`s with runners that reshape existing service output into
flat rows — so the builder UI, CSV, XLSX and PDF all render the same
`ReportRunResult` and cannot disagree. `SavedReport` (the milestone's only
new table) stores filters, never results. `xlsx.util.ts` writes a genuine
OOXML package in ~150 lines over `node:zlib` rather than adding a
spreadsheet dependency. `reports.export` gates downloads separately from
`reports.read` because an exported file leaves the system.

**Checkpoint 17.4 — Frontend.** Three routes under `/dashboard/reports`
plus `_components/charts.tsx` (line / bar / pie / area via recharts, and a
CSS-grid heatmap since recharts has no heatmap primitive).

**Checkpoint 17.5 — Verification.** `pnpm lint`, `typecheck`, `test`,
`test:e2e`, `build` all pass. **663 API unit tests** (615 baseline + 48)
and **378 e2e tests across 20 suites** (335 baseline + 43). The full e2e
suite was run four times; one run showed a single platform-suite failure
that did not reproduce in three subsequent full runs or when that suite
was run alone (36/36) — recorded here rather than left unmentioned. Not
browser-verified, by instruction.

---

## 2026-08-05 — Milestone 3 (Patient Management) — complete

Explicit instruction paused AI development after Checkpoint 15.1 and
asked for the next unfinished *non-AI* HMS milestone, determined from
`docs/roadmap.md` and `MODULE_STATUS.md` (`patients` was the only
pre-Milestone-15 module still "In Progress / Unaudited"). Read
`patients.service.ts`/`.controller.ts`/`.service.spec.ts` end to end
before writing anything: CRUD, UHID generation, search, timeline,
documents, emergency contacts, and duplicate *detection* were already
real and tested. Exactly three roadmap deliverables were missing:
family linkage, patient merge, and CSV import. See **ADR-0024** for the
full design.

- **Schema** (migration `20260805095836_patient_family_and_merge`,
  applied to both `medicore_dev`/`medicore_test`): `Patient` gained
  `headOfFamilyId` (self-relation `FamilyMembers`, one level deep by
  design) and `mergedIntoId` (self-relation `PatientMerges`), both
  indexed.
- **Backend** (`apps/api/src/modules/patients/`): `linkFamilyMember`/
  `unlinkFamilyMember`/`listFamilyMembers` (family graph kept flat by
  application-layer validation, not a DB constraint); `mergePatients`
  (transactionally reassigns `patientId` across all 16 linked models —
  `PATIENT_LINKED_MODELS` — plus family dependents, then soft-deletes
  the source with `mergedIntoId` set; `restore()` now refuses a merged
  record); `importFromCsv` (a hand-rolled RFC 4180 parser in
  `csv-parser.util.ts`, sequential per-row `create()` reuse, 500-row
  cap, per-row success/failure reporting). New DTOs
  (`link-family-member.dto.ts`, `merge-patients.dto.ts`) and shared
  types (`LinkFamilyMemberSchema`, `MergePatientsSchema`, `FamilyGroup`,
  `PatientMergeResult`, `CsvImportResult`) in `packages/types/src/patient.ts`.
- **RBAC**: new `patients.manage` action (seed.ts), gating `POST
  /patients/merge` and `POST /patients/import` — admin-only by default
  (mirrors `billing.manage`); family link/unlink reuse the existing
  `patients.update`.
- **Audit**: `audit.listener.ts` gained `patient.family_linked`/
  `family_unlinked`/`merged`/`import_completed` handlers.
- **Tests**: 20 new unit tests (`patients.service.spec.ts` +
  `csv-parser.util.spec.ts`, 578 API total) and 4 new e2e tests
  (`patients.e2e-spec.ts`, 299 total across 18 suites, zero failures).
- **Frontend**: `lib/api/patients.ts` extended (`getPatientFamily`,
  `linkFamilyMember`, `unlinkFamilyMember`, `mergePatients`,
  `importPatientsCsv`). Patient detail page gained a "Family" tab
  (view the resolved group from either the head or a member, link/
  unlink) and a "Merge" action in the header (patient search picker +
  direction choice, `patients.manage`-gated) with a banner on a merged
  record linking to the survivor. Patient list page gained an "Import
  CSV" dialog (`patients.manage`-gated) showing a per-row result list.
- **Full verification, all green**: `pnpm lint`/`typecheck`/`test`
  (578 API + 6 web unit)/`build` clean across all 6 packages;
  `test:e2e` 299/299 passing (18 suites, run against the
  `medicore-postgres`/`medicore-redis` containers on 5434/6381 per the
  established `--runInBand` workaround). Not browser-verified —
  explicit instruction this session (no Playwright, no screenshots).
- **Milestone 15 (AI) deliberately left untouched** beyond Checkpoint
  15.1, per instruction — `NEXT.md` still describes 15.2 as the AI
  continuation point whenever AI work resumes.

---

## 2026-08-05 — Milestone 15, Checkpoint 15.1 (AI Clinical Assistant) — complete

Milestone 15 was first split into five checkpoints (**ADR-0023**, plan
recorded in `NEXT.md`); this session delivered **15.1** only, per
instruction. 15.1 is deliberately the *platform* checkpoint: it builds
every cross-cutting AI concern once and proves it against seven
text-in/text-out generators that need no new input-ingestion path.
Checkpoints 15.2–15.5 each add exactly one capability on top.

Started from the pre-existing 29-line no-op `ai` module scaffold (the
same category as the `Medication`/`MedicalRecord`/`Ward`/`Staff`
scaffolds every prior milestone found); confirmed no AI-related schema
or enum existed before designing anything.

- **Platform layer** (`apps/api/src/common/ai/`) — an `AiProviderAdapter`
  interface with four *real* HTTP adapters (OpenAI Chat Completions,
  Anthropic Messages, Gemini `generateContent`, Ollama `/api/chat`),
  chosen by a `useFactory` off `ConfigService` exactly as
  `StorageModule` chooses its driver. `AiClientService` is the only
  thing domain code injects: feature flags, exponential-backoff retry
  (retryable failures only), timeouts, token accounting, cost
  derivation, and provider-error → HTTP mapping that never echoes raw
  provider text to a caller.
- **Domain layer** (`apps/api/src/modules/ai/`) — seven generators
  (SOAP Note, Clinical Note Summarization, Lab Result Summarization,
  Radiology Report Summarization, Prescription Explanation, Discharge
  Summary, Referral Letter) over one `POST /ai/generate` (+ `/stream`)
  discriminated-union endpoint; `ClinicalContextService` assembles
  read-only context by reusing the existing EMR/Laboratory/Radiology/
  Prescriptions/IPD modules; prompt templates are bundled defaults with
  org-scoped, append-only versioned overrides.
- **Schema** (migration `20260804231008_ai_clinical_assistant`, applied
  to both `medicore_dev`/`medicore_test`): `AiConversation`,
  `AiMessage`, `AiUsageLog`, `AiPromptTemplate` + four enums.
- **RBAC** — new `ai` (`read`/`generate`/`manage`) and `ai.templates`
  (`read`/`manage`) namespaces; `ai.read`/`ai.generate` own-scope
  capable, Doctor own-scoped, Nurse all-scope, usage reporting
  `ai.manage`-gated.
- **Frontend** — a streaming `AiAssistDialog` + permission-gated
  `AiAssistButton`, a `/dashboard/ai` page (Assistant/Conversations/
  Usage + provider status), a new sidebar item, "AI SOAP note"/"AI
  summary" on the Encounter detail header, and "AI draft" on the IPD
  Discharge tab.
- **Verification** — `pnpm lint`, `pnpm typecheck`, `pnpm test`
  (558 unit / 75 suites, +45 new), `pnpm build` all green; e2e 295/296
  (18 new AI tests all pass). The one failure (`doctor-documents` →
  "lets a doctor read their own audit timeline") was reproduced
  identically on a pristine HEAD worktree — **pre-existing, unrelated
  to this work**.
- **Deferred, disclosed, not faked** — no AI provider credential exists
  in this environment, so every generation endpoint returns **503 with
  an explicit reason** and produces no clinical text (**TD-0041**); PHI
  reaches a third-party provider with no BAA by default, mitigated but
  not solved by `AI_INCLUDE_PATIENT_IDENTIFIERS=false` and self-hosted
  Ollama (**TD-0042**). No browser walkthrough or screenshots this
  session, by instruction (mirrors TD-0035/TD-0036).

---

## 2026-08-05 — Milestone 14 (Staff & Attendance) — complete

Continued from the now-replaced `NEXT.md`, which framed this as a
Staff/Attendance/Shift/Leave milestone for non-doctor employees, on
top of an unaudited pre-existing `Staff` model + 3-line `staff` module
scaffold. Audited both before touching anything, then built the full
scope this session's instruction gave (Staff Management/Attendance/
Leave Management/Shift Scheduling/Payroll Preparation/Dashboard/RBAC).
See **ADR-0022** for the full design (scope boundary vs. the existing
doctor-specific scheduling system, schema, RBAC).

- **Schema** (migration `20260804210705_staff_attendance_management`,
  applied to both `medicore_dev`/`medicore_test`): `Staff` extended
  with `hospitalId`, `employmentType`/`employmentStatus` enums
  (replacing `isActive`/`shiftType`), `reportsToId` (self-relation),
  `dateOfLeaving`, `monthlySalary`. New models: `StaffDocument`
  (mirrors `DoctorDocument`), `Shift` (org-scoped catalog), `ShiftRoster`
  (one row per staff per date), `Attendance` (one row per staff per
  date, server-derived status), `Holiday`, `LeaveTypeConfig` (per-org
  annual-day quota per `LeaveType`), `StaffLeave` (mirrors
  `DoctorLeave`).
- **RBAC**: `staff`/`staff.documents` (mirrors `doctors`/`doctors.
  documents`), new `attendance`/`leave`/`shifts`/`shifts.roster`
  namespaces. Every non-doctor role (Nurse/Receptionist/Lab
  Technician/Radiology Technician/Pharmacist/Cashier/Inventory
  Manager) granted `.own`-scoped self-service (clock in/out, apply/
  cancel own leave, view own roster); HR granted the full all-scope
  admin set plus its own self-service.
- **Backend** (`apps/api/src/modules/staff/`, 20 new files):
  `StaffRefService` (mirrors `DoctorRefService`), `StaffService`
  (onboarding via the existing generic `StaffOnboardingService`, CRUD,
  employment-status transitions), `StaffDocumentsService`+`Controller`
  (mirrors `DoctorDocumentService` exactly), `ShiftsService` (catalog
  CRUD + `standardMinutes` — the shift-length calculation shared with
  attendance/payroll), `ShiftRosterService` (assign/bulk-assign/list),
  `AttendanceService` (clock-in/out with server-derived Present/Late/
  Half-Day from the day's roster + shift grace period, manual `mark()`
  override, `correct()`, monthly calendar, dashboard stats),
  `HolidaysService`, `LeaveTypesService`, `StaffLeaveService` (mirrors
  `DoctorLeaveService` — apply/approve/reject/cancel, overlap
  conflict, computed leave balance), `StaffDashboardService`,
  `PayrollService` (attendance/leave/overtime summary + hand-built
  CSV export — Payroll Prep only, no pay-run processing).
- **Audit integration**: `audit.listener.ts` gained 13 new `@OnEvent`
  handlers across staff/document/attendance/leave lifecycle events.
- **Tests**: 8 new unit spec files (49 tests, covering onboarding
  conflicts, the late/half-day/week-off derivation rules, leave
  overlap + balance computation, payroll overtime/deduction math) +
  `apps/api/test/staff.e2e-spec.ts` (14 e2e tests — the full golden
  path: staff creation with a real provisioned login, shift + roster
  assignment, clock-in/out, correction, document upload, leave-type
  config → apply → approve → balance, holiday calendar, staff/
  attendance dashboards, payroll summary + CSV export, employment
  status change). All passing (513 API unit / 278 e2e total across
  the whole API, zero failures).
- **Frontend** (`apps/web/src/lib/api/{staff,shifts,attendance,leave,
  payroll}.ts` + `apps/web/src/app/dashboard/staff/**`, 7 routes):
  Dashboard (stat tiles, self clock-in/out widget), Directory (search/
  filter + add-staff dialog with a real hospital/department picker),
  Profile page (`[staffId]`, tabs: Overview/Documents/Attendance-
  calendar/Leave-with-balance), Shifts (catalog CRUD), Roster (weekly
  grid + assign dialog — the first real staff-picker Select in this
  repo's frontend), Attendance (org-wide list + correction dialog),
  Leave (requests/leave-types/holidays tabs), Payroll Prep (summary
  table + CSV export). Reused the pre-existing dormant sidebar "Staff"
  link (`/dashboard/staff`, `staff.read`-gated) unchanged — no sidebar
  edit needed.
- **Full verification, all green**: `pnpm lint`/`typecheck`/`test`
  (513 api unit + 6 web)/`test:e2e` (278/278)/`build`, all clean
  across all 6 packages.
- **Not browser-verified** — this session's own instructions said not
  to use Playwright, open a browser, or generate screenshots (TD-0036,
  mirrors Milestone 13's TD-0035 under the same kind of explicit
  instruction).
- Replaced `.ai/NEXT.md` with **Milestone 15 — AI Features** (not
  started).

---

## 2026-08-05 — Milestone 13 (General Inventory) — complete

Continued directly from Frontend Checkpoint 1 (below) per an explicit
resume instruction: backend/dashboard/item-master/lookups/API-client/
sidebar-fix were already done and verified; built the ten remaining
frontend surfaces on top of the unaudited Milestone 13 backend
(commit `e7f4abb`), per `NEXT.md`'s scope list. Read every inventory
controller/service and the shared `packages/types/src/inventory.ts`/
`procurement.ts` types first (see ADR-0020, recorded retroactively to
close the backend's own dangling `// see ADR-0020` code-comment
references). See ADR-0021 for this session's frontend decisions.

Built, under `apps/web/src/app/dashboard/inventory/`:
- **Stores** (`stores/page.tsx`) — CRUD (name/code/type/location) +
  a per-store "Managers" dialog (assign/remove, free-text user ID —
  no staff picker exists yet, see TD in ADR-0021).
- **Stock** (`stock/page.tsx`) — two tabs: **Stock levels** (store/
  low-stock/expiring filters, "Set opening stock" dialog, per-row
  "Adjust" — damage/loss/expiry/correction — and "Levels" — reorder/
  min/max — dialogs) and **Transfers** (create with a multi-item line
  builder, dispatch/receive/cancel actions).
- **Vendors** (`vendors/page.tsx`) — searchable CRUD table (rating/
  outstanding-balance columns) + a star-rating dialog.
- **Purchase Requests** (`purchase-requests/page.tsx` +
  `[id]/page.tsx`) — create (store + multi-item line builder), detail
  page with submit/approve/reject(reason)/cancel actions and a
  "Create purchase order" link once Approved.
- **Purchase Orders** (`purchase-orders/page.tsx` + `[id]/page.tsx`) —
  create ad hoc (vendor/store/item lines with unit price + tax) or
  from an approved request via `?fromPr=<id>` (auto-opens the dialog,
  pre-fills store + items, locks quantities to the request); detail
  page with submit/approve/send/cancel(reason) and a "Record goods
  receipt" link once Sent.
- **Goods Receipt** (`grn/page.tsx` + `[id]/page.tsx`) — create against
  a Sent PO (picked directly or via `?fromPo=<id>`), per-remaining-item
  quantity/batch/expiry entry; detail page with complete (applies
  stock via `StockService.receiveStock`) /cancel actions.
- **Vendor Invoices** (`vendor-invoices/page.tsx`) — create (vendor/
  invoice number/dates/amount/tax), record-payment dialog, inline
  verify/dispute status actions.
- **Store Requisitions** (`requisitions/page.tsx` + `[id]/page.tsx`) —
  create (from-store/to-store/priority/item lines), detail page with
  approve/reject(reason)/cancel plus per-item issue/receive quantity
  inputs (partial-fulfillment-capable, mirrors the pharmacy dispense
  detail page's pattern).
- **Stock Audits** (`audits/page.tsx` + `[id]/page.tsx`) — create
  (snapshots current store stock), detail page with start/record-
  per-item-counts/complete(applies variance)/cancel.
- **Assets & Maintenance** (`assets/page.tsx` + `[id]/page.tsx`) —
  register/edit (Asset-type items only), detail page with assign
  (user/department/store), assignment history, and maintenance
  records (log + complete, with a status-derived asset-status side
  effect on the backend already).
- `lib/api/inventory.ts` extended (Stores/Stock/Transfers/Vendors) and
  a new `lib/api/procurement.ts` (Purchase Requests/Orders, GRN,
  Vendor Invoices, Requisitions, Stock Audits, Assets) added, per
  `NEXT.md`'s own suggestion to split once `inventory.ts` got
  unwieldy.
- Inventory Dashboard's button row extended with links to all ten new
  pages, each gated on its own `inventory.*.read` permission.

**Bug fixed in passing (not a feature change):** four backend spec
files (`assets`/`purchase-orders`/`requisitions`/
`stock.service.spec.ts`) failed `pnpm lint`'s `@typescript-eslint/
require-await` rule — `jest.fn(async (cb) => cb(prisma))` had no
`await` inside the arrow function. Removed the unneeded `async`; no
test behavior changed (`cb(prisma)` already returns whatever `cb`
itself returns, a promise for every real `$transaction` caller).

**Verification — all green:**
- `pnpm lint` / `pnpm typecheck` / `pnpm build`: clean across all 6
  packages.
- `pnpm test`: 471 API unit + 6 web unit, all passing (zero new test
  files needed — no backend logic changed, this session is pure
  frontend wiring against an already-tested API).
- `pnpm test:e2e`: 264/264 passing — required starting the local
  Postgres/Redis dev containers (`medicore-postgres`/`medicore-redis`,
  mapped to ports 5434/6381 per `apps/api/.env`; a `docker compose up`
  had instead started a *different*, unmapped `medicore_postgres`
  container that conflicted with an unrelated project already on host
  port 5432 — stopped it and started the pre-existing correctly-mapped
  containers instead) and confirming the `medicore_test` DB's migrations
  were current (they were — no drift).
- **No browser walkthrough, by explicit instruction this session**
  ("Do NOT use Playwright. Do NOT open a browser. Do NOT generate
  screenshots. Do NOT perform manual UI walkthroughs") — overriding
  the standing Screenshot policy. Disclosed as TD-0035 rather than
  claimed as browser-verified.

**Deferred, disclosed, not fabricated:** Vendor Returns has a working,
tested backend (`/inventory/vendor-returns`) but no frontend — it
wasn't in the user's explicit remaining-scope list (TD-0034). No
staff/user picker exists anywhere in this repo yet, so store-manager
and asset-user assignment both take a free-text internal user ID
(disclosed on-page, same shape as the pre-existing TD-0028 pattern).

**Milestone 13 is now fully complete.** See `.ai/NEXT.md` for
**Milestone 14 — Staff & Attendance**, next.

## 2026-08-05 — Milestone 13, Frontend Checkpoint 1 (Inventory Dashboard, Item Master & Lookups) — complete

Resumed from a prior session's uncommitted-to-`.ai/` backend work: commit
`e7f4abb` ("inventory_module: partial implementation") had already landed
a comprehensive General Inventory backend — Item Master (5 lookup tables
+ `InventoryItem`), Stores, Stock, Vendors, the Purchase Request → Purchase
Order → Goods Receipt Note procurement chain, Store Requisitions, Stock
Audits, Vendor Invoices, and Assets + Maintenance — with unit/e2e tests,
but `.ai/` docs still described Milestone 13 as "next" with no backend.
Per the resume instruction, did not re-audit that backend; treated it as
ground truth and built the first frontend checkpoint on top of it.

Built, under `apps/web/src/app/dashboard/inventory/`:
- **Dashboard** (`page.tsx`) — 12 stat tiles from `GET /inventory/
  dashboard` (items/stores/value/low-stock/expiring/expired/pending
  PR/PO/GRN/requisition/maintenance-due/breakdown), links to Items and
  Lookups.
- **Item Master** (`items/page.tsx`) — searchable/paginated table
  (name/code/type/category/unit/cost/status), add/edit dialog with
  category/item-group/unit/manufacturer/brand `Select`s populated from
  the lookup endpoints.
- **Categories & Lookups** (`lookups/page.tsx`) — one page, five tabs
  (Categories/Item Groups/Units/Manufacturers/Brands), each an inline
  add-form + activate/deactivate list, mirroring how the backend's
  `ItemMasterService` already groups these five near-identical CRUD
  surfaces into one file.
- `lib/api/inventory.ts` — API client for the dashboard, items, and all
  five lookup endpoints.

**Bug fixed in passing**: `components/layout/sidebar.tsx` gated the
Inventory nav item on a permission string `inventory.read` that doesn't
exist in the seeded RBAC resource map (`inventory.items`/`stores`/
`stock`/`procurement`/`vendors`/`requests`/`assets`/`audit` are the real
sub-resources) — no seeded role would ever have satisfied it, so the nav
item was unreachable for everyone. Changed to `inventory.items.read`,
the permission the new dashboard/items controllers actually require.

**Verification**: `pnpm --filter @medicore/web lint|typecheck|build|test`
all pass. No browser walkthrough — no browser tool available this
session (per Verification Policy, disclosing rather than claiming
UI-verified).

**Not done yet** (Milestone 13 frontend, per the Milestone Completion
Checklist, is NOT complete): Stores, Stock (levels/adjust/transfer),
Vendors, Purchase Requests, Purchase Orders, Goods Receipt, Store
Requisitions, Stock Audits, Vendor Invoices, Assets + Maintenance pages.
See `NEXT.md`.

## 2026-08-04 — Milestone 12, Checkpoint 12.2 (Nursing, Medication Administration & Discharge) — complete

Ran in Auto Mode, continuing directly from Checkpoint 12.1 without
re-implementing or re-verifying it. Resolved `NEXT.md`'s four judgment
calls and recorded **ADR-0019**: nursing notes/assessments/I-O
charting/orders/tasks are new admission-scoped models (not
`ClinicalNote` reuse — nurse-authored, higher-frequency, tied to the
stay); IPD vitals charting reuses the existing encounter-scoped
`Vital` model unchanged (no new model); MAR reuses `Prescription`/
`PrescriptionItem` with a `MedicationAdministration` admin-log child
table (mirrors `DispenseOrder`/`DispenseItem`); discharge is a
four-step workflow (approve → checklist + summary → finalize) that
closes TD-0030 by raising a real per-stay room `Charge` at finalize.
Per the reading policy, work touched IPD (extending this session's own
module), Medical Records (`Vital` reuse decision, `EncountersService.
updateStatus` reuse to close the encounter at discharge), Billing
(`ChargesService.create` reuse — added `ChargeSourceModule.IPD`),
Prescriptions (`PrescriptionItem` reuse for MAR), Prisma schema, and
shared types.

- **Schema** (migrations `20260804220000_nursing_mar_discharge` and
  `20260804221000_ipd_charge_source_module`, applied to both
  `medicore_dev`/`medicore_test`): 8 new models — `NursingNote`,
  `NursingAssessment`, `IntakeOutputRecord`, `IpdOrder`, `NursingTask`,
  `MedicationAdministration`, `DischargeChecklistItem`,
  `DischargeSummary` — plus `Admission.dischargeApprovedAt`/
  `dischargeApprovedByUserId` and a new `ChargeSourceModule.IPD` enum
  member. New enums: `NursingNoteType`, `FallRiskLevel`,
  `PressureUlcerRiskLevel`, `IpdOrderCategory`, `IpdOrderStatus`,
  `NursingTaskStatus`, `NursingTaskPriority`,
  `MedicationAdministrationType`, `MedicationAdministrationStatus`,
  `DischargeChecklistItemKey`. Recorded **ADR-0019**.
- **RBAC**: new namespaced resources `ipd.nursing`
  (notes/assessments/I-O, all-scope), `ipd.orders`/`ipd.tasks`/
  `ipd.mar` (all-scope), and `ipd.discharge` split into `create`
  (doctor approval)/`update` (nursing checklist+summary)/`manage`
  (finalize, mirrors `billing.manage`) — all all-scope, mirroring
  `ipd.beds`/`ipd.transfer`'s precedent rather than `ipd.admissions`'
  own-scope carve-out (disclosed as TD-0032, not silently accepted).
  Doctor granted orders read/create/update + discharge
  read/create/manage + nursing/tasks/mar read; Nurse granted
  nursing/tasks/mar full read-write + discharge read/update;
  Receptionist granted discharge read-only.
- **Backend** (`apps/api/src/modules/ipd/`): `NursingNotesService`,
  `NursingAssessmentsService` (server-derives fall-risk/Braden risk
  levels from disclosed score thresholds, computes GCS total),
  `IntakeOutputService` (computes total intake/output/balance),
  `IpdOrdersService` (create/discontinue, blocks on a non-`ADMITTED`
  admission), `NursingTasksService` (admission-scoped list + an
  org-wide queue, optionally spawned from an order), `MedicationAdministrationService`
  (`generateScheduled` — times × days, `createAdHoc` — PRN/STAT,
  `administer`/`recordException` — missed/refused/held/delayed, all
  requiring a nurse signature), `DischargeService` (`approve` — seeds
  8 checklist items idempotently, `updateChecklistItem`, `upsertSummary`,
  `generateSummaryPdf`, `complete` — validates approval + full
  checklist + a summary, vacates the bed via the existing
  `BedAllocationService.vacate`, raises a `Charge` via
  `ChargesService.create`, closes the encounter via
  `EncountersService.updateStatus`, sets `AdmissionStatus.DISCHARGED`).
  `IpdDashboardService` extended with `inpatients`/`occupancyPercent`/
  `pendingDischarge`/`pendingNursingTasks`. 20 new `AuditListener`
  handlers for every new action.
- **Frontend**: four new tabs on `/dashboard/ipd/[admissionId]`
  (Nursing, Orders & Tasks, MAR, Discharge — Overview retained as the
  first tab), `/dashboard/ipd/discharges` (pending/discharged queue),
  `/dashboard/nursing` (dashboard), `/dashboard/nursing/tasks`
  (org-wide queue), `/dashboard/nursing/patients` (patient census —
  disclosed as the census since no per-nurse assignment model exists).
  New "Nursing" sidebar nav item. IPD dashboard page gained 4 new stat
  tiles and Discharges/Nursing quick-link buttons.
- Unit + e2e tests passing (35 new unit, 15 new e2e — 441 unit / 241
  e2e total across the whole API, zero failures); lint/typecheck/
  test/build all clean; browser-verified end to end (admitted a real
  patient into ICU Ward Bed 34, recorded a nursing note/assessment
  with a real derived "Fall risk: High" badge/I-O chart entry with a
  real computed 100ml balance, placed a doctor order that spawned a
  completed nursing task, recorded real vitals on the linked
  encounter, scheduled and administered a real MAR dose with a nurse
  signature and recorded a missed-dose exception, walked discharge
  through approve → all 8 checklist items → summary → finalize with
  the bed correctly landing in "Cleaning" and a genuine downloaded
  discharge-summary PDF, confirmed the Discharges queue/Nursing
  Dashboard/Nursing Tasks queue/IPD dashboard all reflect the real
  activity).
- **Deferred, disclosed, not faked**: no per-nurse ward-assignment
  model (Assigned Patients = full census); discharge RBAC is
  all-scope, not doctor-own-scoped (TD-0032); MAR's barcode-ready
  fields have no real scanner hardware (TD-0033).

**Milestone 12 is now fully complete.** See `.ai/NEXT.md` for
**Milestone 13 — General Inventory**, next.

## 2026-08-04 — Milestone 12, Checkpoint 12.1 (IPD Admission, Wards & Bed Management) — complete

Ran in Auto Mode. `NEXT.md`'s framing assumed a clean schema slate for
Ward/Bed/Admission — that was wrong: all three models (plus `BedType`/
`BedStatus`/`AdmissionStatus` enums) existed unaudited since the very
first scaffolding migration, the same category of unused scaffold as
`Medication` before ADR-0014 and the flat `MedicalRecord` before
ADR-0008. Audited, extended, and recorded as **ADR-0018** (hierarchy,
status-enum design, optional bed-at-admission, encounter reuse-vs-
create, insurance-admission via `patientInsuranceId`, dropped
`AdmissionStatus.TRANSFERRED`, two-model transfer/allocation history).
Explicitly excluded per instruction: Nursing Notes, Medication
Administration, Discharge Summary (all Checkpoint 12.2) — and, as a
consequence, IPD billing integration (its only sensible trigger is
discharge) — see TD-0030. Per the reading policy, work touched IPD
(new module), Patients (existing `getTimeline`/`getSummaryCounts`
already read `prisma.admission`, verified compatible field names),
Encounters (reused `EncountersService` to create/reuse the IPD
encounter), Doctors (`DoctorRefService` reuse), Insurance
(`PatientInsurance` reuse for "Insurance Admission"), Prisma schema,
and shared types.

- **Schema** (migration `20260804120000_ipd_bed_management`, applied
  to both `medicore_dev`/`medicore_test`): new `Room`, `BedAllocation`,
  `BedTransfer` models. `Ward` gained `floor`/`block`/`type`/`status`
  (dropped scaffold's `isActive`/`totalBeds`). `Bed`'s unique
  constraint moved from `[bedNumber, wardId]` to `[bedNumber, roomId]`;
  gained `roomId`. `Admission` gained `encounterId`/`attendingDoctorId`
  (renamed from `doctorId`)/`departmentId`/`roomId`/
  `patientInsuranceId`/`type`/`expectedDischargeAt`/`cancelledAt`/
  `cancelReason`/`createdByUserId`; `wardId` became required,
  `bedId`/`roomId` stayed optional. New enums: `WardType`,
  `WardStatus`, `RoomStatus`, `AdmissionType`, `BedAllocationAction`;
  `BedType`/`BedStatus`/`AdmissionStatus` redefined to the checkpoint's
  spec'd value sets; `EncounterType` gained `IPD`. Recorded **ADR-0018**.
- **RBAC**: new namespaced resources `ipd.wards`/`ipd.rooms`/
  `ipd.beds` (inventory CRUD, all-scope) and `ipd.admissions`
  (admit/cancel workflow, own-scope-capable)/`ipd.transfer`
  (allocate/reserve/vacate/transfer workflow, all-scope) — mirrors
  `insurance.providers`/`insurance.claims`'s split-by-sub-workflow
  precedent. Doctor role granted `ipd.admissions.*` at `own` scope
  (mirrors `medical_records`/`prescriptions`) plus all-scope read on
  ward/room/bed inventory; Nurse granted operational read + `ipd.beds.
  update` + `ipd.transfer.*`; Receptionist granted admission
  read/create + inventory read.
- **Backend** (`apps/api/src/modules/ipd/`): `WardsService`/
  `RoomsService`/`BedsService` (CRUD, soft-deactivate — a bed can't be
  deactivated while `OCCUPIED`, see TD-0031 for the ward/room-level
  gap), `AdmissionsService` (admit — supports Emergency/Scheduled/
  Insurance/Transfer-from-OPD via one code path; auto-creates a fresh
  `IPD` encounter or reuses a passed-in one; cancel — releases any
  allocated bed), `BedAllocationService` (allocate/reserve/cancel-
  reservation/vacate/transfer — a vacated or transferred-from bed lands
  in `CLEANING`, not directly `AVAILABLE`), `IpdDashboardService`
  (available/occupied/ICU-occupancy/admissions-today/discharges-today-
  placeholder/transfers-today, all real queries). Sequential admission
  numbering (`ADM-<prefix>-<year>-<seq>`, advisory-locked, mirrors
  `LAB-`/`RAD-` precedent). Every mutation emits an `@OnEvent` captured
  by 8 new `AuditListener` handlers (`ipd.admission_*`, `ipd.bed_*`).
- **Frontend**: `/dashboard/ipd` (dashboard), `/dashboard/ipd/wards`,
  `/dashboard/ipd/rooms`, `/dashboard/ipd/beds` (color-coded bed grid
  grouped by ward/room, `?wardId=`/`?roomId=` deep-linkable),
  `/dashboard/ipd/admissions` (queue + a 5-step Admit Patient wizard —
  Patient & Type / Care Team / Ward-Room-Bed / Details / Review),
  `/dashboard/ipd/[admissionId]` (allocate/reserve/cancel-reservation/
  vacate/transfer actions, a merged bed-allocation-+-transfer history
  timeline). Sidebar's dormant "Wards & Beds" nav item (unbuilt since
  Milestone 4, `departments.read`-gated) replaced with "IPD & Beds"
  pointing at `/dashboard/ipd`, gated on `ipd.admissions.read`. Patient
  detail page gained a real "Admissions" tab (current admission +
  history, encounter link) replacing nothing — this data path didn't
  exist before.
- Unit + e2e tests passing (47 new unit, 16 new e2e — 406 unit / 226
  e2e total across the whole API, zero failures); lint/typecheck/build
  all clean; browser-verified end to end (ward/room/bed creation, an
  Emergency admission walked through the full wizard with a real
  auto-generated `ADM-MED-2026-000002` number and auto-created IPD
  encounter, a transfer between beds with the old bed correctly
  landing in `CLEANING`, a vacate, the bed grid and dashboard both
  reflecting real live counts, the patient's new Admissions tab).
- **Deferred, disclosed, not faked**: IPD billing integration and
  discharge (TD-0030 — Checkpoint 12.2); ward/room deactivation doesn't
  check for occupied beds inside it (TD-0031).

See `.ai/NEXT.md` for **Milestone 12, Checkpoint 12.2 — Nursing,
Medication Administration & Discharge**, next.

## 2026-08-04 — Milestone 11 (Insurance Management) — complete

Ran in Auto Mode against a materially larger deliverable list than
`NEXT.md`'s framing (which was scoped to "policy/TPA claim workflow
against the existing `InsuranceClaim` scaffold" only) — the session's
actual instruction asked for full Insurance Company/TPA/Corporate
provider + plan management, per-patient primary/secondary coverage,
a cashless/TPA pre-authorization workflow, the claim workflow plus
settlement (insurance share/patient share/adjustment/write-off),
automatic claim-document attachment from every clinical/billing
module's existing report generator, and six new `/dashboard/insurance*`
frontend routes plus a Patient Insurance tab and an Encounter Insurance
tab. Recorded as **ADR-0016** (schema/RBAC/scope decisions). Per the
reading policy, work touched Insurance, Billing (`InvoicesService`/
`PaymentsService` reuse), Patients, Encounters, Laboratory, Radiology,
Prescriptions, Prisma schema, and shared types.

- **Schema** (migration `20260802224429_insurance_management`, applied
  to both `medicore_dev`/`medicore_test`): new `InsuranceProvider`,
  `InsurancePlan`, `PatientInsurance`, `PreAuthorization` (+
  `PreAuthAttachment`), `ClaimDocument` models; `InsuranceClaim` gained
  `encounterId`, structured FKs to the four new models, settlement
  fields (`insuranceShare`/`patientShare`/`adjustmentAmount`/
  `writeOffAmount`/`outstandingAmount`/`paymentStatus`), and
  `PARTIALLY_SETTLED`/`CLOSED` added to `InsuranceClaimStatus`. New
  enums: `InsuranceProviderType`, `InsuranceNetworkType`,
  `PatientInsuranceType`, `PatientInsuranceStatus`,
  `PreAuthorizationStatus`, `ClaimDocumentType`, `ClaimPaymentStatus`.
  Recorded **ADR-0016**.
- **RBAC**: split the flat `insurance` resource into
  `insurance.providers`/`insurance.plans`/`insurance.claims`/
  `insurance.preauth`/`insurance.settlement` (mirroring `doctors.
  schedule`/`doctors.leave`'s namespaced-sub-resource precedent).
  `insurance.settlement.manage` stays admin-only (like `billing.
  manage`) — a cashier files/tracks claims and pre-auths but doesn't
  approve the final insurer-vs-patient settlement split.
- **Backend** (`apps/api/src/modules/insurance/`, rebuilt from the
  3-line scaffold): `InsuranceProvidersService`/`Controller`,
  `InsurancePlansService`/`Controller`, `PatientInsuranceService`/
  `Controller` (nested under `insurance/patients/:patientId/
  coverages`; enforces one active coverage per type via app-level
  check, no DB constraint — keeps enrollment history queryable),
  `PreAuthorizationService`/`Controller` (Draft → Submitted → Under
  Review → Approved/Partially Approved/Rejected/Cancelled, file
  attachments via the existing `StorageService`), `ClaimDocumentsService`
  (auto-attaches Invoice/Prescription/Lab-Report/Radiology-Report PDFs
  by reusing each module's existing `generatePdf`/`generateReportPdf`,
  plus a new purpose-built Encounter Summary PDF generator; auto-attach
  failures are logged and skipped rather than failing claim creation),
  `InsuranceClaimsService`/`Controller` (full lifecycle plus settlement
  — a settled claim's insurance share is recorded as a real `Payment`
  with `paymentMode: INSURANCE` against the linked invoice via the
  existing `PaymentsService`, the same mechanism a cash/card payment
  already uses), `InsuranceDashboardService`/`Controller`.
- **Audit integration**: `audit.listener.ts` gained 12 new `@OnEvent`
  handlers covering pre-authorization and claim lifecycle events.
- **Tests**: 7 new unit spec files (providers/plans/patient-insurance/
  pre-authorization/claim-documents/insurance-claims/insurance-
  dashboard — 46 tests) plus `apps/api/test/insurance.e2e-spec.ts` (11
  e2e tests: provider/plan CRUD, the "one active primary coverage"
  conflict, the full pre-auth workflow, claim creation with real
  auto-attached documents, the duplicate-invoice-claim conflict, the
  full claim workflow through settlement with a genuine `Payment`
  recorded, an out-of-order-transition rejection, the cashier-can't-
  settle RBAC split, and dashboard stats). All passing (359 unit / 210
  e2e total across the whole API — zero failures).
- **Frontend**: `apps/web/src/lib/api/insurance.ts` (full API client)
  plus:
  - `/dashboard/insurance` — dashboard (six stat tiles + a claim-
    status breakdown bar chart).
  - `/dashboard/insurance/providers` and `/plans` — list + add/edit
    dialogs.
  - `/dashboard/insurance/preauth` — queue with status filter and
    inline submit/review/decide/cancel actions.
  - `/dashboard/insurance/claims` — queue with status filter.
  - `/dashboard/insurance/[claimId]` — detail page: settlement panel,
    a timeline built from the claim's own lifecycle timestamps, a
    document list (auto-attached vs. manually uploaded, with upload/
    download), and every workflow action.
  - The Patient detail page's pre-existing (placeholder) "Insurance"
    tab now lists real coverage records and an add-coverage dialog.
  - The Encounter detail page gained a new "Insurance" tab: lists pre-
    auths/claims for that encounter and lets staff request a pre-auth
    or file a claim directly from the clinical context (the claim
    form asks for the invoice ID, since no encounter→invoice lookup
    endpoint exists yet — see TECH_DEBT).
  - The sidebar's pre-existing "Insurance" link's permission string was
    updated from the old flat `insurance.read` to `insurance.claims.
    read` to match the RBAC split above.
- **Full verification, all green**: `pnpm --filter @medicore/database
  db:generate`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (359 api unit
  + 6 web), `pnpm test:e2e` (210/210), `pnpm build` (all 6 packages,
  including all 6 new `/dashboard/insurance*` routes).
- **Browser-verified end to end** (Playwright installed ad hoc into the
  session scratch dir per TD-0010, reusing the cached Chromium binary).
  Port 3000 was occupied by an unrelated project's dev server during
  this session (`onehaul-front-app`) — rather than killing another
  project's process, the verification ran MediCore's web app on port
  3100 with `FRONTEND_URL` adjusted on the API side to match (CORS is
  origin-locked to `FRONTEND_URL`). Logged in as `admin@medicore.demo`
  and drove the full golden path: created a provider and plan, added a
  patient's coverage, requested a pre-authorization from that patient's
  encounter, approved it from the queue, filed a claim (confirmed real
  auto-attached Invoice + Encounter Summary PDFs on the claim), and
  walked the claim through Submit → Under Review → Approved → Settled
  → Closed — confirming a real `Payment` landed against the invoice.
  12 screenshots saved under `docs/screens/` (`insurance-*.png`). **One
  real bug caught and fixed**: the "Add provider" dialog sent empty
  strings for unfilled optional fields (`contactPerson`/`email`/
  `phone`) instead of omitting them; `CreateInsuranceProviderSchema`'s
  `email: z.string().email().optional()` accepts `undefined` but
  rejects an empty string, so leaving the email field blank made every
  provider-creation attempt fail with a generic "Validation failed" —
  fixed by converting each optional field to `undefined` when empty
  before sending.
- **Deferred, disclosed, not faked**: Discharge Summary auto-attach
  (explicitly future per the milestone spec — IPD/discharge doesn't
  exist yet); an encounter→invoice lookup endpoint, so the Encounter
  Insurance tab's "File claim" form asks for the invoice ID as free
  text rather than resolving it automatically (TD-0028); a genuine
  per-claim audit-log timeline view (the claim detail page's "Timeline"
  is synthesized from the claim's own lifecycle timestamp columns, not
  a full audit-trail feed the way the Patient page's dedicated
  Timeline/Audit tabs are — TD-0029).
- Since every item in `CLAUDE.md`'s Milestone Completion Checklist is
  met (backend, frontend, tests, lint/typecheck/build, docs,
  screenshots), **Milestone 11 (Insurance Management) is complete in a
  single session.** Updated `.ai/NEXT.md`: replaced with **Milestone
  12 — IPD & Bed Management**.

---

## 2026-08-03 — Milestone 10 (Billing) — complete

Explicit instruction this session narrowed Milestone 10 to Billing only
("Insurance is NOT part of this milestone"), the full deliverable list
(Charge Engine, Invoice, Payments, Discounts, Taxes, Receipts, Refunds,
APIs, frontend, dashboard). Recorded as **ADR-0015** (mirrors ADR-0013/
ADR-0014's practice of recording an explicit in-session scope
instruction that supersedes `NEXT.md`'s prior framing). Per the reading
policy, work touched Billing, Appointments (auto-invoice trigger),
Patients, Prisma schema, and shared types — Laboratory/Radiology/
Pharmacy/Insurance/AI were not modified beyond confirming `insurance`
is still the untouched 3-line scaffold.

- Confirmed `apps/api/src/modules/billing/` and `insurance/` were still
  3-line no-op scaffolds, and that `Invoice`/`InvoiceItem`/`Payment`/
  `InsuranceClaim` (from the original scaffolding commit) were completely
  unused — same "reuse as-is, extend only where it doesn't fit" audit
  every prior milestone has done.
- **Schema** (migration `20260802202302_billing_management`, applied to
  both `medicore_dev`/`medicore_test`): new `ServiceCatalogItem` (org-
  scoped pricing catalog), new `Charge` (the reusable Charge Engine
  entity — `sourceModule`/`sourceId` record provenance without a hard FK
  into each clinical module), new `Refund`; `Invoice` gained
  `encounterId` (nullable, unique, mirrors the pre-existing
  `appointmentId`) plus a full discount-approval-workflow field set
  (`discountType`/`discountValue`/`discountReason`/
  `discountApprovalStatus`/`discountRequested`/`discountApprovedBy`/`At`)
  and `finalizedAt`/`cancelledAt`/`cancelReason`. New enums:
  `ChargeSourceModule`, `ChargeStatus`, `DiscountType`,
  `DiscountApprovalStatus`, `RefundStatus`. Recorded **ADR-0015** for all
  of the above plus the discount/refund approval-workflow semantics and
  the "any completed refund flips the invoice to REFUNDED" decision
  (mirroring `DispenseOrder.RETURNED`'s precedent).
- **RBAC**: no `seed.ts` changes needed — `billing.manage` was already
  seeded and already excluded from the `Cashier` role (only `Hospital
  Admin`'s wildcard grant includes it), so the "separate requester from
  approver" need for discounts/refunds was already satisfied by the
  existing permission catalog.
- **Backend** (`apps/api/src/modules/billing/`, rebuilt from scratch):
  `ServiceCatalogService`/`Controller` (catalog CRUD), `ChargesService`/
  `Controller` (the reusable "create a charge" entry point, list/void),
  `InvoicesService`/`Controller` (create from manual items and/or
  swept charges, add line item, discount request/approve/reject,
  finalize, cancel with charge-release, PDF generation),
  `PaymentsService`/`Controller` (record payment — repeat calls with
  different modes/amounts *is* split/partial payment, no separate
  endpoint needed — receipt PDF), `RefundsService`/`Controller`
  (request/approve/reject), `BillingDashboardService` (today's revenue,
  pending invoices, outstanding balance, refunds today, pending
  discount/refund approval counts, 7-day collection trend),
  `AppointmentInvoiceListener` (listens to the pre-existing
  `appointment.status_changed` event, creates a `CONSULTATION` charge
  priced from `Doctor.consultationFee` + org GST rate, sweeps it into a
  new draft invoice — idempotent via `Invoice.appointmentId`'s existing
  unique constraint, failures logged and swallowed). Pure billing-math
  helpers in `billing-calculations.ts` (gross → item discount → tax →
  total, plus an optional invoice-level discount on top).
- **Audit integration**: `audit.listener.ts` gained 12 new `@OnEvent`
  handlers covering charge/invoice/payment/refund lifecycle events.
- **Tests**: 8 new unit spec files (`billing-calculations`,
  `service-catalog.service`, `charges.service`, `invoices.service`,
  `payments.service`, `refunds.service`, `billing-dashboard.service`,
  `appointment-invoice.listener` — 46 tests) plus
  `apps/api/test/billing.e2e-spec.ts` (29 e2e tests: catalog CRUD,
  charge creation/void, invoice creation from manual items and from
  swept charges, the full discount approval workflow including a
  non-manage cashier's request landing PENDING and a second-request
  conflict, finalize/cancel with charge release, a genuine downloaded
  invoice PDF, split + partial payments with a genuine receipt PDF,
  the full refund approval workflow including an over-refund rejection,
  auto-invoice generation from a real completed appointment via
  `AppointmentsService`'s existing status-transition event, dashboard
  stats, 401 without a token). All passing (359 unit / 199 e2e total
  across the whole API — zero failures).
- **Frontend**: `apps/web/src/lib/api/billing.ts` (full API client) plus:
  - `/dashboard/billing` — dashboard (revenue/pending/outstanding/
    refunds tiles, pending-approvals banner, 7-day collection-trend bar
    chart).
  - `/dashboard/billing/invoices` — org-wide invoice list (status
    filter) + a New-invoice dialog (patient search-and-pick, a pending-
    charges sweep checklist, a manual line-item builder with add/remove
    rows).
  - `/dashboard/billing/invoices/[invoiceId]` — detail page: line items
    + totals breakdown, discount request/approve/reject (with a pending-
    approval banner), finalize/cancel actions, a payments section
    (record-payment dialog, per-payment receipt download), a refunds
    section (request-refund dialog, approve/reject for `billing.manage`
    holders), invoice PDF download.
  - `/dashboard/billing/payments` — org-wide payment list with receipt
    download.
  - `/dashboard/billing/refunds` — org-wide refund list with status
    filter and approve/reject actions.
  - The sidebar's pre-existing "Billing" link (`billing.read`-gated)
    needed no changes — it already pointed at `/dashboard/billing`.
- **Full verification, all green**: `pnpm --filter @medicore/database
  db:generate`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (313 api unit
  + 6 web), `pnpm test:e2e` (199/199), `pnpm build` (all 6 packages,
  including all 4 new `/dashboard/billing*` routes).
- **Browser-verified end to end** (Playwright + Chromium in the session
  scratch dir per TD-0010; stale dev processes on ports 3000/4000 from
  before this session were killed and restarted fresh per TD-0004, both
  before and after the verification build): logged in as
  `admin@medicore.demo`, created a real invoice for a real patient
  (manual "General Consultation" line item, ₹800 + 18% GST = ₹944),
  applied a 10% discount (auto-approved since the admin holds
  `billing.manage`, total recomputed to ₹864), finalized the invoice,
  recorded two ₹400 cash payments (partial → paid, confirmed via the
  status badge), requested and completed a ₹200 refund (invoice flipped
  to "Refunded", balance due recomputed correctly to ₹64), and confirmed
  the Payments/Refunds/Invoices list pages and the dashboard all reflect
  the real activity. 17 screenshots saved under `docs/screens/`
  (`billing-*.png`). **Two real bugs caught and fixed during this
  pass**: (1) the New-invoice dialog never navigated to the created
  invoice's detail page after success — fixed by adding a
  `router.push`; (2) the dashboard's 7-day collection-trend bars never
  rendered any visible height — a CSS bug (the bar's percentage `height`
  had no definite-height ancestor to resolve against, since the flex
  column wrapping it used `items-end` instead of an explicit height) —
  fixed by giving each day's column an explicit `h-32` (matching the
  container) instead of relying on `items-end` alone.
- **Deferred, disclosed, not faked**: Insurance (its own Milestone 11,
  per this session's explicit scope instruction — see ADR-0015);
  invoice/receipt QR codes are a labeled placeholder box, not a real
  scannable payment code, since no payment gateway is configured
  anywhere in this repo (TD-0027); no standalone Service Catalog/Charges
  admin UI was built, only the invoice-creation flow's sweep-and-ad-hoc
  surface (TD-0024); `InvoiceStatus.OVERDUE` is never automatically set,
  since no scheduled-job infrastructure exists in this repo (TD-0026).
- Since every item in `CLAUDE.md`'s Milestone Completion Checklist is
  met (backend, frontend, tests, lint/typecheck/build, docs,
  screenshots, with Insurance explicitly and only excluded by
  instruction), **Milestone 10 (Billing) is complete in a single
  session.** Updated `.ai/NEXT.md`: replaced with **Milestone 11 —
  Insurance Management**.

---

## 2026-08-03 — Milestone 9 (Pharmacy Management) — complete

Explicit user instruction this session reordered the roadmap ahead of
`NEXT.md`'s plan: build Pharmacy Management now (not Billing & Insurance),
under the label "Milestone 9," with Billing/Insurance explicitly excluded
and general (non-drug) inventory implicitly out of scope too (the
instruction only described drug catalog/dispensing/stock/returns). Per
`CLAUDE.md`'s guidance on new information contradicting a settled
decision, this was recorded as **ADR-0014** — a reorder-and-split of
`docs/roadmap.md` (old Milestone 9 Billing/Milestone 10 Pharmacy &
Inventory → new Milestone 9 Pharmacy, Milestone 10 Billing & Insurance,
Milestone 11 General Inventory; former 11–15 shift to 12–16). Per the
reading policy, work touched Pharmacy, Prescriptions, Encounters,
Patients, Prisma schema, and shared pharmacy types.

- Confirmed `apps/api/src/modules/pharmacy/` was still the 3-line no-op
  scaffold (same pattern every module hits before its milestone), and
  that the pre-existing `Medication`/`InventoryItem` models (from the
  original scaffolding commit) were completely unused (zero references
  anywhere in `apps/api`/`apps/web`/`packages/types`/`seed.ts`).
- **Schema** (migration `20260802183901_pharmacy_management`, applied to
  both `medicore_dev`/`medicore_test`): `Medication` renamed and extended
  into `Drug` — one row *is* one batch (batch number + expiry live
  directly on the catalog row, not a separate `DrugBatch` table, per the
  roadmap's own field list) — with brand name, dosage form, tax percent,
  current/reserved stock, minimum stock level, and reorder level. New
  `DispenseStatus` enum (`PENDING`/`PREPARING`/`READY`/`DISPENSED`/
  `CANCELLED`/`RETURNED`). New `DispenseOrder` (one per prescription,
  `prescriptionId` unique), `DispenseItem` (mirrors a `PrescriptionItem`
  1:1), and `DrugReturn` models. Recorded **ADR-0014** for all of the
  above plus the status-machine semantics (partial vs. complete dispense,
  reject vs. cancel as the same `CANCELLED` transition distinguished by a
  `rejected` flag, returned reached from a `DrugReturn` record) and the
  stock-reservation design (reserve on batch selection, convert to
  deducted on dispense, release on cancel/reject).
- **RBAC decision**: `pharmacy.*` stays **all-scope** for every role that
  has it (already seeded this way) — pharmacy is staff-facing (a
  pharmacist dispenses across every doctor's prescriptions), not
  doctor-owned like lab/radiology orders, the same reasoning `NEXT.md`
  had already flagged for Billing/Insurance. **Pharmacist role gained
  `prescriptions.update`** (previously read-only) so completing a
  dispense can transition the source prescription to `COMPLETED`. Re-ran
  `pnpm db:seed`; `syncRolePermissions` synced it with zero manual
  intervention.
- **Backend** (`apps/api/src/modules/pharmacy/`, rebuilt from scratch):
  `DrugCatalogService`/`Controller` (CRUD, stock adjustment, low-stock/
  expiring-within-days filters, pagination/sorting) and
  `DispenseService`/`Controller` — create from a prescription (validates
  `ACTIVE`, one order per prescription), batch selection (reserves
  stock, releases/re-reserves on re-selection), mark ready (requires
  every item assigned), partial dispense (repeatable, converts reserved
  → deducted), complete dispense (fills remainder, moves to `DISPENSED`,
  completes the prescription), reject/cancel (releases reservations),
  medicine returns (restocks, moves to `RETURNED`), dashboard stats.
- **Audit integration**: `audit.listener.ts` gained 4 new `@OnEvent`
  handlers (`dispense_order.created`/`status_changed`/
  `partially_dispensed`, `drug_return.created`).
- **Tests**: 25 new unit tests (`drug-catalog.service.spec.ts`,
  `dispense.service.spec.ts`) + 20 new e2e tests
  (`apps/api/test/pharmacy.e2e-spec.ts` — catalog CRUD, full dispense
  lifecycle including insufficient-stock/over-return rejections,
  reject/cancel, dashboard stats). All passing (267 unit / 170 e2e
  total, zero failures).
- **Frontend**: `apps/web/src/lib/api/pharmacy.ts` + 5 new pages
  (`/dashboard/pharmacy` dashboard, `/catalog`, `/dispense` queue,
  `/stock`, `/[dispenseId]` detail) + a "Dispense" button on the
  encounter detail page's Prescriptions tab (creates a dispense order
  and navigates straight to its detail page).
- **Full verification, all green**: `pnpm --filter @medicore/database
  db:generate`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (267 api unit +
  6 web), `pnpm test:e2e` (170/170), `pnpm build` (all 6 packages).
- **Browser-verified end to end**: killed stale dev processes and
  restarted fresh (TD-0004); Playwright reused from the session scratch
  dir (`chromium-cli` still not available — TD-0010). Logged in as
  `admin@medicore.demo`, created a real patient/encounter/prescription via
  the API for fixture speed, then drove every Pharmacy page through the
  browser: added 3 drug batches (including a low-stock/near-expiry one to
  confirm warning badges), created a dispense order from the "New
  dispense" picker, selected batches for both items, marked ready,
  partially dispensed one item, completed the dispense (confirmed the
  source prescription flipped to "Completed" on the encounter page),
  recorded a partial return (order moved to "Returned"), and separately
  rejected a second dispense order with a reason. 19 screenshots saved
  under `docs/screens/`. Caught and fixed one real bug during this pass:
  the dashboard's "Dispensed today" stat excluded orders that had since
  moved to `RETURNED`, undercounting — fixed to count by `dispensedAt`
  regardless of current status (still `DISPENSED` or `RETURNED`).
- Updated `.ai/NEXT.md`: replaced entirely with **Milestone 10 — Billing
  & Insurance**.

## 2026-08-02 — Milestone 8 (Radiology Management) — complete

Explicit, detailed user instruction this session asked for a full
Radiology Information System — materially more than `NEXT.md`'s
narrower "no catalog, no versioned reports" framing (see **ADR-0013**
for why the expanded scope was implemented rather than the minimal
version, and why that's not a silent override of settled scope). Per
the reading policy, work touched Radiology, Encounter (consultation-order
link), Patients, Doctors, and shared types.

- Confirmed `apps/api/src/modules/radiology/` was still the 3-line no-op
  scaffold (same pattern every module hits before its milestone), and
  that `RadiologyOrder`/`RadiologyStatus`/`Priority` already existed in
  `schema.prisma` from the original scaffolding commit with no
  `encounterId` and no catalog concept — matching what `NEXT.md` flagged.
- **Schema** (migration `20260801202731_radiology_management`, applied
  to both `medicore_dev`/`medicore_test`): new `RadiologyCatalogItem`
  model (code/name/category/modality/bodyPart/contrastRequired/price/
  estimatedDurationMinutes, org-scoped, `@@unique([organizationId, code])`);
  `RadiologyOrder` gained `encounterId`, `catalogItemId`, full scheduling
  fields (`scheduledAt`/`room`/`machine`/`technicianUserId`/
  `radiologistDoctorId`/`durationMinutes`), report fields (`technique`/
  `recommendations`/`verifiedByUserId`/`verifiedAt`/`releasedByUserId`/
  `releasedAt` — `findings`/`impression`/`reportedBy`/`reportedAt`/
  `reportFileUrl` already existed); `RadiologyStatus` gained `REJECTED`;
  new append-only `RadiologyReport` model (versioned, mirrors
  `ClinicalNote`); new `RadiologyAttachment` model + `RadiologyAttachmentType`
  enum (`IMAGE`/`PDF`/`EXTERNAL_IMAGING`/`DICOM_PLACEHOLDER` — the latter
  two are metadata-only, no file). Recorded **ADR-0013** for all of the
  above plus the own-scope/role decisions.
- **Own-scope decision**: `radiology.read`/`create`/`update` changed from
  all-scope to own-scope for the Doctor role in `seed.ts`, mirroring
  ADR-0012's laboratory decision exactly. **New `Radiology Technician`
  role** added to `ROLE_SPECS` (all-scope `radiology.*` + `patients.read`)
  — `SystemRole.RADIOLOGY_TECHNICIAN` already existed unused in the schema
  enum, the same situation `LAB_TECHNICIAN` was in before Milestone 7.
  Nurse gained `radiology.read`. Re-ran `pnpm db:seed`; `syncRolePermissions`
  (TD-0011's fix) synced everything correctly with zero manual intervention.
- **Backend** (`apps/api/src/modules/radiology/`, rebuilt from scratch):
  `RadiologyCatalogService`/`Controller` (catalog CRUD, not own-scope
  checked, mirrors `LabCatalogService`) and `RadiologyOrdersService`/
  `Controller` — `create` (from an encounter, catalog-sourced or ad-hoc
  modality/bodyPart, `RAD-<orgPrefix>-<year>-NNNNNN` numbering via the
  same advisory-lock pattern), `update` (clinical indication/priority,
  pre-schedule only), `schedule` (dedicated action, `ORDERED`/`SCHEDULED`
  → `SCHEDULED`, supports reschedule), `startStudy`/`completeStudy`
  (`SCHEDULED → IN_PROGRESS → COMPLETED`), `addReportVersion` (append-only,
  `COMPLETED`-only, denormalizes onto the order), `verifyReport`/
  `releaseReport` (sequential — release requires verification first,
  `COMPLETED → REPORTED`), `uploadReportFile` (external file path,
  `COMPLETED → REPORTED` directly), `generateReportPdf` (structured
  `pdfkit` PDF from the order's current report fields), attachment
  actions (`addFileAttachment`/`addExternalAttachment`/`listAttachments`/
  `deleteAttachment`), `getDashboardStats`, a fixed `ALLOWED_TRANSITIONS`
  state machine (`ORDERED → SCHEDULED/REJECTED/CANCELLED`,
  `SCHEDULED → IN_PROGRESS/CANCELLED`, `IN_PROGRESS → COMPLETED/CANCELLED`,
  `COMPLETED → REPORTED` via `releaseReport` only — never the generic
  status route), and `assertOwnScopeOk` (same idiom as `LabTestsService`).
- **Audit integration**: `audit.listener.ts` gained
  `radiology_order.ordered`/`status_changed`/`report_drafted` handlers;
  `AuditService.listForDoctor`'s resource list grew to include
  `RadiologyOrder` (`audit.service.spec.ts` updated to match).
- **Tests**: `radiology-catalog.service.spec.ts` (5 unit tests),
  `radiology-orders.service.spec.ts` (29 unit tests — create/catalog
  auto-population/order numbering, schedule/reschedule, start/complete,
  report authoring/verify/release sequencing, generic-status
  CANCELLED/REJECTED-only guard, own-scope enforcement, PDF gating,
  attachments), plus `apps/api/test/radiology.e2e-spec.ts` (29 e2e tests
  — catalog CRUD + duplicate-code rejection, the full order lifecycle
  (schedule → start → complete → author report → verify → release →
  download PDF → upload image attachment → add external/DICOM-placeholder
  attachment), an independent external-report-file path, rejection/
  cancellation, dashboard stats, own-scope enforcement, 401). All passing
  (242 unit / 150 e2e total across the whole API — the one other e2e
  failure this session, `appointments.e2e-spec.ts`'s walk-in test, is the
  **pre-existing, unrelated** TD-0017 midnight flake, confirmed by
  running it in isolation outside the ~23:30–23:59 window).
- **Frontend**: `apps/web/src/lib/api/radiology.ts` (full API client)
  plus:
  - `/dashboard/radiology` — dashboard (today's/pending-reporting/
    completed/cancelled/urgent stat tiles, recent urgent/STAT studies).
  - `/dashboard/radiology/orders` — org-wide queue (doctor/status/priority
    filters, inline start/complete actions).
  - `/dashboard/radiology/catalog` — catalog management page.
  - `/dashboard/radiology/[orderId]` — order detail (Scheduling tab:
    date/time/room/machine/radiologist-picker/duration; Report tab:
    versioned report editor + verify/release actions + version history +
    PDF download; Attachments tab: image/PDF upload + external/DICOM
    -placeholder metadata form + list/delete).
  - A **Radiology tab** on the encounter detail page (catalog-or-ad-hoc
    order form, list of the encounter's orders linking to their detail
    page).
  - A **"Recent imaging" panel** on the medical-records patient-timeline
    list page, alongside the existing prescriptions/lab-orders panels.
- **AI image interpretation and PACS/DICOM integration: explicitly
  out of scope** (**TD-0019**, by direct instruction, not
  credential-blocked) — `RadiologyAttachment`'s `DICOM_PLACEHOLDER`/
  `EXTERNAL_IMAGING` types are the designed extension point for a future
  PACS integration.
- **Full verification, all green**: `pnpm --filter @medicore/database
  db:generate`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (242 api unit +
  6 web), `pnpm test:e2e` (149/150 — the 1 failure is the pre-existing
  unrelated TD-0017 flake), `pnpm build` (all 6 packages, `turbo run
  build --force`, including all 4 new `/dashboard/radiology*` routes).
- **Browser-verified end to end** (Playwright + Chromium in the session
  scratch dir per TD-0010; two stale `pnpm dev` processes from before
  this session were killed and restarted first, per TD-0004): logged in
  as `admin@medicore.demo`, added an "X-Ray Chest" catalog item, created
  a real radiology order from a real patient's encounter, scheduled it
  (room/machine/duration), started and completed the study, authored a
  full report (clinical indication/technique/findings/impression/
  recommendations), verified and released it (order genuinely
  transitioned to "Reported"), downloaded a real PDF (`file` confirmed
  "PDF document, version 1.3, 1 pages"), uploaded a real image attachment
  and a metadata-only external/DICOM-placeholder attachment, and
  confirmed both the org-wide queue and the patient-timeline "Recent
  imaging" panel render the order correctly. 19 screenshots saved under
  `docs/screens/` (`radiology-*.png` + `medical-records-recent-imaging.png`).
- Since every item in `CLAUDE.md`'s Milestone Completion Checklist is
  met (backend, frontend, tests, lint/typecheck/build, docs, screenshots,
  with AI interpretation/PACS explicitly and only excluded by
  instruction), **Milestone 8 (Radiology Management) is complete in a
  single session.** Updated `.ai/NEXT.md`: replaced with **Milestone 9 —
  Billing & Insurance**.

---

## 2026-08-02 — Milestone 7 (Laboratory Management) — complete

Per ADR-0011, this session's scope was Laboratory only (Radiology is its
own Milestone 8). Per the reading policy, work touched Laboratory,
Encounter (consultation-order link), Patients, and shared types — no
Radiology/Pharmacy/Billing/AI modules were touched beyond confirming the
`ai` module is still an unwired no-op scaffold.

- **Recorded ADR-0012** (three decisions in one entry, mirroring
  ADR-0008's multi-item format):
  1. Added `LabTest.encounterId String?` + `Encounter.labTests LabTest[]`
     (migration `20260801191909_lab_management`), mirroring
     `Prescription.encounterId` exactly — the pre-existing `LabTest`/
     `LabTestItem` models (from the original scaffolding commit, never
     built upon; confirmed the `laboratory` module was still the same
     3-line no-op every module is before its milestone) had no
     consultation link at all, despite "lab order creation from
     consultation" being explicit scope.
  2. New `LabTestCatalogItem` model (org-scoped: `testCode`, `testName`,
     `category`, `unit`, `referenceRangeLow`/`High` *and*
     `referenceRangeText`, optional `criticalLow`/`criticalHigh`,
     `isActive`) — supports both numeric and qualitative tests
     simultaneously rather than picking one representation.
     `LabTestItem` gained matching denormalized fields (`catalogItemId`,
     `referenceRangeLow/High`, `criticalLow/High`) populated *at order
     time* from the catalog or ad-hoc DTO fields — never re-looked-up at
     result-entry time, so a later catalog edit/deactivation can't
     retroactively change an already-ordered item's abnormal computation.
     `LabTestItem`'s original free-text fields are unchanged; ad-hoc
     (non-catalog) items still work exactly as before.
  3. `laboratory.read`/`create`/`update` are now own-scoped for the
     Doctor role (added to `OWN_SCOPE_PERMISSIONS` + the `Doctor` role
     spec in `seed.ts`, replacing the previous all-scope grants) — a
     doctor orders/views/updates only lab tests for patients they're
     treating, mirroring the `prescriptions.*` pattern exactly. Lab
     Technician and Nurse remain all-scope (unchanged) since they must
     see every order in the queue regardless of the ordering doctor.
- **Backend** (`apps/api/src/modules/laboratory/`, rebuilt from the
  3-line no-op scaffold): `LabTestsService`/`Controller` — `create`
  (derives patient/doctor from the encounter, resolves each item from
  either a catalog item or ad-hoc DTO fields, generates
  `LAB-<orgPrefix>-<year>-NNNNNN` via the same advisory-lock +
  year-counter pattern as `Prescription`/`Appointment`), `list`/`getById`
  (paginated, filterable by patient/doctor/encounter/status/priority,
  own-scope enforced), a fixed `ALLOWED_TRANSITIONS` state machine
  (`ORDERED → SAMPLE_COLLECTED → IN_PROGRESS → COMPLETED → REPORTED`,
  `CANCELLED` reachable from any non-terminal state), `collectSample`
  (dedicated action, not the generic status route — sets
  `sampleCollectedBy`/`At`), `enterResults` (structured per-item result
  entry; auto-transitions to `IN_PROGRESS`/`COMPLETED` depending on
  whether every item now has a result), `uploadReportFile` (external
  report file upload via `StorageService`, requires `COMPLETED`, sets
  `REPORTED`), `generateReportPdf` (structured, system-generated PDF via
  `pdfkit` — independent of whether an external file was ever uploaded),
  and `updateStatus` (generic `PATCH .../status`, restricted to
  `CANCELLED` only — every other transition has dedicated side effects
  and its own action). `LabCatalogService`/`Controller` — catalog
  CRUD (`GET/POST /laboratory/catalog`, `PATCH
  /laboratory/catalog/:id`), not own-scope-checked (a catalog item has
  no owning doctor).
- **Abnormal value flagging** (`abnormal-flagging.ts`, pure function,
  disclosed rule in a code comment — clinical-safety-adjacent, same
  spirit as TD-0016's drug-interaction disclosure): only a result that
  parses as a finite number is auto-flagged; qualitative results are left
  to a manual `isAbnormalOverride` and never coerced. HIGH/LOW when
  outside `[referenceRangeLow, referenceRangeHigh]`; CRITICAL_HIGH/LOW
  use explicit `criticalLow`/`criticalHigh` when the catalog/item defines
  them, else a derived threshold (normal bound extended by 20% of the
  range's width, or 20% of the bound's own magnitude for a one-sided
  range).
- **Audit integration**: `audit.listener.ts` gained
  `lab_test.ordered`/`status_changed`/`results_entered` handlers;
  `AuditService.listForDoctor`'s resource list grew to include `LabTest`
  — no capture logic duplicated (same one-line-per-checkpoint pattern as
  every prior module).
- **Tests**: `abnormal-flagging.spec.ts` (10 pure unit tests: normal/
  high/low/critical-high/critical-low, explicit-vs-derived critical
  bounds, non-numeric skip, no-range skip, one-sided range, empty
  string), `lab-catalog.service.spec.ts` (5 unit tests), `lab-tests.
  service.spec.ts` (18 unit tests: order creation from an encounter,
  order-number generation, catalog auto-population, sample collection +
  double-collection rejection, generic-status CANCELLED-only guard +
  terminal-state rejection, result entry with numeric auto-flag +
  qualitative override + unknown-item rejection + auto-completion,
  own-scope enforcement, PDF generation gating), plus
  `apps/api/test/laboratory.e2e-spec.ts` (19 e2e tests: catalog CRUD +
  duplicate-code rejection, full order lifecycle — create from an
  encounter with a catalog item → read → reject-early-results → collect
  sample → enter a genuinely abnormal numeric result (CRITICAL_HIGH) →
  download a structured PDF → upload an external report file → reject
  re-reporting, an ad-hoc qualitative item that never auto-flags,
  empty-items rejection, cancellation + invalid-transition rejection, and
  own-scope enforcement for doctors). All passing (33 new unit tests, 19
  new e2e tests — 208 unit / 121 e2e total across the whole API).
- **Frontend**: `apps/web/src/lib/api/laboratory.ts` (API client,
  including the multipart report-upload helper and a blob-download
  helper for the PDF) plus:
  - A **Lab Orders tab** on the encounter detail page — a multi-item
    order form (per-item catalog-or-ad-hoc select), a list of the
    encounter's lab orders with status-appropriate actions (Collect
    sample / Enter results / PDF download / Upload report / Cancel), and
    an inline structured result-entry form per item (result + a manual
    "mark abnormal" override for non-numeric results).
  - A **"Recent lab orders" panel** on the medical-records patient-
    timeline list page, alongside the existing prescriptions panel.
  - A new **`/dashboard/laboratory` page** — an org-wide lab order queue
    (doctor/status/priority filters, table with inline sample-collection
    and result-entry actions) plus a **"Manage catalog" dialog** (add a
    new catalog item with numeric and/or text reference range,
    activate/deactivate existing ones).
- **AI-powered lab report summarization: deferred, credential-blocked**
  (TD-0018) — confirmed no AI/LLM provider is genuinely configured
  anywhere in this repo (`.env`/`.env.example`'s `OPENAI_API_KEY`/
  `ANTHROPIC_API_KEY`/`AI_PROVIDER` are unset template placeholders read
  by no code; `apps/api/src/modules/ai/` is still the 3-file no-op
  scaffold). Every other Milestone 7 deliverable is implemented for real;
  this one is disclosed and tracked, not faked — same practice as TD-0015
  (SMS) and TD-0016 (drug interactions).
- **Full verification, all green**: `pnpm --filter @medicore/database
  db:generate` (after the schema change, applied to both `medicore_dev`/
  `medicore_test`), `pnpm lint`, `pnpm typecheck`, `pnpm test` (208 api
  unit + 6 web), `pnpm test:e2e` (121/121 across 9 suites — no flake this
  run), `pnpm build` (all 6 packages via `turbo run build --force`,
  including the new `/dashboard/laboratory` route).
- **Browser-verified end to end** (Playwright + Chromium, installed ad
  hoc into the session scratch dir per TD-0010 — `chromium-cli` itself is
  not available in this environment, so a small Node driver script using
  Playwright's own API was used instead): logged in as
  `admin@medicore.demo`, added a "Fasting Blood Sugar" catalog item
  (70–110 mg/dL) via the Manage Catalog dialog, created a real lab order
  from an existing patient's in-progress encounter referencing that
  catalog item, collected the sample, entered a result of 250 mg/dL and
  confirmed it rendered a red "Critical high" badge (matching the
  disclosed 20%-of-range derivation: 110 + 0.2×40 = 118, and 250 ≫ 118),
  and downloaded the generated report (`file` confirmed "PDF document,
  version 1.3, 1 pages"). 9 screenshots saved under `docs/screens/`
  (`lab-*.png`). Both dev servers were stale (running from before this
  session's build) and were restarted per TD-0004's addendum before the
  walkthrough.
- Since every item in `CLAUDE.md`'s Milestone Completion Checklist is
  met (backend, frontend, tests, lint/typecheck/build, docs, screenshots,
  with AI summarization explicitly and only deferred), **Milestone 7
  (Laboratory Management) is complete in a single session — no
  checkpoint split was needed.** Updated `.ai/NEXT.md`: replaced with
  **Milestone 8 — Radiology Management**.

---

## 2026-08-01 — Milestone 6, Checkpoint 6.2 (Orders & Prescriptions) — complete; **Milestone 6 fully complete** (autonomous loop iteration)

Continuation of the same-day Checkpoint 6.1 session below, picked up automatically per the standing `/loop` instruction (read `NEXT.md` → implement → verify → document → replace `NEXT.md` → continue). Per `CLAUDE.md`'s reading policy, scope stayed limited to the Prescription model, Encounter (for the FK relation), Patient, and shared types — no Laboratory/Pharmacy/Billing/Radiology/AI modules were touched.

- Recorded **ADR-0010**: reuse the pre-existing `Prescription`/`PrescriptionItem` Prisma models from the original scaffolding commit (never built upon, confirmed zero rows via `prisma.prescription.count()` before changing anything) rather than redesigning — their shape already matched the requirement. The one real change: `Prescription.status` converted from a plain `String @default("ACTIVE")` to a proper `PrescriptionStatus` enum (migration `20260801175600_prescription_status_enum`), matching the `EncounterStatus`/`AppointmentStatus` convention used everywhere else.
- **Self-caught bug, found before writing any tests** (checked `seed.ts`'s `ROLE_SPECS` while designing own-scope enforcement): the `Doctor` role was never actually granted `medical_records.update` or `prescriptions.update` at `own` scope — a real `doctor@medicore.demo` login could not transition their own encounter's or prescription's status, despite the API layer (built in Checkpoint 6.1) correctly supporting it. Not caught by e2e tests because those grant permissions directly rather than through `seed.ts`. Fixed by adding both grants to the `Doctor` role spec and the `OWN_SCOPE_PERMISSIONS` catalog array; verified the fix synced correctly via a real `pnpm db:seed` run (`syncRolePermissions` topped up the existing role with zero manual intervention).
- **Backend** (`apps/api/src/modules/prescriptions/`, rebuilt from a 3-line no-op scaffold): `PrescriptionsService`/`Controller` — `create` (derives patient/doctor from the encounter rather than trusting client-supplied IDs, generates `RX-<orgPrefix>-<year>-NNNNNN` via the same advisory-lock + year-counter pattern as `Appointment.appointmentNumber`), `list`/`getById` (paginated, filterable by patient/doctor/encounter/status), `updateStatus` (`ACTIVE` → `COMPLETED`/`DISCONTINUED`, both terminal), `generatePdf`, and `assertOwnScopeOk` (same idiom as `EncountersService`, checked against the `prescriptions` permission resource and the prescription's own `doctorId`).
- **Basic drug-interaction check** (`drug-interactions.ts`): a small bundled list of ~10 well-known interaction pairs (warfarin+aspirin, methotrexate+ibuprofen, sildenafil+nitroglycerin, etc.), matched case-insensitively across a new prescription's items *and* the patient's other currently-`ACTIVE` prescriptions. Non-blocking (returns `warnings[]` alongside the created prescription) and explicitly labeled "basic, non-exhaustive" in both the API response and the UI — no real terminology service is configured anywhere in this repo (documented as TD-0016, following the same "implement everything else, disclose what's missing" practice used for SMS in Milestone 5 and ICD-10 in Checkpoint 6.1).
- **PDF generation**: added `pdfkit` (+ `@types/pdfkit`) as a new `apps/api` dependency — no PDF library previously existed in this repo. `GET /prescriptions/:id/pdf` streams the generated buffer directly via `@Res()`/`FastifyReply`, bypassing the response-transform interceptor (the correct approach for binary output, not used elsewhere in this codebase until now).
- **Audit integration**: `audit.listener.ts` gained `prescription.created`/`prescription.status_changed` handlers; `AuditService.listForDoctor`'s resource list grew to include `Prescription` — the same one-line addition (plus its matching `audit.service.spec.ts` update) hit at every checkpoint so far.
- **Tests**: `drug-interactions.spec.ts` (8 pure unit tests) + `prescriptions.service.spec.ts` (11 unit tests: create/interaction-detection/status-transitions/own-scope/PDF) + `apps/api/test/prescriptions.e2e-spec.ts` (14 e2e tests: create with/without interaction warnings, rejecting empty items, list, get-by-id, PDF download headers, status transitions including terminal-state rejection, own-scope enforcement for read/update/create, 401 without a token). All passing (175 unit total, 102 e2e total minus one unrelated pre-existing flake — see below).
- **Frontend**: `apps/web/src/lib/api/prescriptions.ts` (API client, including a blob-download helper for the PDF) plus:
  - A **Prescriptions tab** on the encounter detail page — a multi-item prescribe form (add/remove medication rows, route select, quantity), a non-blocking interaction-warning alert, a list of the encounter's prescriptions with PDF-download and mark-completed/discontinue actions.
  - A **"Recent prescriptions" panel** on the medical-records patient-timeline list page (shown alongside the existing weight-trend chart when a patient filter is active), each linking to its originating encounter.
- **Full verification, all green**: `pnpm lint`, `pnpm typecheck`, `pnpm test` (175 api unit + 6 web), `pnpm test:e2e` (101/102 — the one failure is a **pre-existing, unrelated** time-of-day flake in `appointments.e2e-spec.ts`'s walk-in test, documented as **TD-0017**: its all-hours schedule fixture caps at 23:45 with 15-minute slots, so no bookable slot remains when the suite runs between ~23:30–23:59 local time; out of scope to fix here per the reading-policy restriction), `pnpm build` (all 6 packages).
- **Browser-verified end to end** (Playwright + Chromium in the session scratch dir, reusing the Checkpoint 6.1 encounter/patient): created a 2-item prescription (Aspirin + Warfarin) that correctly surfaced a "severe" interaction warning on-screen, created a second unrelated prescription (Cetirizine), downloaded and verified a genuine PDF (`file` confirmed "PDF document, version 1.3, 1 pages"), discontinued a prescription and watched its badge update, and confirmed the patient-timeline "Recent prescriptions" panel renders both prescriptions with correct status badges and deep-links to their encounter. 6 new screenshots under `docs/screens/`.
- Since Checkpoint 6.2 is genuinely complete per every item in `CLAUDE.md`'s Milestone Completion Checklist, and Checkpoint 6.1 was already complete, **Milestone 6 (Clinical: Medical Records) is now fully complete.** Updated `.ai/NEXT.md`: replaced with **Milestone 7 — Laboratory & Radiology**.

---

## 2026-08-01 — Milestone 6, Checkpoint 6.1 (Electronic Medical Records — EMR Foundation) — complete

Explicit instruction scoped this checkpoint to the EMR foundation only —
Encounter, Clinical Notes, Vitals, Diagnosis, Procedures, Attachments —
excluding Laboratory/Pharmacy/Billing/Radiology/AI and, within Clinical
itself, Prescriptions/Orders (deferred to Checkpoint 6.2). Per the required
"only inspect what's relevant" reading policy, work was scoped to the
Patient, Doctor, and Appointment modules, the Prisma schema, and shared
types — no unrelated modules were touched.

- Recorded **ADR-0008**: `Encounter` replaces the flat `MedicalRecord`
  scaffold (one `diagnosis: String` + one `vitalSigns: Json?` blob, no
  versioning) as the central EMR entity. Every clinical facet became its
  own child table (`ClinicalNote`, `Vital`, `Diagnosis`, `Procedure`,
  `EncounterAttachment`) rather than flat columns, because the existing
  model's *shape* — not just its missing service logic — couldn't
  represent versioned notes or multiple diagnoses/procedures per
  encounter. Confirmed via grep that nothing outside
  `patients.service.ts`'s one summary-count query touched the old
  model/field names before renaming `Prescription.medicalRecordId` →
  `encounterId` and the `Patient`/`Doctor`/`Organization` back-relations.
  New migration `20260801171211_emr_foundation`, applied to both
  `medicore_dev`/`medicore_test`.
- Recorded **ADR-0009**: Milestone 6 split into Checkpoint 6.1 (this entry)
  and 6.2 (Orders & Prescriptions, next) — the same pattern as Milestone
  4/5's checkpoint splits (ADR-0005/ADR-0006).
- **Encounter backend:** `EncountersService`/`Controller` — `create`
  (validates doctor/patient exist, optional one-to-one appointment link),
  `list`/`getById` (paginated, filterable by patient/doctor/status/type,
  own-scope enforced for `.own`-scoped doctors on *both* endpoints),
  `updateStatus` (fixed `ALLOWED_TRANSITIONS` state machine: In Progress →
  Completed → Amended → Completed). A shared `assertOwnScopeOk` helper is
  reused by every sibling controller in the module (clinical notes,
  vitals, diagnoses, procedures, attachments) so scope enforcement isn't
  duplicated per resource.
- **Clinical Notes backend:** `ClinicalNotesService.createVersion` always
  inserts `version = max + 1` — there is deliberately no update method
  exposed at the service layer, so "never overwrite historical notes" is
  enforced structurally. `GET .../clinical-notes` (full history), `GET
  .../clinical-notes/current` (latest version only), `POST` (new version).
- **Vitals backend:** `VitalsService.record` computes BMI server-side
  (`weightKg / (heightCm/100)^2`, rounded to 1 decimal) at write time;
  `listForPatient` queries cross-encounter via the `encounter` relation
  (no direct `organizationId`/`patientId` column on `Vital`) to power the
  frontend's trend chart.
- **Diagnoses/Procedures backend:** simple typed CRUD nested under each
  encounter; `Diagnosis.icdCode` is an explicit placeholder field (no
  ICD-10 terminology service configured anywhere in this repo — free-text
  entry works today, a bundled lookup list is reasonable future scope per
  ADR-0008).
- **Attachments backend:** `EncounterAttachmentsService`/`Controller`
  mirrors the existing `DoctorDocument`/`PatientDocument` pattern exactly —
  same `nanoid()`-keyed storage paths, MIME allowlist, size cap, reusing
  the global `StorageService` with zero new storage logic.
- **Audit integration:** `audit.listener.ts` gained `encounter.created`/
  `encounter.status_changed`/`clinical_note.created` handlers;
  `AuditService.listForDoctor`'s resource list grew to include `Encounter`
  — no capture logic duplicated.
- **Tests:** 6 new service spec files (30 unit tests) plus
  `medical-records.e2e-spec.ts` (21 e2e tests: encounter CRUD, clinical
  note versioning — v1→v2 without overwrite, history, current — vitals +
  BMI + patient-trend, diagnoses, procedures, attachment upload/list/
  delete, valid/invalid status transitions, own-scope enforcement, 401
  without a token). All passing (156 unit total, 88 e2e total).
- **Self-caught security fix (found while writing the e2e test, not
  reported by anyone):** `EncountersController.getById` initially had no
  own-scope enforcement at all — any `.own`-scoped doctor could read any
  encounter by ID. Fixed by applying the same `assertOwnScopeOk` check
  already used elsewhere in the module, plus a `resolveOwnScopedDoctorId`
  helper for the list endpoint (mirroring the existing
  `DoctorLeaveController` pattern). The e2e test was corrected to expect
  `403`.
- **Frontend:** `apps/web/src/lib/api/medical-records.ts` (full API
  client) plus two pages:
  - `/dashboard/medical-records` — patient timeline: patient/doctor/status
    filters, a weight-trend chart (recharts, shown when a patient filter
    has >1 weight readings), an encounters table, and a "New encounter"
    dialog (patient search-and-pick, doctor/type/notes).
  - `/dashboard/medical-records/[encounterId]` — SOAP-style tabs:
    **Subjective** (all 8 clinical-note fields, 2-second debounced
    autosave creating a new version per save, a version-history dialog);
    **Objective** (vitals form with a live BMI preview, a BMI trend chart
    across all of the patient's encounters, per-encounter vitals history,
    attachments upload/list/delete); **Assessment** (diagnoses list/add,
    type + ICD-10 placeholder); **Plan** (procedures list/add, read-only
    encounter notes); plus a header status-transition action. No debounce
    hook existed in `apps/web/src/hooks/` — used inline
    `useEffect`/`setTimeout` instead of introducing one for a single
    call site.
- **Full verification, all green:** `pnpm lint`, `pnpm typecheck`, `pnpm
  test` (156 api unit + 6 web), `pnpm test:e2e` (88/88 across 7 suites),
  `pnpm build` (all 6 packages via `turbo run build --force`).
- **Browser-verified end to end** (Playwright + Chromium in the session
  scratch dir, per TD-0010): logged in, created a real encounter for a
  real patient/doctor, filled and autosaved a clinical note (v1), opened
  version history, amended it (v2), recorded vitals (BMI computed
  correctly: 170cm/68kg → 23.5), added a diagnosis with an ICD-10
  placeholder, added a procedure, uploaded an attachment, and walked the
  encounter status from In Progress → Completed. 11 screenshots captured
  under `docs/screens/`.
- **Two stale-dev-server issues hit and fixed (TD-0004 addendum):**
  running the full verification `turbo run build --force` while `pnpm
  dev` was still running for both `apps/web` and `apps/api` clobbered
  each running process's compiled output in place (mismatched dev/prod
  React chunks on the frontend; the API kept serving its pre-build route
  table, so the brand-new `/encounters` routes 404'd). Both dev servers
  were killed and restarted after the build, which resolved it with zero
  code changes.
- Updated `.ai/NEXT.md`: replaced with **Checkpoint 6.2 — Orders &
  Prescriptions**.

---

## 2026-08-01 — Milestone 5, Checkpoint 5.2 (Queue & Recurring) — complete; **Milestone 5 fully complete**

Continuation of the same-day Checkpoint 5.1 work below. **Milestone 5
(Appointment Management) is now complete** — SMS confirmations are the one
item explicitly deferred (genuinely credential-blocked, documented rather
than faked).

- Recorded **ADR-0007**: `Appointment.isWalkIn: Boolean` (not a new
  `AppointmentType` value — a walk-in can still be OPD/emergency/etc.) and
  `Appointment.recurrenceGroupId: String?` (independent rows per
  occurrence, no rule-expansion table). New migration
  `20260731195629_appointment_walkin_recurrence`, applied to both
  `medicore_dev`/`medicore_test`.
- **Walk-in backend:** `AppointmentsService.createWalkIn` — auto-assigns
  the doctor's next available slot at/after right now, today, reusing the
  exact same conflict-checked booking path as a normal appointment
  (extracted into a shared private `bookSlot` helper that `create`,
  `createWalkIn`, and `createRecurring` all call). `POST
  /appointments/walk-in`.
- **Recurring backend:** `AppointmentsService.createRecurring` — books N
  independent occurrences sharing one `recurrenceGroupId`, each through the
  same conflict check; a conflicting occurrence is reported in a `failed[]`
  array (with reason) rather than aborting the batch or being silently
  dropped. `POST /appointments/recurring`.
- **Tests:** 4 new unit tests (16 total in the file) covering walk-in slot
  selection (via `jest.useFakeTimers` to control "now" deterministically)
  and recurring partial-failure reporting; 5 new e2e tests (17 total)
  including a dedicated all-hours/all-week doctor fixture so the walk-in
  e2e test is deterministic regardless of what day/time the suite actually
  runs. All passing (126 unit total, 67 e2e total).
- **Frontend:** a "Walk-in" quick-book dialog (patient + doctor + type +
  complaint, no time picker) and a "Recurring booking" toggle inside the
  existing booking dialog (start date/time/frequency/occurrences, replacing
  the slot picker when enabled) — both in
  `apps/web/src/app/dashboard/appointments/page.tsx`. Queue table now shows
  "Walk-in"/"Recurring" badges next to the appointment type.
- **Verification:** `pnpm lint`, `typecheck`, `test` (126 unit + 6 web),
  `test:e2e` (67/67, 6 suites), `build` (all 6 packages) — all green.
  Browser-verified: booked a walk-in for a demo doctor with an all-hours
  schedule (auto-slotted correctly relative to real "now"), booked a
  4-occurrence weekly recurring series (all 4 succeeded, confirmed via the
  "Booked 4/4 occurrences" toast and the Recurring badge in the queue). 5
  new screenshots under `docs/screens/`.
- **TD-0011's fix held up in practice**: re-ran `pnpm db:seed` for this
  checkpoint with zero manual follow-up — the permission-sync fix from the
  previous session worked exactly as intended on a second real use.
- **Reconciled `docs/roadmap.md`'s milestone-numbering mismatch** (flagged
  twice previously, TD-0009-adjacent): inserted "Milestone 5 — Appointment
  Management" as the roadmap's actual Milestone 5, renumbered the previous
  Milestones 5–13 to 6–14 (and bumped their Week labels by one
  accordingly). `NEXT.md` and `docs/roadmap.md` no longer disagree.
- Updated `.ai/NEXT.md`: replaced with **Milestone 6 — Clinical: Medical
  Records** (per the now-reconciled `docs/roadmap.md`).

---

## 2026-08-01 — Milestone 5, Checkpoint 5.1 (Appointment Core Booking) — complete

Per ADR-0006, split Milestone 5 ("Appointment Management") into Checkpoint
5.1 (this entry) and 5.2 (walk-in queue reorg, recurring appointments, SMS
— deferred). The `appointments` module was a 3-line no-op scaffold; the
`Appointment` Prisma model, `AppointmentType`/`AppointmentStatus` enums, and
most of `packages/types/src/appointment.ts` already existed unused from the
original scaffolding commit.

- **Backend:** `AppointmentsService`/`Controller` in
  `apps/api/src/modules/appointments/`:
  - `GET /appointments/available-slots` — combines the existing
    `AvailabilityService.getAvailableSlots` (schedule + leave, from
    Checkpoint 4.2) with a query for the doctor's existing non-cancelled
    appointments that day, subtracting overlaps. `AvailabilityService`
    itself was not modified — its public shape stayed stable exactly as
    its own comment (and now ADR-0006) anticipated.
  - `POST /appointments` — books an appointment, validating the requested
    time is one of the doctor's genuinely bookable slots (not just
    schedule/leave-valid but also conflict-free), generates an
    `appointmentNumber` (`APT-<orgPrefix>-<year>-NNNNNN`, same advisory-lock
    + year-counter pattern as `PatientsService.generateUhid`), emits
    `appointment.created`, and emails the patient a confirmation (reusing
    the existing `EmailService`, which degrades to console logging without
    `RESEND_API_KEY` — not credential-blocked) if they have an email on
    file.
  - `PATCH /appointments/:id/status` — validates against a fixed state
    machine (`SCHEDULED→CONFIRMED→ARRIVED→IN_CONSULTATION→COMPLETED`, with
    `CANCELLED`/`NO_SHOW` reachable from any non-terminal state; all three
    are terminal), emits `appointment.status_changed`.
  - `GET /appointments`, `GET /appointments/:id` — filterable list (date,
    doctorId, patientId, status, type) and detail with patient/doctor/
    department summaries.
  - New `appointments.update` own-scope permission for the `DOCTOR` role
    (mirrors the schedule/leave/documents own-scope pattern) — a doctor can
    transition only their own appointments.
  - `audit.listener.ts` gained 2 more `@OnEvent` handlers
    (`appointment.created`, `appointment.status_changed`), and
    `AuditService.listForDoctor` now includes `Appointment` in its
    doctorId-tagged resource list — a doctor's audit timeline (Checkpoint
    4.2) now also shows their appointment activity, with no capture logic
    duplicated.
  - Patients already saw appointments on their own timeline/audit tab
    (`PatientsService.getTimeline`) from the original scaffolding — no
    changes needed there.
- **Tests:** `appointments.service.spec.ts` (12 unit tests: conflict
  detection, slot validation, full state-machine coverage, email-on-create
  behavior) and `apps/api/test/appointments.e2e-spec.ts` (13 e2e tests:
  available slots, booking, double-booking rejection, outside-schedule
  rejection, the full status walk to completion, invalid-transition
  rejection, and own-scope enforcement). All passing.
- **Frontend:** new `apps/web/src/app/dashboard/appointments/page.tsx` — a
  day-view queue (date navigator, doctor/status filters, sortable-by-time
  table) with inline status-transition actions (primary "next step" button
  + an overflow menu for Cancel/No-show), and a booking dialog (patient
  search-and-pick, doctor/type/date/duration selection, live available-slot
  chips, chief complaint). New `apps/web/src/lib/api/appointments.ts` client.
- **Verification:** `pnpm lint`, `pnpm typecheck`, `pnpm test` (122 api unit
  + 6 web), `pnpm test:e2e` (63/63 across 6 suites), `pnpm build` (all 6
  packages) — all green. Browser-verified end to end: booked a real
  appointment for a real patient against a real doctor's real schedule,
  watched the available-slots grid update live, walked the appointment
  through Scheduled → Confirmed → Arrived. 5 screenshots saved under
  `docs/screens/` (`appointments-empty`, `appointments-booking-dialog`,
  `appointments-booking-slots`, `appointments-queue`,
  `appointments-status-transitions`).
- **Known limitation, not blocking:** booking has no DB-level exclusion
  constraint against a race between two concurrent requests for the same
  slot — the conflict check is app-level (same class of limitation as
  `DoctorLeaveService`'s pre-existing overlap check). Acceptable for this
  checkpoint; noted as TD-0012.
- Continued the TD-0011 workaround: re-ran `pnpm db:seed` (idempotent
  catalog upsert, added the new `appointments.update.own` permission row)
  then re-applied the same manual `RolePermission` sync used in the
  previous session to `medicore_dev`'s `Hospital Admin`/`Doctor` roles.
- Updated `.ai/NEXT.md`: replaced with Checkpoint 5.2.

---

## 2026-07-31 — Milestone 4, Checkpoint 4.2 (Doctor Scheduling) — complete

Continuation of the same-day audit below: implemented the 3 deliverables
that audit found missing (doctor documents, audit-timeline query surface,
frontend), then fully verified and browser-tested. **Milestone 4 is now
complete.**

- **Doctor documents (backend):** `DoctorDocumentType` enum + `DoctorDocument`
  Prisma model (migration `20260731152146_doctor_documents`, applied to
  both `medicore_dev`/`medicore_test`), `packages/types/src/doctor-document.ts`,
  `doctor-document.service.ts`/`.controller.ts` in
  `apps/api/src/modules/scheduling/` (`GET/POST /doctors/:doctorId/documents`,
  `DELETE .../documents/:documentId`), reusing the existing global
  `StorageService` exactly like the `patients` module's `PatientDocument`
  pattern. New `doctors.documents` permission resource (`read`/`manage`,
  `all`+`own` scope) added to `seed.ts`.
- **Doctor audit timeline (backend):** `AuditService.listForDoctor()` —
  reuses the existing `AuditLog` table/service, no duplicated capture logic
  — plus `GET /doctors/:id/audit-timeline` on the existing
  `DoctorsController` (own/all-scope enforced the same way as the
  scheduling controllers). `audit.listener.ts` gained 2 more `@OnEvent`
  handlers (document upload/delete), mirroring the existing schedule/leave
  handlers. `packages/types/src/doctor-audit-timeline.ts` added.
- **Backend tests:** `doctor-document.service.spec.ts` (9 tests),
  `audit.service.spec.ts` (3 tests, new file), `apps/api/test/doctor-documents.e2e-spec.ts`
  (12 e2e tests: documents CRUD, own-scope enforcement, and audit-timeline
  correctness across all 3 event sources). All passing.
- **Frontend:** added 5 tabs to `apps/web/src/app/dashboard/doctors/[id]/page.tsx`
  — Schedule (read-only current-schedule grid + version history +
  new-version dialog with a full 7-day/shifts/breaks editor matching
  `ScheduleDaySchema`/`ScheduleShiftSchema`), Leave (list + apply +
  approve/reject with decision note + cancel), Availability (today status +
  date-based bookable-slot lookup), Documents (near-verbatim port of the
  patients module's `DocumentsTab`), Audit (near-verbatim port of the
  patients module's `TimelineTab`). New API client
  `apps/web/src/lib/api/scheduling.ts`. No new frontend test scaffolding was
  added — the `patients` module (the reuse template) has none either;
  verification was `lint`/`typecheck`/`build` plus a manual browser
  walkthrough (below), stated explicitly rather than silently skipped.
- **Full verification, all green:** `pnpm lint`, `pnpm typecheck`, `pnpm test`
  (110 api unit + 6 web), `pnpm test:e2e` (50/50 across 5 suites), `pnpm build`
  (all 6 packages via `turbo run build --force`).
- **Manual browser verification:** installed Playwright + Chromium into the
  session scratch directory (not a project dependency — see TD-0010),
  started both dev servers, logged in as `admin@medicore.demo`, and drove
  the full golden path for real: created a schedule version (Mon–Fri,
  09:00–17:00, 30-min slots), applied and approved a leave request, checked
  bookable availability slots, uploaded a document, and confirmed all of it
  appeared correctly in the audit timeline. 9 screenshots captured under
  `docs/screens/` (doctors list, registration form, and all 5 new tabs
  including the new-schedule-version dialog).
- **Real bug discovered and fixed (data only, not code) during browser
  verification:** `medicore_dev`'s `Hospital Admin` and `Doctor` roles
  predated the `doctors`/`doctors.schedule`/`doctors.leave`/
  `doctors.documents` permission resources and had never been backfilled,
  because `seed.ts`'s `role.upsert` no-ops (`update: {}`) for a role that
  already exists — recorded as **TD-0011 (High)**, a real latent bug in
  `seed.ts` itself (out of scope to fix this session; affects any existing
  local dev DB, not `medicore_test` since e2e suites always create a fresh
  org).
- **Real bug discovered and fixed during browser verification:** a
  long-running `nest start --watch` process served a stale route table —
  the new `GET /doctors/:id/audit-timeline` endpoint 404'd at the Fastify
  router level despite being correctly implemented and fully test-covered;
  restarting the dev server fixed it with zero code changes (TD-0004
  addendum).
- Resolved TD-0003 (Checkpoint 4.1 screenshots), TD-0005 (doctor documents),
  TD-0006 (audit-timeline query surface), TD-0007 (no frontend).
- Updated `.ai/NEXT.md`: replaced with **Milestone 5 — Appointment
  Management**, since Milestone 4 (both checkpoints) is now genuinely
  complete per every item in `CLAUDE.md`'s Milestone Completion Checklist.

---

## 2026-07-31 — Milestone 4, Checkpoint 4.2 (Doctor Scheduling) audited — partially complete

- Session started by discovering, via `git status`, undocumented in-progress
  work: `apps/api/src/modules/scheduling/` (schedule/leave/availability
  controllers+services+DTOs), `apps/api/test/scheduling.e2e-spec.ts`, two
  new Prisma migrations (`20260731090000_provider_scheduling`,
  `20260731091500_doctor_schedule_unique_effective_from`), and three new
  shared-types files (`doctor-schedule.ts`, `doctor-leave.ts`,
  `doctor-availability.ts`) — none recorded in `.ai/`. Per `CLAUDE.md`'s
  "code is ground truth" rule, audited this code against Checkpoint 4.2's
  requirement list (ADR-0005) instead of restarting or re-asking scope.
- **Verified complete (backend):**
  - Weekly schedules: `DoctorSchedule`/`DoctorScheduleDay` models, versioned
    by `effectiveFrom` (unique per doctor), Zod-validated shifts/breaks,
    full CRUD (`doctor-schedule.controller.ts`/`.service.ts`).
  - Leave management: `DoctorLeave` model, apply/approve/reject/cancel/list
    /upcoming, overlap-conflict detection on apply
    (`doctor-leave.controller.ts`/`.service.ts`).
  - Availability engine: `AvailabilityService` derives bookable slots and
    today-status from the effective schedule + approved-leave overlay;
    deliberately doesn't know about `Appointment` records yet (that's
    Milestone 5's job per an in-code comment referencing "ADR-0006", which
    does not yet exist in `DECISIONS.md` — flagged in `TECH_DEBT.md` TD-0009).
  - Dashboard availability stats: `AvailabilityService.getDashboardStats`
    wired into `DoctorsService.getDashboardStats`, extending
    `DoctorDashboardStats` with `availableToday`/`onLeaveToday`
    /`offDutyToday`/`upcomingLeave`.
  - Audit event *capture*: `audit.listener.ts` gained 6 new `@OnEvent`
    handlers for schedule/leave lifecycle events.
  - Own-scope permission enforcement on every route (doctor can only touch
    their own schedule/leave/availability under an `.own`-scoped role).
- **Verified partially complete:**
  - Audit timeline: capture exists (above), but there is no per-doctor query
    surface — `AuditController` only exposes `GET /audit-logs?limit=`
    (org-wide, no `doctorId`/`resource` filter). Not actually viewable yet.
- **Verified missing (not started):**
  - Doctor documents (upload/list/delete certificates/ID proofs) — no
    `DoctorDocument` model, migration, service, or controller exists.
  - Frontend — zero UI for schedule/leave/availability/documents; the
    doctor profile page is unchanged from Checkpoint 4.1.
  - Screenshot — not applicable yet (no UI to capture).
- **Verification run this session** (all passing):
  - `pnpm lint`: initially failed with 1029 errors across unrelated files
    (`users.service.ts`, `prisma.service.ts`, etc.) because the Prisma
    client had never been generated after the schema changes — every
    Prisma-typed call read as `any`/`error` to ESLint. Ran
    `pnpm --filter @medicore/database db:generate`; lint went clean.
    Recorded as TD-0008 (this will recur for the next session too).
  - `pnpm typecheck`: clean (api + web).
  - `pnpm test`: 101 api unit tests + 6 web tests, all passing (includes
    `availability.service.spec.ts`, `availability.util.spec.ts`,
    `doctor-leave.service.spec.ts`, `doctor-schedule.service.spec.ts`).
  - `pnpm test:e2e`: applied the 2 new migrations to `medicore_test` (both
    were already deployed — no drift this time, unlike Checkpoint 4.1's
    session); all 4 e2e suites pass, 38/38 tests including the new
    20-test `scheduling.e2e-spec.ts`.
  - `pnpm build`: api + web build cleanly (used `turbo run build --force`
    to get full unbuffered output across all 6 packages — `pnpm build`
    piped through `tail` was truncating multi-package turbo output).
- Updated `.ai/NEXT.md` to list only the 3 remaining deliverables (doctor
  documents, audit-timeline query surface, full frontend) plus their tests
  and screenshot — **not** replaced with Milestone 5, since Checkpoint 4.2
  is not complete per `CLAUDE.md`'s Milestone Completion Checklist
  (frontend implemented is a required item).
- Added TD-0005 through TD-0009 to `TECH_DEBT.md` for the gaps above plus
  the Prisma-client-generation trap and the dangling ADR-0006 reference.

---

## 2026-07-31 — Milestone 4, Checkpoint 4.1 (Doctor Management) verified and closed out

- Found, on session start, that a prior session had already built most of
  Doctor Management (`apps/api/src/modules/doctors/`, the generic
  `StaffOnboardingService` at `apps/api/src/common/onboarding/`, a Prisma
  migration adding doctor professional-profile fields, and frontend pages
  under `apps/web/src/app/dashboard/doctors/`) without ever recording it in
  `.ai/` — the code was ground truth, so this session audited it against the
  Checkpoint 4.1 requirement list instead of re-implementing anything.
- Verified against the checklist: Doctor CRUD, professional profile, linked
  user onboarding, search, filters, dashboard stats, doctor profile page,
  unit tests, and e2e tests were all already implemented and wired
  end-to-end (permissions seeded for `doctors.*`, module registered in
  `app.module.ts`, frontend pages linked from the sidebar).
- Ran full verification and fixed everything it turned up:
  - `pnpm lint` (api + web): 2 real violations fixed — an import-order error
    in `doctors.controller.ts` and an unescaped-apostrophe JSX error in the
    doctor detail page.
  - `pnpm typecheck` (api + web): clean, no changes needed.
  - `pnpm test` (api + web): 76 unit tests passed, no changes needed.
  - `pnpm test:e2e`: required first-time local environment setup (`apps/api/.env`
    generated from `.env.example`, JWT RSA keypair via
    `pnpm keys:generate`, pointed at the already-running `medicore-postgres`/
    `medicore-redis` dev containers on their mapped ports 5434/6381). Found
    two real issues once the suite could run: the `medicore_test` database
    was missing the `20260730220227_doctor_professional_profile` migration
    (applied it — this was a stale test DB, not an app bug), and
    `doctors.e2e-spec.ts` had one assertion expecting `201` from
    `POST /auth/login` where the endpoint correctly returns `200` (fixed the
    test). All 14 e2e tests pass after both fixes.
  - `pnpm build`: all packages build cleanly.
- Wrote `docs/modules/04-doctor-management.md` (backend/frontend surface,
  onboarding flow, deferred-to-4.2 list).
- Updated `docs/roadmap.md`: Milestone 4 retitled and split into Checkpoint
  4.1 (marked complete) / 4.2 (not started); original appointment-booking
  deliverables moved to a "Deferred beyond Milestone 4" section.
- Recorded ADR-0005 in `DECISIONS.md` for the Milestone-4 scope split and
  the decision to keep `StaffOnboardingService` generic across staff roles.
- **Not done, by explicit instruction:** Checkpoint 4.2 (doctor scheduling)
  is intentionally not started this session.
- **Not done, environment limitation:** no screenshot saved under
  `docs/screens/` — this session has no browser/UI access, only CLI +
  API-level (e2e) verification. A future session with browser access should
  capture the doctors list, registration form, and profile page.

---

## 2026-07-31 — Project governance scaffolding

- Created `CLAUDE.md` at repo root as the standing project constitution.
- Created `.ai/` project memory directory with all required files
  (`PROJECT_CONTEXT.md`, `PROGRESS.md`, `NEXT.md`, `DECISIONS.md`,
  `TECH_DEBT.md`, `SESSION_LOG.md`, `MODULE_STATUS.md`, `CHANGELOG.md`).
- No application code changed in this task.

---

## Prior History (pre-`.ai/`, reconstructed from repo state)

- Monorepo initialized (pnpm + turbo) with `apps/api` (NestJS) and
  `apps/web` (Next.js), plus shared `packages/` (config, database, types, ui).
- Backend module directories scaffolded for the full domain surface: auth,
  users, roles, organizations, hospitals, departments, staff, patients,
  appointments, medical-records, prescriptions, laboratory, radiology,
  pharmacy, inventory, billing, insurance, notifications, audit, ai, health.
- Common infra added: JWT auth guard, permissions guard + service, CSRF
  guard, audit listener/service, email module, Redis module.
- This was committed as a single large init commit
  (`56857d3 init: setup of the mono-repo done for hospital management system`)
  before `.ai/` tracking existed — module-level implementation depth has not
  yet been individually verified. First session using this file should audit
  each module and populate `MODULE_STATUS.md` accurately rather than trusting
  directory existence as a proxy for completeness.

---

## Milestone 16 — Platform & Multi-Tenant Administration: Complete

Completed in a single session (2026-08-05), all five checkpoints. The
session's explicit instruction redefined Milestone 16 from `docs/roadmap.md`'s
"Reports & Analytics" to Platform & Multi-Tenant Administration — see
**ADR-0025** for that decision and every design call below.

### The audit that opened the session

The instruction was to audit before building, treating code as the source of
truth. That audit found the hierarchy already half-built, which materially
changed what got written:

- `Organization → Hospital → Department → User → Patient` all existed, and
  every service already filtered by a JWT-supplied `orgId`. **Tenant
  isolation was never the gap** — Checkpoint 16.3 therefore added no new
  resolution mechanism, only a named shape for the three levels plus one new
  `isPlatform` claim.
- `seed.ts` already created a `medicore-platform` organization holding a
  SUPER_ADMIN user — it simply had no way to see past its own empty tenant.
- `Organization` already carried address/tax/logo/`settings`/
  `subscriptionTier`; `hospitals` already had CRUD; `AuditService`,
  `StorageService`, `PermissionsService`, `RedisService`,
  `StaffOnboardingService` and the `Holiday` model were all reusable as-is.

The genuine gaps were: no cross-tenant operation, no tenant lifecycle beyond
a boolean, no subscription concept, no usage metering, and no audit
filtering/pagination.

### Checkpoint 16.1 — Organization Management

- **Organization profile** — `GET/PATCH /organizations/me` extended with
  `country`/`taxId`/`type`, now audited with before/after snapshots.
- **Branding + logo** — new `Organization.branding` JSON column (deliberately
  separate from `settings`, which clinical modules read without a fallback);
  logo upload/removal reuses `StorageService` exactly as every document
  feature does, with the previous object deleted only after the new URL
  commits.
- **Settings** — merge-not-replace semantics, so a partially-populated form
  can never drop `uhidPrefix`/`gstRate`/`defaultAppointmentDuration`.
- **Organization administrators** — not a new entity: users holding an
  ORG_ADMIN/SUPER_ADMIN role through the existing `UserRole` table.
- **Hospital onboarding wizard** — one transactional
  `POST /hospitals/onboard` creating the hospital, its departments, and
  optionally its administrator via the existing generic
  `StaffOnboardingService`; the welcome email is sent only after commit.
- **Hospital activation** — `POST /hospitals/:id/activate` added alongside
  the pre-existing deactivate. Deactivation stays deliberately
  non-cascading (matching TD-0031's ward/room precedent).
- **Organization statistics + usage** — real counts across hospitals, users,
  departments, patients, doctors, staff, 30-day appointments/admissions,
  plus storage/API/AI usage.
- **Organization-level audit logs** — `AuditService` gained filtered,
  paginated `list()` plus a `listFilterOptions()` that derives the filter
  dropdowns from the trail itself rather than a hardcoded list.
- **Frontend** — `/dashboard/organization` with all eight required tabs
  (Overview, Hospitals, Users, Subscription, Usage, Branding, Settings,
  Audit Logs) and a 3-step onboarding wizard. New permission-gated sidebar
  item.

### Checkpoint 16.2 — Platform Owner Console

- **`Organization.isPlatform`** marks the single platform tenant. `seed.ts`
  sets it *and* back-fills it on an already-seeded database, since its
  `upsert(..., update: {})` would otherwise leave the console locked.
- **Isolation is gated twice, deliberately.** `PlatformGuard` requires the
  caller's organization to be the platform tenant; every handler
  additionally requires a `platform.*` permission. Org admins are excluded
  from that family in both `seed.ts` and
  `RolesService.createDefaultOrgAdminRole`, and `JwtStrategy.validate`
  re-checks `isPlatform` against the database on every request rather than
  trusting the token for its full lifetime. **An e2e test asserts that
  granting a tenant admin every `platform.*` permission still yields 403.**
- **Tenant lifecycle** — suspend (with a required reason), reinstate, and a
  separate enable/disable switch. Suspension sets the pre-existing
  `Organization.isActive`, which `JwtStrategy`/`AuthService` already
  enforce — so it takes effect on the next request with **no auth-code
  change at all**. `enable` refuses to lift a suspension so its reason is
  never silently lost, and the platform tenant cannot suspend itself.
- **Subscriptions** — new `Subscription` model (one per org), plan + status
  + four nullable limits + price. Read by the tenant, written only by the
  platform owner (`billing.manage`'s requester/approver precedent).
  `Organization.subscriptionTier`/`subscriptionExpiresAt` are kept in sync
  in the same transaction, and `getSummary` falls back to them for
  organizations created before this milestone.
- **Usage metering** — `ApiUsageService` (Redis counters, rolling 30-day
  window, fire-and-forget interceptor) and `StorageUsageService` (sums the
  `fileSizeBytes` column across the five models that carry one). **AI usage
  is reported for real** from the `AiUsageLog` rows Checkpoint 15.1 already
  writes, rather than the placeholder the brief permitted.
- **Global audit log, global search, platform analytics** — cross-tenant
  reads; search deliberately covers organizations/hospitals/users only and
  never patients or clinical records.
- **Frontend** — an isolated `/platform` route group with its own layout,
  sidebar and header. It shares no chrome with the tenant dashboard, and a
  non-platform user is redirected away (a courtesy; the API is the real
  boundary). Five pages: Overview, Organizations, Hospitals, Audit log,
  Search.

### Checkpoint 16.3 — Tenant Resolution

Audited first, extended rather than duplicated. `orgId`/`orgSlug`/
`hospitalIds` already travelled on every JWT and were verified per request;
`resolveTenantContext` + `@Tenant()` only give the three levels
(Platform / Organization / Hospital) one named shape. `@CurrentUser('orgId')`
remains correct and untouched in ~30 existing controllers. The single new
claim is `isPlatform`, which **fails closed** — a token minted before this
milestone resolves to `false`.

### Checkpoint 16.4 — Organization Settings

Branding, theme, logo, address, tax details, contact details, timezone,
currency, language, working hours, feature flags — and **holidays reusing
Milestone 14's `Holiday` model and API** rather than a second calendar.
Working-hours validation rejects an end time at or before the start time;
brand colours are hex-validated.

### Verification (Checkpoint 16.5)

- `pnpm lint` — clean across all 5 packages
- `pnpm typecheck` — clean across all 5 packages
- `pnpm test` — **615 API unit tests** (49 new) + 6 web, all passing
- `pnpm test:e2e` — **335 e2e tests across 19 suites** (36 new), all passing
- `pnpm build` — clean; web compiled 68 static pages

One pre-existing test-data bug was found and fixed along the way:
`doctor-documents.e2e-spec.ts` upserted `doctors.read.all` but granted its
Doctor role `doctors.read.own`, so it passed only against a database that
happened to have been seeded beforehand. Made self-sufficient.

### Deferred, disclosed, not faked

- **No browser verification** this session — explicit instruction, mirroring
  TD-0035/TD-0036 (**TD-0044**).
- The platform **organization detail page** is not built, though its two
  endpoints are (**TD-0045**).
- API metering is a **rolling Redis window, not a durable ledger** — stated
  in the UI, and must not be used for billing as-is (**TD-0046**).
- Storage usage measures **recorded file sizes, not bucket contents**
  (**TD-0047**).
- **No payment gateway exists**, and subscription limits are **reported but
  not enforced** — both stated in-page rather than implied (**TD-0048**).
- Global search **excludes patients and clinical records** by design
  (**TD-0049**).
- Platform access is revocable at organization, not per-user, granularity
  (**TD-0050**).

---

## Milestone 19 — Production Hardening & Enterprise Readiness: Complete

**Date:** 2026-08-06 — all seven checkpoints in one session.
**ADRs:** ADR-0028 (security + deployment), ADR-0029 (observability),
ADR-0030 (performance + background processing).
**Instruction:** audit first, code is the source of truth, reuse existing
services, do not rebuild existing functionality, add **no new HMS features**.
AI development (Milestone 15.2–15.5) remained paused and untouched.

### The audit changed the work, twice

**Security was better than `NEXT.md` implied.** Every DTO already validates
through a shared Zod schema behind a global pipe; RBAC is namespaced and
own/all-scoped; the CSRF guard is a double-submit cookie applied to exactly the
cookie-authenticated routes and nowhere else; per-account login lockout already
existed; tenant isolation is re-verified against the database on every request.
None of it was rebuilt.

**Performance was better still, and that is the finding.**
`AvailabilityService.getDashboardStats` and
`NotificationsService.resolveRecipients` — the two shapes most likely to be
N+1s — already batch with `{ in: [...] }` and resolve in memory. 205 indexes
across 113 models cover the hot filters, including the notification queue's
`(status, nextAttemptAt)` claim. **No schema change was made.** Adding
cosmetic indexes carries migration cost and buys nothing measurable.

### 19.1 — Security hardening

- **`@fastify/helmet`** with a CSP written for an API: `default-src 'none'`,
  relaxed for inline script/style **only when Swagger is mounted** — so
  `SWAGGER_ENABLED=false` (the production default) tightens the policy rather
  than hiding a page. HSTS in production only; `frameguard: deny`;
  `crossOriginResourcePolicy: same-site` so an uploaded clinical document
  cannot be embedded from another origin. Static uploads now also carry
  `Content-Disposition: attachment`.
- **`CORS_ORIGINS`** accepts a comma-separated list (falling back to
  `FRONTEND_URL`, so existing deployments are unaffected), exposes
  `X-Request-ID`/`traceparent`, and refuses `*`.
- **Startup environment validation** (`config/env.validation.ts`) wired into
  `ConfigModule.forRoot({ validate })`. **Errors abort the boot** and are
  reserved for the unsafe rather than the unset — the shipped default cookie
  secret, a missing RS256 keypair, a wildcard CORS origin, no Redis.
  **Warnings never abort** and cover choices that should have been conscious: a
  log-only SMS driver, an `http://` origin, container-local document storage,
  AI enabled against a third-party provider without a BAA (TD-0042). Every
  production-only rule is skipped outside `NODE_ENV=production`.
- **Per-endpoint throttling.** One `default` throttler overridden per route with
  `@Throttle(authThrottle())` on the seven credential endpoints — *not* a second
  named tier, because every configured throttler runs on every route. The auth
  limit is **20/minute, not 5**: the throttler keys on `request.ip` and a
  hospital LAN presents one NAT address, so the precise defence stays the
  existing per-account lockout.
- **`TRUST_PROXY`**, off by default. Trusting `X-Forwarded-For` while directly
  exposed would let any caller spoof `request.ip` — and with it per-IP rate
  limiting and the address on every audit row.
- **CSRF guard**: constant-time comparison, and a duplicated header (which
  arrives as an array) now produces a clear 403 rather than a confusing one.

### 19.2 — Performance & caching

- **`CacheService`** over the existing Redis connection. Read-through `wrap`,
  exact `del`, and `invalidatePrefix` using **`SCAN`, never `KEYS`** — `KEYS`
  blocks the single-threaded server, so on a shared instance it is an outage for
  every tenant triggered by one admin saving a form. Keys are structurally
  tenant-scoped (`key()` throws without an organization id) and Redis being down
  is a cache miss, never an error.
- **Applied to notification template resolution**, which runs once per channel
  per notification and changes only when an administrator publishes or rolls
  back a version — invalidation is exact, not a guessed TTL.
- **`JwtStrategy`'s per-request lookup was deliberately not cached.** It is the
  most frequent query in the system, and it is also what makes suspending a
  tenant take effect on the very next request (ADR-0025).
- **Slow-query logging** in `PrismaService` above `DB_SLOW_QUERY_MS`
  (default 300, **0 under test**), carrying the request id that caused it.
  Parameterised SQL only — never the bound values, which are patient
  identifiers and clinical codes.

### 19.3 — Background processing

- **`BackgroundTaskService`** — deliberately *not* a second queue. Durable,
  retried delivery already exists in `notification_deliveries` (ADR-0027); this
  is for genuinely fire-and-forget work. Over the bare `void promise` it
  replaces it adds: rejection logged **with the scheduling request's
  correlation ids**, a `medicore_background_runs_total{job,outcome}` counter,
  and a drain awaited during graceful shutdown.
- **Six blocking email sends moved off the request path** — auth verification
  and password reset, user invitation, staff/doctor onboarding, appointment
  confirmation. Registration could previously 500 because of a mail provider,
  for an account that had in fact been created. The appointment send swallowed
  every failure with `.catch(() => undefined)`; it is now logged and counted.
- The notification worker's tick is now counted too, so a worker failing every
  tick shows up as a ratio rather than a quiet log line.

### 19.4 — Observability

- **`AsyncLocalStorage` request context** — `requestId`, `traceId`, `spanId`,
  and (once authenticated) `userId`/`organizationId`, reachable from any service
  without threading a context argument through thirty modules. A request-scoped
  provider would have forced its whole injection chain to be request-scoped too.
- **One derivation rule for the request id**, shared by the Fastify adapter,
  pino and the middleware, so the access log, every service log line and the
  `X-Request-ID` response header always quote the same string. A caller-supplied
  id wins — after validation, because it reaches log lines.
- **W3C `traceparent`** parsed, continued, minted when absent, echoed back.
- **`HttpExceptionFilter` fixed**: it previously echoed the raw inbound header
  or minted a *fresh* `nanoid`, so the id in a user's error matched nothing in
  the logs.
- **Log redaction** for `authorization`, `cookie`, `x-csrf-token` and
  `set-cookie`.
- **`/api/health`, `/api/health/live`, `/api/health/ready`** — version-neutral
  *and* at `/api/v1/health`. Liveness checks **nothing external** by design: a
  Postgres blip must not make an orchestrator restart every API pod. This also
  fixed a real defect — the container `HEALTHCHECK` polled `/api/health`, which
  did not exist.
- **`/api/metrics`** (`prom-client`, private registry): HTTP counter/histogram/
  in-flight gauge, dependency gauge, background-run counter, plus process, heap,
  GC and event-loop-lag series. Bearer-authenticated via `METRICS_TOKEN`,
  **404 in production when unset** (an unauthenticated scrape target should not
  confirm it exists), and throttle-exempt.
- **No metric carries an identifier label.** Routes are labelled by matched
  *pattern*, never URL — one time series per patient id would be both a
  cardinality explosion and a leak of record identifiers into monitoring.
- **No OpenTelemetry SDK** — propagation and correlation only, recorded honestly
  as TD-0069 rather than half-installed.

### 19.5 — Deployment & operations

- **`docker-compose.prod.yml` could not start.** `api` declared
  `depends_on: [postgres, redis]` against services the file never defined. Both
  are now defined (no published ports, healthchecked, Redis with AOF because it
  holds live sessions), `api`/`web` are `expose`-only behind nginx, every
  service has log rotation, required variables use `${VAR:?message}` so a
  missing secret fails at `compose config` rather than at runtime, and
  `stop_grace_period` exceeds the drain window.
- **Graceful shutdown** in `main.ts`: readiness → 503 immediately, serve for
  `SHUTDOWN_DRAIN_MS`, await in-flight background work, then `app.close()`.
  A second signal exits at once.
- **nginx**: the HTTPS server block is now real — certificates were already
  mounted and 443 was already published, but **nothing listened on it**.
  Added HSTS/CSP-adjacent headers with `always` (so they appear on error
  responses too), `X-Request-ID` generation and pass-through, `server_tokens
  off`, body-size and timeout limits, a `/api/metrics` private-network ACL,
  probe paths exempt from rate limiting, and `/healthz` instead of `/health` so
  it cannot shadow an application route. Validated with `nginx -t`.
- **API Dockerfile**: runs unprivileged as uid 1001 (matching the web image),
  healthcheck repointed at `/api/health/live`.

### 19.6 — CI/CD

`build` now `needs` the test jobs — previously it needed only lint/typecheck, so
a green "Build" could sit beside a failing suite and read as a passing pipeline.
Added a single `CI` gate job to require in branch protection, and
`METRICS_TOKEN` to the e2e environment. `pnpm format:check` was **not** added:
it has never worked in this repository (TD-0072), and adding a check that fails
is worse than not having it.

### 19.7 — Documentation

`docs/operations/`: **Deployment Guide**, **Operations Guide**, **Monitoring
Guide**, **Disaster Recovery**, **Runbook**, **Production Checklist**, and an
annotated `production.env.example`.

### Verification

All five gates pass, run from the repository root:

| Gate | Result |
|---|---|
| `pnpm lint` | clean, 5 packages |
| `pnpm typecheck` | clean, 5 packages |
| `pnpm test` | **785 API unit tests** (was 727) + 6 web, 96 suites |
| `pnpm test:e2e` | **431 e2e tests across 22 suites** (was 408 / 21) |
| `pnpm build` | clean, 4 packages |

New tests: 58 unit (env validation, trace context, cache, background tasks,
health) and 23 e2e in `test/production-hardening.e2e-spec.ts` — which boots
through `src/bootstrap.ts`, the same functions `main.ts` calls, because a
security header asserted against a hand-rolled test app proves nothing about
what ships.

No browser verification and no screenshots — per instruction, and there is no
new user-facing UI in this milestone.

### Deferred, disclosed, not faked

**Three roadmap line items were deliberately not built (TD-0073)**, and
`docs/roadmap.md` now says so with reasons rather than quietly ticking them:
**Sentry** (no DSN exists here; adding the SDK with a placeholder would report
nowhere — structured logs with `requestId`/`traceId` plus a 5xx alert rule are
the substitute), **k6 load testing** (a load test against a laptop's Docker
Postgres measures the laptop; the instrumentation to run one meaningfully now
exists), and **Kubernetes manifests** (explicitly optional; the
liveness/readiness split and graceful shutdown a Deployment needs are in place,
but TD-0067 must be fixed before `replicas > 1`).

**TD-0067** rate limiting is per-process (matters only with replicas);
**TD-0068** every instance runs the notification worker (wasteful, not
incorrect); **TD-0069** trace propagation without an OTel SDK; **TD-0070**
**there is no backup automation — the DR procedure is specified, not
implemented**, and this is the highest-severity gap in the milestone;
**TD-0071** a second instance may serve a stale notification template for up to
300s; **TD-0072** `pnpm format` has never worked.
