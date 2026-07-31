# Module: Authentication

**Status:** Implemented (Milestone 2) — `apps/api/src/modules/auth`

## Purpose
Handles all user identity operations: registration, login, token management, password reset, and email verification.

## Responsibilities
- Validate credentials (Argon2) and issue JWT access (RS256) + refresh token pairs
- Refresh access tokens without re-login, with rotation + reuse (theft) detection
- Revoke sessions (logout single or all devices)
- Account lockout after repeated failed logins
- Email verification workflow
- Password reset workflow
- OTP-based 2FA (future — `User.mfaEnabled`/`mfaSecret` are schema-ready but no TOTP flow is implemented yet)

## Database Entities
- `User` — core user record (`status`, `failedLoginAttempts`, `lockedUntil`, `timezone`, `mfaEnabled`/`mfaSecret`)
- `Role` / `Permission` / `RolePermission` / `UserRole` — DB-driven RBAC (see ARCHITECTURE.md RBAC Structure)
- Refresh tokens and sessions are **Redis-only** (not a DB table) — see ARCHITECTURE.md's Redis key table
- `AuditLog` — every auth event logged via an `@OnEvent` listener (`modules/audit`), not a DB table auth writes to directly

## REST Endpoints

All under `/api/v1/auth`.

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/register` | Register org + admin user | Public |
| POST | `/login` | Login, get access token (refresh via cookie) | Public |
| POST | `/refresh` | Rotate refresh token, get new access token | Refresh cookie + CSRF |
| POST | `/logout` | Revoke current session | Required + CSRF |
| POST | `/logout-all` | Revoke all sessions | Required + CSRF |
| POST | `/forgot-password` | Send reset email (always 200, never leaks existence) | Public |
| POST | `/reset-password` | Set new password, revokes all sessions | Reset token |
| POST | `/verify-email` | Verify email address | Verify token |
| POST | `/resend-verification` | Re-issue a verification email | Required |
| POST | `/change-password` | Change password, keeps current session, revokes others | Required |
| GET | `/sessions` | List active sessions | Required |
| GET | `/me` | Current user profile (roles, permissions, hospitalIds) | Required |

## Permissions
Auth endpoints are public or protected by token validity — no `@RequirePermissions()` gate beyond authentication itself.

## Security notes
- Access token: JWT, RS256, 15min TTL, returned in the response body — the frontend keeps it in memory only (never localStorage).
- Refresh token: opaque, Redis-backed, delivered as an HttpOnly/Secure/SameSite=Lax cookie (`medicore_rt`, path `/`). Rotated on every use; reuse of an already-rotated token kills the session (see ARCHITECTURE.md's Token Refresh Flow).
- CSRF: double-submit cookie (`medicore_csrf`, non-HttpOnly) validated against an `X-CSRF-Token` header — applied only to the cookie-authenticated routes (`refresh`/`logout`/`logout-all`), never globally.
- Account lockout: 5 failed attempts locks the account for 15 minutes (`User.failedLoginAttempts`/`lockedUntil`).

## Dependencies
- `@nestjs/jwt` — JWT signing/verification (RS256)
- `argon2` — password hashing
- Redis (`common/redis`) — refresh tokens, sessions, email-verification/password-reset tokens
- `common/email` (Resend, with a console-log fallback when `RESEND_API_KEY` is unset) — verification/reset emails
- `modules/roles` — resolves a user's roles/permissions/hospitalIds for JWT embedding at login/refresh

## Events Published
- `auth.register`, `auth.login`, `auth.logout`, `auth.logout_all`
- `auth.failed_login`, `auth.account_locked`
- `auth.password_reset`, `auth.email_verified`
- `auth.token_reuse_detected` — refresh token replay detected

## Explicitly deferred (not built in Milestone 2)
- **Patient portal / self-service login** — `Patient` remains a clinical record with no `User` link and no `PATIENT` role. This milestone's RBAC is staff-only (Super Admin, Hospital Admin, Doctor, Nurse, Receptionist, Lab Technician, Pharmacist, Cashier, HR).
- **SUPER_ADMIN cross-tenant querying** — per ADR-008, the `X-Admin-Key` + superadmin-JWT cross-tenant path is documented but not implemented. `SUPER_ADMIN` today is a real seeded account with full permissions inside its own dedicated organization.
- **TOTP/MFA flow** — schema fields exist (`User.mfaEnabled`/`mfaSecret`) but no enrollment/verification endpoints yet.
