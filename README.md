# MediCore — AI-Powered Hospital Management System

> A production-grade, multi-tenant SaaS platform for hospitals, clinics, and diagnostic centers. Built with a modern, AI-first architecture designed for real-world healthcare workflows.

[![CI](https://github.com/your-org/medicore/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/medicore/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Project Vision

Healthcare software is fragmented, outdated, and slow. MediCore is designed to be the system that clinical teams actually want to use — fast, intelligent, and built around real hospital workflows.

MediCore handles the full operational lifecycle of a healthcare facility:

- **Patient journeys** from registration to discharge
- **Clinical workflows** across OPD, IPD, emergency, and specialty care
- **Operational intelligence** through AI-powered summaries, OCR, and scheduling
- **Financial management** from billing to insurance claims
- **Supply chain** from pharmacy to biomedical inventory

---

## Core Features

### Patient Management
- Unified patient profiles with complete medical history
- Smart search with UHID (Unique Hospital ID) lookup
- Family linkage and emergency contact management
- Document and image uploads (Aadhaar, insurance cards)

### Clinical Operations
- OPD/IPD appointment scheduling with conflict detection
- Doctor availability and scheduling management
- Prescription management with drug interaction warnings
- Medical records with structured SOAP note format

### Diagnostics
- Laboratory order management with LIMS integration hooks
- Radiology orders (PACS integration ready)
- Report upload, viewing, and AI-powered summary

### Billing & Finance
- Patient billing with line-item granularity
- Insurance claim management (TPA/cashless)
- GST-compliant invoicing
- Revenue reports and dashboards

### AI Copilot
- Medical report summarization
- Prescription OCR extraction
- Voice-to-text consultation notes
- Appointment scheduling chatbot
- Anomaly detection in lab results

### Administration
- Multi-role access control (Admin, Doctor, Nurse, Receptionist, Lab Tech, Pharmacist)
- Bed and ward management
- Staff attendance and shift management
- Audit trail for every action

---

## Tech Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Monorepo | Turborepo | Build caching, parallel execution, workspace management |
| Backend | NestJS + TypeScript | Enterprise patterns, DI, decorator-based architecture |
| ORM | Prisma | Type-safe queries, migration management, schema-first |
| Database | PostgreSQL 16 | ACID compliance, JSONB support, row-level security |
| Cache | Redis 7 | Session management, job queues, rate limiting |
| Job Queue | BullMQ | Reliable background processing, retries, cron |
| Frontend | Next.js 14 (App Router) | RSC, SSR, SEO, file-based routing |
| UI | Tailwind CSS + shadcn/ui | Consistent design system, zero runtime |
| State | TanStack Query v5 | Server state management, caching, optimistic updates |
| Forms | React Hook Form + Zod | Performance, type-safe validation |
| AI | OpenAI / Anthropic (abstracted) | Pluggable provider architecture |
| Containerization | Docker + Docker Compose | Consistent environments |
| CI/CD | GitHub Actions | Automated testing, linting, deployment |

---

## Folder Structure

```
medicore/
├── apps/
│   ├── api/                 # NestJS backend application
│   │   ├── src/
│   │   │   ├── common/      # Shared utilities, decorators, guards
│   │   │   ├── config/      # Environment-specific configuration
│   │   │   ├── modules/     # Feature modules (auth, patients, etc.)
│   │   │   └── prisma/      # Prisma service
│   │   └── Dockerfile
│   └── web/                 # Next.js frontend application
│       ├── src/
│       │   ├── app/         # App Router pages and layouts
│       │   ├── components/  # React components
│       │   ├── hooks/       # Custom React hooks
│       │   ├── lib/         # Utilities, API client, auth
│       │   └── providers/   # Context providers
│       └── Dockerfile
├── packages/
│   ├── database/            # Prisma schema, migrations, seed
│   ├── ui/                  # Shared UI component library
│   ├── types/               # Shared TypeScript types and interfaces
│   └── config/              # Shared ESLint, TypeScript, Prettier configs
├── infra/
│   ├── docker/              # Docker Compose files
│   └── nginx/               # Nginx reverse proxy config
├── docs/
│   ├── adr/                 # Architecture Decision Records
│   └── modules/             # Per-module documentation
├── .github/
│   └── workflows/           # CI/CD pipelines
├── turbo.json               # Turborepo pipeline configuration
└── pnpm-workspace.yaml      # pnpm workspace definition
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker and Docker Compose
- PostgreSQL 16 (or use Docker)
- Redis 7 (or use Docker)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/medicore.git
cd medicore

# Install dependencies
pnpm install

# Copy environment files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# Start infrastructure services
docker-compose up -d postgres redis

# Generate Prisma client
pnpm --filter @medicore/database db:generate

# Run database migrations
pnpm --filter @medicore/database db:migrate

# Seed the database
pnpm --filter @medicore/database db:seed

# Start all apps in development
pnpm dev
```

### Development URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| API Documentation | http://localhost:4000/api/docs |
| Redis Commander | http://localhost:8081 |
| MailHog (dev email) | http://localhost:8025 |

---

## Development Workflow

### Branch Strategy

```
main          ← production-ready, protected
staging       ← pre-production verification
develop       ← integration branch

feature/MC-123-patient-search    ← feature branches
fix/MC-456-appointment-conflict  ← bug fix branches
chore/update-dependencies        ← maintenance
```

### Commit Conventions

We follow [Conventional Commits](https://conventionalcommits.org/):

```
feat(patients): add UHID search with fuzzy matching
fix(billing): correct GST calculation for exempt items
chore(deps): upgrade Prisma to 5.10.0
docs(api): add OpenAPI descriptions for appointment endpoints
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run backend tests
pnpm --filter @medicore/api test

# Run frontend tests
pnpm --filter @medicore/web test

# Run with coverage
pnpm test:coverage

# Run E2E tests
pnpm test:e2e
```

### Building for Production

```bash
# Build all apps
pnpm build

# Build specific app
pnpm --filter @medicore/api build
pnpm --filter @medicore/web build
```

---

## Roadmap

| Milestone | Status | Target |
|-----------|--------|--------|
| M1: Foundation & Infrastructure | In Progress | Week 1-2 |
| M2: Authentication & Multi-tenancy | Planned | Week 3 |
| M3: Patient Management | Planned | Week 4 |
| M4: Appointments & Scheduling | Planned | Week 5 |
| M5: Clinical — Medical Records | Planned | Week 6 |
| M6: Laboratory & Radiology | Planned | Week 7 |
| M7: Billing & Insurance | Planned | Week 8-9 |
| M8: Pharmacy & Inventory | Planned | Week 10 |
| M9: Staff & Attendance | Planned | Week 11 |
| M10: AI Features | Planned | Week 12-13 |
| M11: Reports & Analytics | Planned | Week 14 |
| M12: Notifications & Communication | Planned | Week 15 |
| M13: Production Hardening | Planned | Week 16 |

See [docs/roadmap.md](docs/roadmap.md) for detailed milestone breakdown.

---

## Contributing

1. Fork the repository
2. Create your feature branch from `develop`: `git checkout -b feature/MC-XXX-description`
3. Follow the coding standards in [docs/coding-standards.md](docs/coding-standards.md)
4. Ensure tests pass: `pnpm test`
5. Submit a pull request to `develop`

---

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full system design, including:
- System overview and module boundaries
- Authentication and authorization flow
- AI integration architecture
- Database design and multi-tenancy strategy
- Deployment topology

---

## License

MIT © MediCore
