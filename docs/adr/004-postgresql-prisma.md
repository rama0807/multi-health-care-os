# ADR-004: PostgreSQL 16 with Prisma ORM

**Status:** Accepted  
**Date:** 2024-01-15

---

## Context

Hospital data is highly relational: patients have appointments, appointments have doctors, doctors have departments, invoices relate to appointments and patients. We need:
- Strong ACID guarantees (financial data, medical records)
- Complex relational queries
- JSONB for semi-structured data (settings, form responses)
- Type-safe data access layer
- Reliable migration management

## Decision

**PostgreSQL 16** as the primary database with **Prisma** as the ORM.

## Rationale

### PostgreSQL

Healthcare applications are a perfect fit for PostgreSQL:

**ACID compliance:** A billing transaction that creates an invoice, line items, and updates inventory must either fully succeed or fully fail. PostgreSQL's transaction model guarantees this.

**JSONB:** Hospital settings, custom form fields, and metadata vary per organization. JSONB columns let us store this without schema migrations for every customization, while still indexing and querying the content.

**Row-Level Security:** PostgreSQL's RLS is a second line of defense for tenant isolation. Even if application code has a bug that omits `organizationId`, RLS at the DB level prevents cross-tenant data leakage.

**Full-text search:** Patient name search, diagnosis lookup, and medication search can use PostgreSQL's built-in `tsvector` search — no Elasticsearch for basic cases.

**PostGIS (future):** If we add location-based features (nearest clinic, doctor geo-routing), PostGIS extension is available.

### Prisma

| Feature | Prisma | TypeORM | Drizzle |
|---------|--------|---------|---------|
| Type safety | Excellent (generated) | Good (decorators) | Excellent (inferred) |
| Migration UX | Excellent | Good | Manual SQL |
| Query API | Fluent, readable | Verbose | SQL-like |
| Performance | Good | Good | Excellent |
| Schema introspection | Yes | Yes | Yes |
| Ecosystem | Large | Large | Growing |

Prisma's generated client gives **complete type safety** from schema to query result — no casting, no `any`. The schema file is the single source of truth.

```typescript
// TypeScript knows exactly what this returns — no type assertion needed
const patient = await prisma.patient.findUnique({
  where: { id: patientId, organizationId },
  include: { appointments: { include: { doctor: true } } }
})
// patient is typed as Patient & { appointments: (Appointment & { doctor: Doctor })[] }
```

### Migration Strategy

- Development: `prisma migrate dev` — interactive, creates named migrations
- Staging/Production: `prisma migrate deploy` — applies pending migrations, no interactivity
- Baseline migrations are committed to source control
- Never edit a committed migration file — create a new migration instead

## Rejected Alternatives

**MySQL:** JSONB support is weaker, RLS is not native, less suitable for complex relational queries.

**MongoDB:** Medical records are highly relational. A document store introduces consistency problems for financial data (billing, insurance) and makes complex joins painful.

**Drizzle:** Excellent performance and type safety, but requires writing raw SQL for complex queries. Prisma's generated client and migration tooling are more productive for a large schema.

**TypeORM:** Decorator-based approach creates coupling between domain models and DB schema. Prisma's schema-first approach is cleaner.
