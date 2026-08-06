# MediCore - System Architecture

## Table of Contents

1. [System Overview](#system-overview)
2. [Module Boundaries](#module-boundaries)
3. [Layer Responsibilities](#layer-responsibilities)
4. [Request Flow](#request-flow)
5. [Authentication Flow](#authentication-flow)
6. [AI Integration Points](#ai-integration-points)
7. [Storage Strategy](#storage-strategy)
8. [Event Flow](#event-flow)
9. [Background Jobs](#background-jobs)
10. [Multi-Tenancy Architecture](#multi-tenancy-architecture)
11. [Deployment Strategy](#deployment-strategy)

---

## System Overview

MediCore is a multi-tenant SaaS application structured as a monorepo. It follows a clean, layered architecture with strong module boundaries.

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│   Browser (Next.js SSR/CSR)  │  Mobile App (Future)  │  API     │
└──────────────────────────────┼──────────────────────────────────┘
                               │ HTTPS
┌──────────────────────────────▼──────────────────────────────────┐
│                       GATEWAY LAYER                             │
│            Nginx Reverse Proxy + Rate Limiting                  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                     APPLICATION LAYER                           │
│                  NestJS API (Port 4000)                         │
│  ┌─────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────────┐  │
│  │  Auth   │ │ Patients │ │Appointments│ │   AI Copilot     │  │
│  │ Module  │ │  Module  │ │  Module    │ │     Module       │  │
│  └─────────┘ └──────────┘ └────────────┘ └──────────────────┘  │
│  ┌─────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────────┐  │
│  │Billing  │ │   Lab    │ │  Pharmacy  │ │   Notifications  │  │
│  │ Module  │ │  Module  │ │  Module    │ │     Module       │  │
│  └─────────┘ └──────────┘ └────────────┘ └──────────────────┘  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                       DATA LAYER                                │
│  ┌────────────────┐  ┌─────────────┐  ┌───────────────────────┐ │
│  │  PostgreSQL 16 │  │  Redis 7    │  │   Object Storage      │ │
│  │  (Primary DB)  │  │  (Cache +   │  │   (S3/MinIO)          │ │
│  │                │  │   Sessions) │  │   Documents, Images   │ │
│  └────────────────┘  └─────────────┘  └───────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                    BACKGROUND LAYER                             │
│          BullMQ Workers (email, reports, AI processing)         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Module Boundaries

Each feature module is fully encapsulated. A module owns its:
- Controller (HTTP surface)
- Service (business logic)
- Repository (data access)
- DTOs (input/output contracts)
- Guards (module-specific authorization)
- Events (published to event bus)

**Cross-module communication rules:**
- Modules communicate through service injection, not direct DB queries
- Events are used for side effects (e.g., appointment created → send notification)
- Shared types live in `@medicore/types`
- No circular dependencies between modules

```
┌──────────────────────────────────────────────────────────┐
│                    Module Dependency Graph                │
│                                                          │
│  Auth ◄─── Organizations                                 │
│   │                                                      │
│   ├──► Users                                             │
│         │                                                │
│         ├──► Patients ──────────────────────────────────┐│
│         │      │                                        ││
│         │      ├──► Appointments ──► Doctors            ││
│         │      │         │                              ││
│         │      │         ├──► Notifications             ││
│         │      │                                        ││
│         │      ├──► Medical Records                     ││
│         │      │      └──► Prescriptions ──► Pharmacy   ││
│         │      │                                        ││
│         │      ├──► Laboratory ──► Billing              ││
│         │      │                      │                 ││
│         │      └──► Radiology         └──► Insurance    ││
│         │                                               ││
│         └──► Staff ──► Attendance ──────────────────────┘│
│                                                          │
│  AI Copilot ──► (all modules as consumers)               │
└──────────────────────────────────────────────────────────┘
```

---

## Layer Responsibilities

### Presentation Layer (Next.js)
- Server-side rendering for public pages and SEO
- Client-side rendering for interactive dashboard
- Route-based code splitting
- Optimistic UI updates via TanStack Query
- Form validation via Zod schemas (shared with backend)

### API Gateway (Nginx)
- TLS termination
- Rate limiting per IP and per tenant
- Request routing to application services
- Gzip compression
- Security headers

### Application Layer (NestJS)
- HTTP request/response cycle
- Authentication and authorization
- Input validation and transformation
- Business logic orchestration
- Event publication
- Job queuing

### Data Access Layer (Prisma)
- Type-safe database queries
- Transaction management
- Migration management
- Query optimization

### Cache Layer (Redis)
- JWT refresh token storage (short TTL with sliding window)
- Rate limiting counters
- Session data
- Computed query results (invalidated on mutation)
- BullMQ job persistence

---

## Request Flow

### Standard API Request

```
Client
  │
  │  HTTP Request (with JWT Bearer token)
  ▼
Nginx
  │ Rate limit check
  │ Security headers
  ▼
NestJS Global Middleware
  │ Request logging (correlation ID injection)
  │ Organization context extraction (from JWT or subdomain)
  ▼
Authentication Guard
  │ JWT verification
  │ Token blacklist check (Redis)
  │ Load user + roles from DB/cache
  ▼
Authorization Guard (RBAC)
  │ Check role permissions for route
  │ Check organization isolation
  ▼
Validation Pipe
  │ Zod/class-validator DTO validation
  │ Transform and sanitize
  ▼
Controller
  │ Extract and bind request data
  ▼
Service
  │ Business logic
  │ Cross-module calls if needed
  ▼
Repository / Prisma
  │ Database query (always scoped to organizationId)
  ▼
Response
  │ Transform via interceptor
  │ Standardized response envelope
  ▼
Client
```

### Response Envelope

All API responses follow this structure:

```typescript
// Success
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}

// Paginated
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 145,
    "totalPages": 8
  }
}

// Error
{
  "success": false,
  "error": {
    "code": "PATIENT_NOT_FOUND",
    "message": "No patient found with UHID MED-2024-001234",
    "details": { ... }
  }
}
```

---

## Authentication Flow

*(Implemented in Milestone 2 - apps/api/src/modules/auth)*

### Login Flow

```
Client                     API                      Database           Redis
  │                         │                          │                 │
  │── POST /auth/login ─────►│                          │                 │
  │   {email, password,      │                          │                 │
  │    rememberMe}           │                          │                 │
  │                         │── Find user by email ────►│                 │
  │                         │◄──────────────────────────│                 │
  │                         │                          │                 │
  │                         │── Check lockedUntil,      │                 │
  │                         │   status, org.isActive    │                 │
  │                         │── Verify Argon2 hash      │                 │
  │                         │   (failure → increment    │                 │
  │                         │    failedLoginAttempts,   │                 │
  │                         │    lock at 5 for 15min)   │                 │
  │                         │                          │                 │
  │                         │── Resolve roles/permissions/hospitalIds ───►│
  │                         │   (Role → RolePermission → Permission)      │
  │                         │                          │                 │
  │                         │── Sign access token       │                 │
  │                         │   (JWT, RS256, 15min TTL) │                 │
  │                         │                          │                 │
  │                         │── Create session + opaque │                 │
  │                         │   refresh token ──────────────────────────►│
  │                         │   session:{userId}:{sessionId}              │
  │                         │   refresh:{sha256(token)}                   │
  │                         │                          │                 │
  │                         │── Emit auth.login (→ AuditLog listener) ───►│
  │                         │                          │                 │
  │◄── 200 {accessToken,     │                          │                 │
  │         expiresIn, user} │                          │                 │
  │◄── Set-Cookie: medicore_rt (HttpOnly), medicore_csrf │                 │
```

Refresh token never appears in the response body - only as an HttpOnly cookie. The access token is returned in the body and kept in memory by the frontend (never persisted to storage).

### Token Refresh Flow (with rotation + reuse detection)

```
Client                     API                          Redis
  │                         │                              │
  │── POST /auth/refresh ───►│                              │
  │   Cookie: medicore_rt,   │                              │
  │   Header: X-CSRF-Token   │                              │
  │                         │── Lookup refresh:{hash} ─────►│
  │                         │                              │
  │            ┌── found & session still alive ─────────────┤
  │            │   → tombstone old key (60s), issue new      │
  │            │     token, bump session.lastUsedAt           │
  │            │                                              │
  │            └── not found, but found under                 │
  │                refresh:revoked:{hash} (tombstone)         │
  │                → THEFT: kill the whole session,           │
  │                  emit auth.token_reuse_detected, 401      │
  │                                                            │
  │◄── 200 {accessToken, expiresIn, user}                      │
  │◄── Set-Cookie: medicore_rt (rotated), medicore_csrf         │
```

`JwtStrategy` additionally checks `session:{userId}:{sessionId}` exists on **every** authenticated request - this is what makes logout/theft-detection revoke access immediately rather than waiting out the access token's 15-minute expiry.

### RBAC Structure

```
Organization
  └── Hospital (0..n)
        └── Department (0..n)
  └── User
        └── UserRole (many-to-many, optionally scoped to one Hospital)
              └── Role
                    └── RolePermission (many-to-many)
                          └── Permission
                                ├── resource: "patients"
                                ├── action: "read" | "create" | "update" | "delete" | "manage"
                                └── scope: "own" | "all"
```

Permissions are **entirely DB-driven** (seeded via `packages/database/prisma/seed.ts`, never hardcoded in guards). At login/refresh, a user's full permission set is resolved and embedded in the JWT as `"resource.action.scope"` strings; `PermissionsGuard` + `@RequirePermissions()` check membership with no role-based bypass - including for `SUPER_ADMIN`, whose access comes purely from its seeded role holding every permission row. `UserRole.hospitalId` (nullable) lets a role assignment be scoped to one hospital ("Hospital Admin for Hospital X") instead of the whole org - this only affects Department/Hospital-management endpoints today; clinical/financial resources remain org-wide.

**System Roles** (`SystemRole` enum - tags a Role's intent, not its permissions):
- `SUPER_ADMIN` - MediCore platform admin (seeded in its own dedicated org; cross-tenant querying is future work, see ADR-008)
- `ORG_ADMIN` - Hospital/organization administrator (org-wide by default, or hospital-scoped via `UserRole.hospitalId`)
- `DOCTOR` - Clinical access, scoped to assigned patients (`.own` scope)
- `NURSE` - Clinical read access
- `RECEPTIONIST` - Patient registration, appointments, billing read
- `LAB_TECHNICIAN` - Laboratory module access
- `RADIOLOGY_TECHNICIAN` - Radiology module access
- `PHARMACIST` - Pharmacy module access
- `CASHIER` - Billing and payments
- `HR` - Staff management
- `INVENTORY_MANAGER` - Inventory and stock

---

## AI Integration Points

AI in MediCore is designed as a pluggable layer. The `AIService` abstracts over any provider.

```
┌─────────────────────────────────────────────────────────┐
│                   AI Copilot Module                     │
│                                                         │
│  ┌──────────────┐    ┌────────────────────────────────┐ │
│  │  AI Service  │    │     Provider Abstraction       │ │
│  │  (facade)    │───►│  ┌──────────┐  ┌──────────┐   │ │
│  └──────────────┘    │  │ OpenAI   │  │Anthropic │   │ │
│         │            │  │ Adapter  │  │ Adapter  │   │ │
│         │            │  └──────────┘  └──────────┘   │ │
│         │            └────────────────────────────────┘ │
│         │                                               │
│  ┌──────▼──────────────────────────────────────────┐    │
│  │              Feature Implementations            │    │
│  │                                                 │    │
│  │  reportSummarizer    → Medical report → summary │    │
│  │  prescriptionOcr     → Image → structured Rx    │    │
│  │  voiceTranscription  → Audio → clinical notes   │    │
│  │  appointmentChatbot  → NL → booking intent      │    │
│  │  labAnomalyDetector  → Results → flags          │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### Prompt Architecture

Each AI feature has:
1. **System prompt template** - defines role and constraints
2. **Context builder** - assembles patient/org context from DB
3. **Prompt constructor** - combines system prompt + context + user query
4. **Response parser** - validates and structures AI output
5. **Fallback handler** - graceful degradation if AI fails

### AI Processing Pipeline

AI tasks are processed asynchronously via BullMQ:

```
Request ──► API ──► Queue Job ──► Worker ──► AI Provider ──► Store Result ──► Notify Client
                                                                              (WebSocket / polling)
```

---

## Storage Strategy

### PostgreSQL - Primary Datastore

- All structured application data
- Multi-tenant isolation via `organizationId` on every row
- Row-Level Security (RLS) as defense-in-depth
- Indexed for common query patterns
- JSONB for semi-structured data (settings, metadata, form responses)

### Redis - Ephemeral State

| Key Pattern | Purpose | TTL |
|-------------|---------|-----|
| `session:{userId}:{sessionId}` | Session metadata (userAgent, ipAddress, lastUsedAt) | 30d (remember-me) / 1d |
| `sessions:{userId}` | Set of a user's active session IDs (enumeration for logout-all / list-sessions, no `KEYS`/`SCAN`) | matches sessions |
| `refresh:{sha256(token)}` | Refresh token metadata | 30d (remember-me) / 1d |
| `refresh:revoked:{sha256(token)}` | Short-lived tombstone left behind on rotation - a hit here means the token was replayed after rotation (theft) | 60s |
| `email_verify:{sha256(token)}` | Email verification token → userId, single-use (`GETDEL`) | 24h |
| `pwd_reset:{sha256(token)}` | Password reset token → userId, single-use (`GETDEL`) | 1h |
| `rate:{ip}:{endpoint}` | Rate limiting counters | 1m |
| `cache:org:{orgId}:{resource}` | Query result cache | 5m |
| `bull:*` | BullMQ job data | Managed by Bull |

### Object Storage (S3/MinIO)

| Prefix | Content |
|--------|---------|
| `/orgs/{orgId}/patients/{patientId}/documents/` | Patient documents |
| `/orgs/{orgId}/reports/{reportId}/` | Lab/radiology reports |
| `/orgs/{orgId}/prescriptions/{rxId}/` | Prescription images |
| `/orgs/{orgId}/staff/{staffId}/` | Staff documents |
| `/orgs/{orgId}/logos/` | Organization logos |

All files are stored with:
- Server-side encryption (AES-256)
- Presigned URLs for client access (15min TTL)
- Virus scanning on upload (ClamAV hook in production)

---

## Event Flow

MediCore uses an internal event bus (NestJS EventEmitter) for synchronous in-process events and BullMQ for asynchronous cross-concern events.

### Event Categories

**Clinical Events:**
- `patient.registered`
- `appointment.scheduled`
- `appointment.completed`
- `prescription.created`
- `lab.result.uploaded`

**Operational Events:**
- `invoice.generated`
- `payment.received`
- `bed.assigned`
- `bed.discharged`

**System Events:**
- `user.login`
- `user.password_reset`
- `auth.suspicious_login`

### Event Flow Example - Appointment Completed

```
Doctor marks appointment complete
            │
            ▼
AppointmentService.complete()
            │
            ├── Update appointment status in DB
            │
            ├── Emit: appointment.completed
            │
            │         ┌── NotificationService
            │         │   Send follow-up reminder (scheduled)
            └──────────┤
                      ├── BillingService
                      │   Auto-generate OPD invoice draft
                      │
                      └── AIService
                          Queue: transcription processing
                                 (if voice note attached)
```

---

## Background Jobs

All background work runs through BullMQ queues:

| Queue | Job Types | Priority |
|-------|-----------|----------|
| `notifications` | Email, SMS, push notifications | High |
| `ai-processing` | Report summary, OCR, transcription | Normal |
| `reports` | PDF generation, data exports | Low |
| `billing` | Auto-invoicing, insurance submissions | High |
| `cleanup` | Expired token cleanup, temp file deletion | Low |
| `sync` | External system sync (LIMS, PACS hooks) | Normal |

### Job Retry Strategy

```typescript
defaultJobOptions: {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: 100,  // keep last 100
  removeOnFail: 500,      // keep last 500 for debugging
}
```

---

## Multi-Tenancy Architecture

MediCore uses **row-level multi-tenancy** - all tenant data lives in shared tables, isolated by `organizationId`.

**Organization hierarchy** (Milestone 2): an `Organization` (the tenant) can own multiple `Hospital` rows (physical facilities/branches), each containing `Department` rows. Every tenant-scoped table still carries `organizationId` directly (defense-in-depth, per the isolation guarantee below) even where it's also derivable via the hospital/department chain. `organizationId` is always read from the JWT claim (`request.user.orgId`), never from a route param or request body.

**Why not schema-per-tenant?**
- Row-level is simpler to operate (one set of migrations)
- Better for a SaaS with many small tenants
- PostgreSQL RLS provides database-level isolation as defense-in-depth
- Prisma's global query extensions enforce tenant scoping at application level

### Tenant Isolation Guarantee

```typescript
// Every Prisma query is wrapped with organizationId
// This is enforced via a Prisma client extension

prisma.$extends({
  query: {
    $allModels: {
      async findMany({ args, query }) {
        args.where = { ...args.where, organizationId: currentOrg.id }
        return query(args)
      }
    }
  }
})
```

### Organization Resolution

Tenant context is resolved from:
1. **Subdomain** - `hospital-name.medicore.app` → resolve org slug
2. **JWT claim** - `organizationId` embedded in access token
3. **API header** - `X-Organization-ID` for M2M integrations

---

## Deployment Strategy

### Infrastructure Topology (Production)

```
                         ┌─────────────────┐
                         │   CloudFlare    │
                         │  (DNS + WAF +   │
                         │   DDoS protect) │
                         └────────┬────────┘
                                  │
                         ┌────────▼────────┐
                         │  Load Balancer  │
                         │  (AWS ALB /     │
                         │   GCP LB)       │
                         └────────┬────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
    ┌─────────▼──────┐  ┌─────────▼──────┐  ┌────────▼────────┐
    │   Next.js App  │  │  NestJS API    │  │  NestJS API     │
    │   (Vercel /    │  │  Instance 1    │  │  Instance 2     │
    │    App Runner) │  │  (ECS Fargate) │  │  (ECS Fargate)  │
    └────────────────┘  └────────┬───────┘  └────────┬────────┘
                                 │                   │
                        ┌────────▼───────────────────▼────────┐
                        │          Data Layer                  │
                        │                                      │
                        │  ┌──────────────┐  ┌─────────────┐  │
                        │  │ RDS Postgres │  │  ElastiCache│  │
                        │  │ (Primary +   │  │   Redis     │  │
                        │  │  Read Rep.)  │  │  Cluster    │  │
                        │  └──────────────┘  └─────────────┘  │
                        │                                      │
                        │  ┌──────────────┐                    │
                        │  │  S3 / MinIO  │                    │
                        │  │  (Documents) │                    │
                        │  └──────────────┘                    │
                        └──────────────────────────────────────┘
```

### Environment Strategy

| Environment | Purpose | Deploy Trigger |
|-------------|---------|----------------|
| `development` | Local development | - |
| `staging` | Pre-production QA | Push to `staging` branch |
| `production` | Live system | Tag `v*.*.*` on `main` |

### Scalability Path

- **Phase 1 (0-1K patients/day):** Single API instance, single DB
- **Phase 2 (1K-10K patients/day):** API replicas, DB read replicas, Redis cluster
- **Phase 3 (10K+ patients/day):** Service extraction (AI service, notification service), CQRS for reporting, event sourcing for audit trail
