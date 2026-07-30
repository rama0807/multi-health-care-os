# ADR-008: Multi-Tenancy Strategy

**Status:** Accepted  
**Date:** 2024-01-15

---

## Context

MediCore serves multiple healthcare organizations (hospitals, clinics, diagnostic centers) from a single deployment. Tenant data must be completely isolated — a nurse at Hospital A must never see data from Hospital B, even in the event of application bugs.

## Decision

**Row-level multi-tenancy** with `organizationId` on every tenant-scoped table, enforced at three layers:
1. Application layer (Prisma middleware)
2. Database layer (PostgreSQL Row-Level Security)
3. JWT layer (organizationId in token)

## Why Row-Level Over Schema-Per-Tenant

| Approach | Row-Level | Schema-Per-Tenant |
|---------|-----------|------------------|
| Migration complexity | Single migration for all tenants | One migration per tenant |
| New tenant onboarding | INSERT into organizations table | CREATE SCHEMA + run migrations |
| Data isolation | Application + RLS enforced | Database schema boundaries |
| Cross-tenant reporting | Simple (superadmin queries) | Complex cross-schema joins |
| Connection pooling | Efficient (shared pool) | Each tenant needs connection |
| Scale | Good to millions of tenants | Degrades at hundreds of tenants |

Schema-per-tenant is better when tenants have truly different schemas (custom tables per tenant). Our tenants all share the same data model with configuration differences — row-level is the right fit.

## Three-Layer Isolation

### Layer 1: JWT Claims

Every access token contains `organizationId`. The organization context is extracted from the JWT — never from a user-supplied request parameter.

```typescript
// Middleware extracts org context — NOT from req.params or req.body
const orgId = request.user.organizationId
```

### Layer 2: Prisma Middleware

A Prisma client extension injects `organizationId` into every query automatically:

```typescript
const tenantPrisma = prisma.$extends({
  query: {
    $allModels: {
      async findMany({ args, query }) {
        if (TENANT_SCOPED_MODELS.includes(model)) {
          args.where = { ...args.where, organizationId: currentOrgId }
        }
        return query(args)
      },
      async findFirst({ args, query }) { ... },
      async create({ args, query }) {
        args.data = { ...args.data, organizationId: currentOrgId }
        return query(args)
      },
    }
  }
})
```

Services receive a `TenantPrismaService` that is scoped to the current request's organization.

### Layer 3: PostgreSQL RLS

```sql
-- Enable RLS on all tenant tables
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY tenant_isolation ON patients
  USING (organization_id = current_setting('app.current_org_id')::text);

-- Application sets session variable on connection
SET app.current_org_id = 'org_abc123';
```

RLS fires even if a raw SQL query bypasses application code. Defense-in-depth.

## Tenant Resolution

```
Request arrives
      │
      ▼
Extract from JWT: organizationId
      │
      ├──► Validate org is active
      │
      └──► Set on request context
                │
                ▼
         All downstream code uses
         req.organization.id
         (never re-resolved from external input)
```

Subdomain support: `hospital-name.medicore.app` resolves to an org via slug lookup on the first request, then the org is embedded in the JWT.

## Superadmin Access

MediCore platform admins (SUPER_ADMIN role) can query across tenants. This is enforced by:
- A separate `X-Admin-Key` header + superadmin JWT combination
- All superadmin actions are logged with elevated audit detail
- Superadmin endpoints are on a separate, unexposed route group in production
