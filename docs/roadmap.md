# MediCore Development Roadmap

---

## Milestone 1 - Foundation & Infrastructure (Week 1–2)

**Goal:** Production-ready project skeleton. Every developer can clone, run `pnpm install && docker-compose up && pnpm dev`, and have a working system.

### Deliverables
- [ ] Monorepo setup (Turborepo + pnpm workspaces)
- [ ] Root tooling: ESLint, Prettier, EditorConfig, commitlint, Husky
- [ ] `packages/config` - shared TypeScript and ESLint configs
- [ ] `packages/types` - shared TypeScript interfaces
- [ ] `packages/database` - Prisma schema, client export
- [ ] `apps/api` - NestJS project with all modules scaffolded (empty)
- [ ] `apps/web` - Next.js 14 project with App Router, Tailwind, shadcn
- [ ] Docker Compose for local: PostgreSQL, Redis, MailHog
- [ ] GitHub Actions CI: lint, typecheck, test on PR
- [ ] Environment configuration strategy
- [ ] Database baseline migration
- [ ] API health check endpoint
- [ ] Frontend base layout (sidebar, header, theme)

---

## Milestone 2 - Authentication & Organization Setup (Week 3)

**Goal:** Complete auth system with multi-tenancy, RBAC, and organization management.

### Deliverables
- [x] Organization registration (onboarding flow) - `POST /auth/register`
- [x] User registration and email verification - admin-created users + self-registered org admins, Redis-backed verification tokens
- [x] Login / logout - Argon2, RS256 JWT, HttpOnly refresh cookie, CSRF
- [x] JWT + refresh token implementation - rotation with reuse (theft) detection
- [x] RBAC: roles and permissions seeded - DB-driven, `packages/database/prisma/seed.ts`
- [x] Password reset flow
- [x] Session management (active sessions list) - `GET /auth/sessions`, `POST /auth/logout(-all)`
- [x] Audit log middleware (auto-capture on mutations) - event-listener based (`modules/audit`), not an HTTP interceptor
- [x] Frontend: login page, forgot password, email verification
- [ ] Frontend: org settings page - backend (`GET/PATCH /organizations/me`) implemented; no frontend page yet
- [ ] Frontend: user management page (admin) - backend (`modules/users`) implemented; no frontend page yet
- [ ] Role assignment UI - backend (`modules/roles`, assign/revoke endpoints) implemented; no frontend UI yet

Also delivered beyond the original scope: `Hospital` entity (Organization → Hospital → Department hierarchy), hospital-scoped role assignments (`UserRole.hospitalId`), account lockout, `Hospitals`/`Departments` REST modules, and a `/health` endpoint.

---

## Milestone 3 - Patient Management (Week 4)

**Goal:** Complete patient registration and management module.

### Deliverables
- [ ] Patient CRUD with UHID generation
- [ ] Patient search (name, UHID, phone - full-text + fuzzy)
- [ ] Patient profile page with timeline
- [ ] Document upload (Aadhaar, insurance card, old reports)
- [ ] Emergency contacts
- [ ] Family linkage (head of family → members)
- [ ] Patient merge (duplicate detection)
- [ ] Import patients from CSV
- [ ] Frontend: patient list table with filters
- [ ] Frontend: patient registration form
- [ ] Frontend: patient detail page

---

## Milestone 4 - Doctor Management & Scheduling (Week 5)

**Goal:** Doctor directory/profile management, then doctor-side scheduling.
Split into two checkpoints (see ADR-0005) to keep each session's scope
tight; appointment *booking* itself (patient-facing slot booking, queue,
status machine) is deferred to a later milestone.

### Checkpoint 4.1 - Doctor Management - ✅ Complete
- [x] Doctor CRUD
- [x] Professional profile
- [x] Linked user onboarding (`StaffOnboardingService`, reused across staff roles)
- [x] Search
- [x] Filters
- [x] Dashboard (total/active doctor stats)
- [x] Doctor profile page
- [x] Tests (unit + e2e)
- [x] Documentation (`docs/modules/04-doctor-management.md`)

### Checkpoint 4.2 - Doctor Scheduling - ✅ Complete
- [x] Weekly schedules
- [x] Leave management
- [x] Availability (beyond the existing `availabilityStatus` enum)
- [x] Dashboard availability stats
- [x] Doctor documents
- [x] Audit timeline
- [x] Remaining tests

---

## Milestone 5 - Appointment Management (Week 6)

**Goal:** Patient-facing appointment booking, on top of Milestone 4's
scheduling engine. Split into two checkpoints (see ADR-0006) mirroring
Milestone 4's precedent.

### Checkpoint 5.1 - Core Booking - ✅ Complete
- [x] Appointment slot generation (reuses `AvailabilityService` from 4.2,
      unmodified - see ADR-0006)
- [x] Conflict detection
- [x] Appointment booking (OPD, IPD, emergency, procedure)
- [x] Appointment status machine (scheduled → confirmed → arrived → in-consultation → completed/cancelled/no-show)
- [x] Email confirmation (reuses existing `EmailService`)
- [x] Frontend: day-view queue with filters
- [x] Frontend: booking form with live slot selection
- [x] Tests (unit + e2e)

### Checkpoint 5.2 - Queue & Recurring - ✅ Complete (SMS deferred)
- [x] Dedicated walk-in flow (`isWalkIn` flag, auto-assigns next available
      slot today - see ADR-0007)
- [x] Recurring appointments (`recurrenceGroupId`, independent rows per
      occurrence, partial-success reporting - see ADR-0007)
- [ ] SMS confirmations - **deferred, not attempted**: no SMS provider
      (Twilio or otherwise) is configured anywhere in this repo; this is
      genuinely credential-blocked, unlike email. Pick up if/when SMS
      provider credentials are supplied.
- [x] Frontend: walk-in quick-book dialog, recurring-booking toggle
- [x] Tests (unit + e2e)

---

## Milestone 6 - Clinical - Medical Records (Week 7)

**Goal:** Structured clinical documentation per consultation.

### Deliverables
- [ ] SOAP note structure (Subjective, Objective, Assessment, Plan)
- [ ] Vital signs recording (BP, temp, weight, height, SpO2, pulse)
- [ ] Diagnosis with ICD-10 code lookup
- [ ] Follow-up instructions
- [ ] Consultation history timeline
- [ ] Prescription module (from medical record)
- [ ] Drug interaction warnings (basic)
- [ ] Print prescription as PDF
- [ ] Frontend: consultation view (inline in appointment flow)
- [ ] Frontend: medical history timeline on patient profile

---

## Milestone 7 - Laboratory Management (Week 8)

**Goal:** Lab order management, from consultation to result.

### Deliverables
- [ ] Lab test catalog (configurable per org)
- [ ] Lab order creation from consultation
- [ ] Sample collection tracking
- [ ] Result entry (manual) and PDF upload
- [ ] Abnormal value flagging with reference ranges
- [ ] Lab result PDF generation
- [ ] AI-powered lab report summarization (async)
- [ ] Frontend: lab order list and result entry form

---

## Milestone 8 - Radiology Management (Week 9)

**Goal:** Radiology order tracking, from consultation to report.

### Deliverables
- [ ] Radiology order creation from consultation
- [ ] Radiology report upload and viewing
- [ ] Frontend: radiology order queue

---

## Milestone 9 - Pharmacy Management (Week 10–11)

**Goal:** Pharmacy dispensing, from prescription to dispense, with batch/expiry-tracked stock.
Reordered ahead of Billing & Insurance per explicit instruction - see ADR-0014.
General (non-drug) inventory, purchase orders, and pharmacy↔billing
integration are explicitly out of scope this milestone (Billing itself
is out of scope entirely) - see Milestone 10.

### Deliverables - ✅ Complete
- [x] Drug catalog (generic/brand name, strength, dosage form,
      manufacturer, batch, expiry, price, tax, active) - one row per
      batch, see ADR-0014
- [x] Dispense workflow (Pending → Preparing → Ready → Dispensed, plus
      Cancelled/Returned) - dispense/partial-dispense/complete-dispense/
      reject/cancel actions, full history
- [x] Stock management (current/reserved/available, minimum stock,
      reorder level, expiry tracking, batch tracking)
- [x] Medicine returns (adjusts stock back, fully audited)
- [x] REST + Swagger + RBAC (all-scope `pharmacy.*`) + pagination/
      filtering/sorting + audit integration
- [x] Frontend: `/dashboard/pharmacy` dashboard, `/catalog`, `/dispense`
      queue, `/stock`, `/[dispenseId]` detail - dispensing queue,
      prescription integration (dispense button on an encounter's
      prescription), batch selection, expiry/low-stock warnings, return
      workflow
- [x] Tests (unit + e2e + browser-verified)

---

## Milestone 10 - Billing (Week 12)

**Goal:** Complete financial operations from charge capture to invoice, payment,
and refund. Insurance is its own follow-up milestone - see ADR-0015.

### Deliverables
- [x] Charge Engine - reusable charge entity, consumed by every clinical module
- [x] Service catalog with pricing
- [x] Auto-invoice generation from appointment
- [x] Manual line-item addition
- [x] Discount management (flat/percentage, approval workflow)
- [x] GST calculation (GST-compliant invoicing)
- [x] Multiple payment modes (cash, card, UPI, bank transfer/NEFT/RTGS, cheque)
- [x] Split payments / partial payments / outstanding balance tracking
- [x] Payment receipt generation (PDF, hospital branding, QR placeholder)
- [x] Invoice PDF generation
- [x] Refunds (partial/full, audit)
- [x] Revenue dashboard
- [x] Frontend: billing workbench (invoices, payments, refunds)
- [x] Frontend: payment receipts
- [x] Tests (unit + e2e + browser-verified)

---

## Milestone 11 - Insurance Management (Week 13)

**Goal:** Insurance policy management and TPA/cashless claim workflow -
carved out of the original "Billing & Insurance" milestone (see ADR-0015),
building on the `InsuranceClaim` model and `Invoice.insuranceClaim` relation
already in the schema. Expanded to full Provider/Plan/Coverage/Pre-Auth/
Claims/Settlement management per this session's instruction - see ADR-0016.

### Deliverables
- [x] Insurance Company/TPA/Corporate Plan provider management
- [x] Insurance Plan management (coverage/co-pay/deductible/limits/network type)
- [x] Per-patient primary/secondary coverage
- [x] Cashless/TPA pre-authorization workflow
- [x] TPA/cashless claim workflow
- [x] Claim status tracking
- [x] Settlement (insurance share/patient share/adjustments/write-offs)
- [x] Automatic claim-document attachment (invoice/prescription/lab/radiology/encounter summary)
- [x] Insurance dashboard
- [x] Frontend: insurance claim management
- [x] Tests (unit + e2e + browser-verified)

---

## Milestone 12 - IPD & Bed Management (Week 14)

**Goal:** In-patient department workflow - ward/bed inventory, admission
through discharge, and the nursing/clinical record that runs alongside it.
Inserted ahead of General Inventory per explicit instruction at the close of
Milestone 11 - see ADR-0017; General Inventory and every later milestone
shift by one (13–17 → 14–18, unchanged in content). Split into two
checkpoints (see ADR-0018) mirroring Milestones 4/5/6's precedent - the
`Ward`/`Bed`/`Admission` domain surface is large enough to warrant the same
tight-scope-per-session discipline.

### Checkpoint 12.1 - Admission, Wards & Bed Management - ✅ Complete
- [x] Ward and bed inventory (ward/room/bed hierarchy, bed status: available/
      reserved/occupied/cleaning/maintenance/blocked)
- [x] Admission workflow (from an encounter or directly), attending doctor
      assignment - Emergency/Scheduled/Insurance/Transfer-from-OPD
- [x] Bed assignment / transfer between wards, rooms, or beds during a stay
      (allocate/reserve/cancel-reservation/vacate/transfer, full history)
- [x] Bed occupancy dashboard
- [x] Frontend: ward/room/bed management, a color-coded Bed Grid, an
      Admit Patient wizard, admission detail page
- [x] Tests (unit + e2e + browser-verified)

### Checkpoint 12.2 - Nursing, Medication Administration & Discharge - ✅ Complete
- [x] Nursing notes and IPD vitals charting (reuses/extends the existing
      `Vital` model where it fits)
- [x] Medication administration record (MAR) for IPD
- [x] Discharge workflow (discharge summary, discharge date, outcome) -
      sets `AdmissionStatus.DISCHARGED`
- [x] IPD billing integration - a stay's charges accumulate the same way
      OPD `Charge` rows already do, reusing the Milestone 10 Charge Engine
      (triggered at discharge - see TD-0030)
- [x] Frontend: nursing/MAR charting UI, discharge flow, IPD encounter view
- [x] Tests (unit + e2e + browser-verified)

---

## Milestone 13 - General Inventory (Week 15)

**Goal:** Non-drug hospital inventory management (equipment, consumables, supplies).

### Deliverables
- [ ] General inventory module
- [ ] Purchase order management
- [ ] Expiry tracking
- [ ] Inventory reports
- [ ] Frontend: inventory management

---

## Milestone 14 - Staff & Attendance (Week 16)

**Goal:** HR and attendance management for hospital staff.

### Deliverables
- [ ] Staff profiles and employee records
- [ ] Department and role assignment
- [ ] Shift management
- [ ] Attendance marking (manual + biometric hook)
- [ ] Leave management
- [ ] Doctor duty roster
- [ ] Staff reports
- [ ] Frontend: staff management
- [ ] Frontend: attendance dashboard

---

## Milestone 15 - AI Features (Week 17–18)

**Goal:** Integrate all planned AI capabilities.

### Deliverables
- [ ] Provider abstraction layer (OpenAI + Anthropic adapters)
- [ ] Prompt management system (DB-stored, versioned)
- [ ] Lab report PDF → text extraction → AI summarization
- [ ] Prescription image OCR → structured data extraction
- [ ] Voice recording → Whisper transcription → SOAP note extraction
- [ ] Appointment scheduling chatbot (streaming)
- [ ] AI usage tracking per org
- [ ] Frontend: AI features in context (summary panel, OCR review, chatbot widget)

---

## Milestone 16 - Platform & Multi-Tenant Administration (Week 19)

**Goal:** Turn MediCore from a hospital application into a SaaS platform
serving multiple organizations, each containing multiple hospitals.

Hierarchy: Platform Owner → Organization → Hospital → Department → Users →
Patients.

### Checkpoint 16.1 - Organization Management
- [x] Organization CRUD / profile
- [x] Branding + logo upload (reuses `StorageService`)
- [x] Organization settings
- [x] Organization administrators
- [x] Multiple hospitals per organization
- [x] Hospital onboarding wizard (hospital + departments + admin, one transaction)
- [x] Hospital activation/deactivation
- [x] Organization-level audit logs (filtered + paginated)
- [x] Organization dashboard APIs + statistics
- [x] Frontend: Organization Dashboard (Overview / Hospitals / Users /
      Subscription / Usage / Branding / Settings / Audit Logs)

### Checkpoint 16.2 - Platform Owner Console
- [x] View all organizations / hospitals / tenants
- [x] Enable/disable tenants, suspend + reinstate organizations
- [x] Manage subscriptions (plans + limits)
- [x] Storage usage, active users, API usage, AI usage
- [x] Global audit logs
- [x] Global search
- [x] Platform analytics
- [x] Frontend: isolated `/platform` console (own layout, own route group)

### Checkpoint 16.3 - Tenant Resolution
- [x] Every authenticated request resolves Platform / Organization / Hospital
- [x] Extended the existing JWT/session mechanism rather than duplicating it

### Checkpoint 16.4 - Organization Settings
- [x] Branding, theme, logo, address, tax details, contact details
- [x] Timezone, currency, language, working hours, holidays, feature flags

### Checkpoint 16.5 - Verification
- [x] lint / typecheck / test / test:e2e / build all green

---

## Milestone 17 - Reports & Analytics (Week 20)

**Goal:** Operational intelligence for hospital administrators.

**Status: COMPLETE** (2026-08-05) - see ADR-0026.

### Deliverables
- [x] OPD/IPD statistics dashboard
- [x] Revenue reports (daily, monthly, by service type)
- [x] Doctor-wise consultation reports
- [x] Lab test volume reports
- [x] Bed occupancy reports
- [x] Patient demographics report
- [x] Custom date range reports
- [x] PDF/Excel export for all reports
- [x] Frontend: reports module with charts (Recharts)

### Delivered beyond the original list
- Eleven operational report surfaces, not four: Patients, Appointments,
  Doctors, Laboratory, Radiology, Pharmacy, Inventory, Billing, Insurance,
  IPD and Staff.
- Five executive dashboards (CEO, Medical Director, Operations, Finance,
  Department) composed from those services rather than re-querying.
- A reusable report engine: a 23-entry registry driving one run endpoint,
  saved reports, and CSV / Excel / PDF export through a single code path.
- Scheduled reports as a **disclosed placeholder only** (TD-0053) - the
  schedule is persisted and cron-validated, and nothing dispatches it.

### Known limits (disclosed in-product, not faked)
- Appointment "waiting time" is a **scheduling delay**: no arrival
  timestamp exists in the schema (TD-0051).
- Radiology "machine utilization" is **relative load**: no machine capacity
  model exists (TD-0052).
- Lab "revenue by test" is **allocated** from billing charges: the
  laboratory module raises no charges and has no per-test price (TD-0055).

---

## Milestone 18 - Communication & Notification Platform (Week 21) ✅

**Goal:** Multi-channel patient and staff communication.

**Status: Complete (2026-08-06)** - delivered as seven checkpoints, a wider
scope than the list below (templates, delivery tracking, a retry queue,
scheduled notifications, an organization admin console and platform-owner
analytics were all added by the session's instruction). See **ADR-0027**.

### Deliverables
- [x] Email notifications - reuses the existing `common/email` Resend sender
- [x] SMS notifications - **provider abstraction with a local log driver
      only**; no paid provider integrated, by instruction (TD-0059)
- [x] In-app notification center
- [x] Push notifications - FCM HTTP v1 send path, device registry, service
      worker and click routing; the browser cannot mint a token in this
      deployment and says so (TD-0058)
- [x] Appointment reminders (scheduled at booking time, cancelled with the
      appointment)
- [x] Lab result ready notifications (a critical value escalates to
      `CRITICAL` priority)
- [x] WhatsApp - **provider abstraction with a local log driver only**
      (TD-0059)
- [x] Notification preferences per user (channels, quiet hours, email
      frequency, per-category)
- [x] Frontend: notification center in header
- [x] *Added:* notification templates (bundled defaults + append-only
      versioned org overrides)
- [x] *Added:* delivery tracking, retry queue and scheduled notifications
- [x] *Added:* organization admin console and platform-owner analytics
- [x] *Added:* scheduled-report dispatch, closing TD-0053

---

## Milestone 19 - Production Hardening & Enterprise Readiness (Week 22) ✅ COMPLETE (2026-08-06)

**Goal:** Secure, observable, deployable to production.

Delivered across seven checkpoints - see `.ai/PROGRESS.md` and ADR-0028 /
ADR-0029 / ADR-0030. The audit that opened the milestone found much of the
security and query work already correct, so it was left alone; no HMS feature
and no schema change was added.

### Deliverables
- [x] Security audit (OWASP top 10 review) - headers, CORS, CSRF, cookies,
      secrets, rate limiting, permissions all reviewed; only genuine gaps fixed
- [x] Rate limiting on all public endpoints - global tier already existed;
      added a per-route override on the seven credential endpoints
- [x] Request sanitization and validation hardening - Zod-behind-a-global-pipe
      was already in place; added **startup environment validation** that
      aborts the boot on an unsafe production setting
- [x] Structured logging with correlation IDs (Pino) - `AsyncLocalStorage`
      context, one shared request-id derivation rule, W3C `traceparent`,
      credential redaction
- [ ] Error monitoring integration (Sentry) - **not done**: no Sentry DSN or
      account exists in this environment, and the milestone was instructed not
      to invent deployment infrastructure. Structured JSON logs carrying
      `requestId`/`traceId` are the substitute; every unhandled 500 is logged
      with both
- [x] APM - Prometheus `/api/metrics` (HTTP latency/throughput/in-flight,
      dependency gauge, background-run counter, process/GC/event-loop series),
      plus Prisma slow-query logging. See TD-0069 for the OpenTelemetry gap
- [x] Database query optimization (N+1 analysis, slow query log) - the two
      likely N+1 shapes were already batched; 205 existing indexes cover the
      hot filters; slow-query logging added
- [ ] Load testing (k6) - **not done**: k6 is not a dependency and a load test
      against a laptop's Docker Postgres would produce numbers that mislead
      rather than inform. The metrics needed to run one meaningfully now exist
- [x] Production Docker images (multi-stage, minimal) - already multi-stage;
      now runs unprivileged, with a healthcheck that points at a path that
      exists
- [ ] Kubernetes manifests (optional) - **not done**, explicitly optional; the
      liveness/readiness split and graceful shutdown that a Deployment needs
      are in place
- [x] Production deployment runbook - `docs/operations/deployment.md` +
      `runbook.md` + `operations.md`
- [x] Disaster recovery procedure - `docs/operations/disaster-recovery.md`
- [ ] Backup strategy (daily DB snapshots, PITR) - **specified, not
      implemented (TD-0070)**. MediCore ships no scheduler; backup automation
      belongs to the target infrastructure. **A deployment following the guide
      exactly has no backups.**
- [x] HIPAA compliance checklist - the compliance section of
      `docs/operations/production-checklist.md`, which names the real open
      items (TD-0042 PHI to a third-party AI provider without a BAA, TD-0059
      log-only SMS/WhatsApp drivers, TD-0050 platform access granularity)
      rather than claiming compliance

## Milestone 20 - Dental OS (In Progress)

**Goal:** Specialized clinical modules for dental practices, integrating seamlessly into the core patient timeline and billing engine.

### Deliverables
- [x] **Interactive Odontogram Charting** - adult/pediatric toggle, surface-level condition selection, save state to DB
- [x] **Treatment Plan Builder & Dashboard** - multi-step procedure planning with cost estimation and status tracking
- [x] **Imaging Module (X-Ray/CBCT)** - DICOM/image upload portal, placeholder webGL viewer inside Patient 360
- [x] **Chair Queue (Live Kanban)** - auto-refreshed status board mapping today's appointments to waiting/in-chair/completed buckets
- [x] **Patient Ledger / Billing** - integration of dental treatment plans into the core MediCore invoicing engine
- [ ] **Periodontal Charting** - numerical grid for probing depths (1-9mm), bleeding on probing (BOP), and tooth mobility
- [ ] **Global Lab Cases Dashboard** - track outgoing/incoming crowns, bridges, dentures across vendors and return dates
- [ ] **Clinical Notes & Templates** - dental-specific note macros for common procedures (e.g. composite fillings, extractions)

---

## Future Roadmap (Post-MVP)

- **Mobile App** - React Native with offline support for rural clinics
- **Telemedicine** - Video consultation (WebRTC)
- **ABDM Integration** - Ayushman Bharat Digital Mission (Health ID, ABHA)
- **HL7/FHIR** - Interoperability with external hospital systems
- **LIMS Integration** - Deep integration with laboratory information systems
- **PACS Integration** - DICOM viewer for radiology
- **IoT Integration** - Bedside device data (ventilators, monitors)
- **WhatsApp Bot** - Patient engagement via WhatsApp Business API
- **Multi-language** - Hindi and regional language support
- **Franchise Module** - Chain hospital management with centralized reporting
