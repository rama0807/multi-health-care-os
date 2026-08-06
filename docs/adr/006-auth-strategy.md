# ADR-006: Authentication and Authorization Strategy

**Status:** Accepted  
**Date:** 2024-01-15

---

## Context

MediCore is a multi-tenant system with sensitive medical and financial data. Authentication must be:
- Stateless for horizontal scaling
- Revocable (logout, compromised account)
- Tenant-isolated
- Auditable

## Decision

**JWT access tokens (15min TTL) + opaque refresh tokens (30d TTL, stored in Redis) + RBAC with fine-grained permissions.**

## Access Token Design

Short-lived JWT (15 minutes) signed with RS256:

```json
{
  "sub": "user_cld8h2k3j0000abc",
  "email": "dr.sharma@apollo.medicore.app",
  "orgId": "org_cld8h2k3j0001xyz",
  "orgSlug": "apollo-hospital",
  "roles": ["DOCTOR"],
  "sessionId": "sess_abc123",
  "iat": 1705312200,
  "exp": 1705313100
}
```

**RS256 vs HS256:** RS256 (asymmetric). If we ever add microservices, they can verify tokens using the public key without needing the signing secret. HS256 requires sharing the secret.

**15min TTL:** Short enough that a stolen access token expires quickly. Long enough to not require constant refreshes during normal use.

## Refresh Token Design

Opaque (random), stored in Redis with metadata:

```
Key:   refresh:{sha256(token)}
Value: {
  userId: "user_abc",
  sessionId: "sess_abc123",
  organizationId: "org_xyz",
  userAgent: "Mozilla/5.0...",
  ipAddress: "192.168.1.1",
  createdAt: "2024-01-15T10:00:00Z",
  expiresAt: "2024-02-14T10:00:00Z",
  isRevoked: false
}
TTL: 30 days
```

**Token rotation:** Each refresh issues a new refresh token and invalidates the old one. This enables detecting token theft - if a stolen token is used, the legitimate user's next refresh will fail (old token already consumed).

**Why not cookies?** We'll support both browser (httpOnly cookie option) and mobile/API clients (bearer token). The auth service handles both.

## RBAC Design

Three-level permission model:

```
Role → Permission → (resource, action, scope)

Examples:
  DOCTOR.read.patients.own       → can read patients assigned to them
  DOCTOR.write.prescriptions.own → can create prescriptions for their patients
  RECEPTIONIST.write.appointments.all → can schedule for any doctor
  ORG_ADMIN.*.*.all              → full access within their org
```

Permissions are evaluated in order:
1. Is the user's account active?
2. Is the user's organization active?
3. Does the user have the required role?
4. Does the role include the required permission?
5. Does the scope allow access to this specific resource instance?

## Audit Log

Every state-changing action is logged:

```typescript
{
  id: "audit_abc",
  organizationId: "org_xyz",
  userId: "user_abc",
  action: "patient.updated",
  resource: "Patient",
  resourceId: "pat_123",
  changes: { before: {...}, after: {...} }, // JSON diff
  ipAddress: "192.168.1.1",
  userAgent: "...",
  timestamp: "2024-01-15T10:30:00Z"
}
```

Audit logs are append-only - no UPDATE or DELETE ever runs on the audit_logs table.

## Rejected Alternatives

**Session-based auth:** Requires shared session store across API instances. Stateless JWT is better for horizontal scaling.

**Auth0 / Clerk:** Valid for simple apps. Rejected because:
- Multi-tenancy with custom RBAC is complex to model in third-party auth
- Adds external dependency for a security-critical component
- Cost at scale
- Reduced control over audit logging

**OAuth2 only:** OAuth2 is for third-party authorization, not first-party authentication. We'll add OAuth2/OIDC as a login method (Google, Microsoft SSO) on top of our auth system.
