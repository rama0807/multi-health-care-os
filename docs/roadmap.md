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

### Checkpoint 4.2 — Doctor Scheduling — Not started
- [ ] Weekly schedules
- [ ] Leave management
- [ ] Availability (beyond the existing `availabilityStatus` enum)
- [ ] Dashboard availability stats
- [ ] Doctor documents
- [ ] Audit timeline
- [ ] Remaining tests

### Deferred beyond Milestone 4
- [ ] Appointment slot generation
- [ ] Conflict detection
- [ ] Appointment booking (OPD, IPD, emergency, procedure)
- [ ] Appointment status machine (scheduled → confirmed → arrived → in-consultation → completed/cancelled)
- [ ] Appointment queue for walk-ins
- [ ] Recurring appointments
- [ ] SMS/email confirmation notifications
- [ ] Frontend: calendar view (day/week)
- [ ] Frontend: appointment list with queue display
- [ ] Frontend: booking form

---

## Milestone 5 — Clinical — Medical Records (Week 6)

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

## Milestone 6 — Laboratory & Radiology (Week 7)

**Goal:** Lab order management and radiology order tracking.

### Deliverables
- [ ] Lab test catalog (configurable per org)
- [ ] Lab order creation from consultation
- [ ] Sample collection tracking
- [ ] Result entry (manual) and PDF upload
- [ ] Abnormal value flagging with reference ranges
- [ ] Lab result PDF generation
- [ ] Radiology order creation
- [ ] Radiology report upload and viewing
- [ ] AI-powered lab report summarization (async)
- [ ] Frontend: lab order list and result entry form
- [ ] Frontend: radiology order queue

---

## Milestone 7 — Billing & Insurance (Week 8–9)

**Goal:** Complete financial operations from invoice generation to insurance claims.

### Deliverables
- [ ] Service catalog with pricing
- [ ] Auto-invoice generation from appointment
- [ ] Manual line-item addition
- [ ] Discount management
- [ ] GST calculation (GST-compliant invoicing)
- [ ] Multiple payment modes (cash, card, UPI, NEFT)
- [ ] Payment receipt generation
- [ ] Invoice PDF generation
- [ ] Insurance policy management
- [ ] TPA/cashless claim workflow
- [ ] Claim status tracking
- [ ] Revenue dashboard
- [ ] Frontend: billing workbench
- [ ] Frontend: insurance claim management
- [ ] Frontend: payment receipts

---

## Milestone 8 — Pharmacy & Inventory (Week 10)

**Goal:** Pharmacy dispensing and general inventory management.

### Deliverables
- [ ] Medication catalog with stock management
- [ ] Prescription-to-dispense workflow
- [ ] Stock deduction on dispense
- [ ] Low stock alerts
- [ ] Pharmacy billing integration
- [ ] General inventory module
- [ ] Purchase order management
- [ ] Expiry tracking
- [ ] Inventory reports
- [ ] Frontend: pharmacy queue
- [ ] Frontend: inventory management

---

## Milestone 9 — Staff & Attendance (Week 11)

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

## Milestone 10 — AI Features (Week 12–13)

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

## Milestone 11 — Reports & Analytics (Week 14)

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

## Milestone 12 — Notifications & Communication (Week 15)

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

## Milestone 13 — Production Hardening (Week 16)

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
