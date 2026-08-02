# MediCore Development Roadmap

---

## Milestone 1 — Foundation & Infrastructure (Week 1–2)

**Goal:** Production-ready project skeleton. Every developer can clone, run `pnpm install && docker-compose up && pnpm dev`, and have a working system.

### Deliverables
- [ ] Monorepo setup (Turborepo + pnpm workspaces)
- [ ] Root tooling: ESLint, Prettier, EditorConfig, commitlint, Husky
- [ ] `packages/config` — shared TypeScript and ESLint configs
- [ ] `packages/types` — shared TypeScript interfaces
- [ ] `packages/database` — Prisma schema, client export
- [ ] `apps/api` — NestJS project with all modules scaffolded (empty)
- [ ] `apps/web` — Next.js 14 project with App Router, Tailwind, shadcn
- [ ] Docker Compose for local: PostgreSQL, Redis, MailHog
- [ ] GitHub Actions CI: lint, typecheck, test on PR
- [ ] Environment configuration strategy
- [ ] Database baseline migration
- [ ] API health check endpoint
- [ ] Frontend base layout (sidebar, header, theme)

---

## Milestone 2 — Authentication & Organization Setup (Week 3)

**Goal:** Complete auth system with multi-tenancy, RBAC, and organization management.

### Deliverables
- [x] Organization registration (onboarding flow) — `POST /auth/register`
- [x] User registration and email verification — admin-created users + self-registered org admins, Redis-backed verification tokens
- [x] Login / logout — Argon2, RS256 JWT, HttpOnly refresh cookie, CSRF
- [x] JWT + refresh token implementation — rotation with reuse (theft) detection
- [x] RBAC: roles and permissions seeded — DB-driven, `packages/database/prisma/seed.ts`
- [x] Password reset flow
- [x] Session management (active sessions list) — `GET /auth/sessions`, `POST /auth/logout(-all)`
- [x] Audit log middleware (auto-capture on mutations) — event-listener based (`modules/audit`), not an HTTP interceptor
- [x] Frontend: login page, forgot password, email verification
- [ ] Frontend: org settings page — backend (`GET/PATCH /organizations/me`) implemented; no frontend page yet
- [ ] Frontend: user management page (admin) — backend (`modules/users`) implemented; no frontend page yet
- [ ] Role assignment UI — backend (`modules/roles`, assign/revoke endpoints) implemented; no frontend UI yet

Also delivered beyond the original scope: `Hospital` entity (Organization → Hospital → Department hierarchy), hospital-scoped role assignments (`UserRole.hospitalId`), account lockout, `Hospitals`/`Departments` REST modules, and a `/health` endpoint.

---

## Milestone 3 — Patient Management (Week 4)

**Goal:** Complete patient registration and management module.

### Deliverables
- [ ] Patient CRUD with UHID generation
- [ ] Patient search (name, UHID, phone — full-text + fuzzy)
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

## Milestone 4 — Doctor Management & Scheduling (Week 5)

**Goal:** Doctor directory/profile management, then doctor-side scheduling.
Split into two checkpoints (see ADR-0005) to keep each session's scope
tight; appointment *booking* itself (patient-facing slot booking, queue,
status machine) is deferred to a later milestone.

### Checkpoint 4.1 — Doctor Management — ✅ Complete
- [x] Doctor CRUD
- [x] Professional profile
- [x] Linked user onboarding (`StaffOnboardingService`, reused across staff roles)
- [x] Search
- [x] Filters
- [x] Dashboard (total/active doctor stats)
- [x] Doctor profile page
- [x] Tests (unit + e2e)
- [x] Documentation (`docs/modules/04-doctor-management.md`)

### Checkpoint 4.2 — Doctor Scheduling — ✅ Complete
- [x] Weekly schedules
- [x] Leave management
- [x] Availability (beyond the existing `availabilityStatus` enum)
- [x] Dashboard availability stats
- [x] Doctor documents
- [x] Audit timeline
- [x] Remaining tests

---

## Milestone 5 — Appointment Management (Week 6)

**Goal:** Patient-facing appointment booking, on top of Milestone 4's
scheduling engine. Split into two checkpoints (see ADR-0006) mirroring
Milestone 4's precedent.

### Checkpoint 5.1 — Core Booking — ✅ Complete
- [x] Appointment slot generation (reuses `AvailabilityService` from 4.2,
      unmodified — see ADR-0006)
- [x] Conflict detection
- [x] Appointment booking (OPD, IPD, emergency, procedure)
- [x] Appointment status machine (scheduled → confirmed → arrived → in-consultation → completed/cancelled/no-show)
- [x] Email confirmation (reuses existing `EmailService`)
- [x] Frontend: day-view queue with filters
- [x] Frontend: booking form with live slot selection
- [x] Tests (unit + e2e)

### Checkpoint 5.2 — Queue & Recurring — ✅ Complete (SMS deferred)
- [x] Dedicated walk-in flow (`isWalkIn` flag, auto-assigns next available
      slot today — see ADR-0007)
- [x] Recurring appointments (`recurrenceGroupId`, independent rows per
      occurrence, partial-success reporting — see ADR-0007)
- [ ] SMS confirmations — **deferred, not attempted**: no SMS provider
      (Twilio or otherwise) is configured anywhere in this repo; this is
      genuinely credential-blocked, unlike email. Pick up if/when SMS
      provider credentials are supplied.
- [x] Frontend: walk-in quick-book dialog, recurring-booking toggle
- [x] Tests (unit + e2e)

---

## Milestone 6 — Clinical — Medical Records (Week 7)

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

## Milestone 7 — Laboratory Management (Week 8)

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

## Milestone 8 — Radiology Management (Week 9)

**Goal:** Radiology order tracking, from consultation to report.

### Deliverables
- [ ] Radiology order creation from consultation
- [ ] Radiology report upload and viewing
- [ ] Frontend: radiology order queue

---

## Milestone 9 — Pharmacy Management (Week 10–11)

**Goal:** Pharmacy dispensing, from prescription to dispense, with batch/expiry-tracked stock.
Reordered ahead of Billing & Insurance per explicit instruction — see ADR-0014.
General (non-drug) inventory, purchase orders, and pharmacy↔billing
integration are explicitly out of scope this milestone (Billing itself
is out of scope entirely) — see Milestone 10.

### Deliverables — ✅ Complete
- [x] Drug catalog (generic/brand name, strength, dosage form,
      manufacturer, batch, expiry, price, tax, active) — one row per
      batch, see ADR-0014
- [x] Dispense workflow (Pending → Preparing → Ready → Dispensed, plus
      Cancelled/Returned) — dispense/partial-dispense/complete-dispense/
      reject/cancel actions, full history
- [x] Stock management (current/reserved/available, minimum stock,
      reorder level, expiry tracking, batch tracking)
- [x] Medicine returns (adjusts stock back, fully audited)
- [x] REST + Swagger + RBAC (all-scope `pharmacy.*`) + pagination/
      filtering/sorting + audit integration
- [x] Frontend: `/dashboard/pharmacy` dashboard, `/catalog`, `/dispense`
      queue, `/stock`, `/[dispenseId]` detail — dispensing queue,
      prescription integration (dispense button on an encounter's
      prescription), batch selection, expiry/low-stock warnings, return
      workflow
- [x] Tests (unit + e2e + browser-verified)

---

## Milestone 10 — Billing (Week 12)

**Goal:** Complete financial operations from charge capture to invoice, payment,
and refund. Insurance is its own follow-up milestone — see ADR-0015.

### Deliverables
- [x] Charge Engine — reusable charge entity, consumed by every clinical module
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

## Milestone 11 — Insurance Management (Week 13)

**Goal:** Insurance policy management and TPA/cashless claim workflow —
carved out of the original "Billing & Insurance" milestone (see ADR-0015),
building on the `InsuranceClaim` model and `Invoice.insuranceClaim` relation
already in the schema.

### Deliverables
- [ ] Insurance policy management
- [ ] TPA/cashless claim workflow
- [ ] Claim status tracking
- [ ] Frontend: insurance claim management

---

## Milestone 12 — General Inventory (Week 14)

**Goal:** Non-drug hospital inventory management (equipment, consumables, supplies).

### Deliverables
- [ ] General inventory module
- [ ] Purchase order management
- [ ] Expiry tracking
- [ ] Inventory reports
- [ ] Frontend: inventory management

---

## Milestone 13 — Staff & Attendance (Week 15)

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

## Milestone 14 — AI Features (Week 16–17)

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

## Milestone 15 — Reports & Analytics (Week 18)

**Goal:** Operational intelligence for hospital administrators.

### Deliverables
- [ ] OPD/IPD statistics dashboard
- [ ] Revenue reports (daily, monthly, by service type)
- [ ] Doctor-wise consultation reports
- [ ] Lab test volume reports
- [ ] Bed occupancy reports
- [ ] Patient demographics report
- [ ] Custom date range reports
- [ ] PDF/Excel export for all reports
- [ ] Frontend: reports module with charts (Recharts)

---

## Milestone 16 — Notifications & Communication (Week 19)

**Goal:** Multi-channel patient and staff communication.

### Deliverables
- [ ] Email notifications (via Resend/SendGrid)
- [ ] SMS notifications (via Twilio/Fast2SMS)
- [ ] In-app notification center
- [ ] Push notifications (PWA)
- [ ] Appointment reminders (automated, scheduled)
- [ ] Lab result ready notifications
- [ ] Discharge instructions via WhatsApp (optional)
- [ ] Notification preferences per user
- [ ] Frontend: notification center in header

---

## Milestone 17 — Production Hardening (Week 20)

**Goal:** Secure, observable, deployable to production.

### Deliverables
- [ ] Security audit (OWASP top 10 review)
- [ ] Rate limiting on all public endpoints
- [ ] Request sanitization and validation hardening
- [ ] Structured logging with correlation IDs (Pino)
- [ ] Error monitoring integration (Sentry)
- [ ] APM (application performance monitoring)
- [ ] Database query optimization (N+1 analysis, slow query log)
- [ ] Load testing (k6)
- [ ] Production Docker images (multi-stage, minimal)
- [ ] Kubernetes manifests (optional)
- [ ] Production deployment runbook
- [ ] Disaster recovery procedure
- [ ] Backup strategy (daily DB snapshots, PITR)
- [ ] HIPAA compliance checklist

---

## Future Roadmap (Post-MVP)

- **Mobile App** — React Native with offline support for rural clinics
- **Telemedicine** — Video consultation (WebRTC)
- **ABDM Integration** — Ayushman Bharat Digital Mission (Health ID, ABHA)
- **HL7/FHIR** — Interoperability with external hospital systems
- **LIMS Integration** — Deep integration with laboratory information systems
- **PACS Integration** — DICOM viewer for radiology
- **IoT Integration** — Bedside device data (ventilators, monitors)
- **WhatsApp Bot** — Patient engagement via WhatsApp Business API
- **Multi-language** — Hindi and regional language support
- **Franchise Module** — Chain hospital management with centralized reporting
