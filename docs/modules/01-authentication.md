# Module: Authentication

## Purpose
Handles all user identity operations: registration, login, token management, password reset, and email verification.

## Responsibilities
- Validate credentials and issue JWT access + refresh token pairs
- Refresh access tokens without re-login
- Revoke sessions (logout single or all devices)
- Email verification workflow
- Password reset workflow
- OTP-based 2FA (future)

## Database Entities
- `User` — core user record
- `RefreshToken` — stored opaque tokens in Redis (not DB table)
- `AuditLog` — every auth event logged

## REST Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/auth/register` | Register org + admin user | Public |
| POST | `/auth/login` | Login, get tokens | Public |
| POST | `/auth/refresh` | Refresh access token | Refresh token |
| POST | `/auth/logout` | Revoke current session | Required |
| POST | `/auth/logout-all` | Revoke all sessions | Required |
| POST | `/auth/forgot-password` | Send reset email | Public |
| POST | `/auth/reset-password` | Set new password | Reset token |
| POST | `/auth/verify-email` | Verify email address | Verify token |
| GET | `/auth/sessions` | List active sessions | Required |
| GET | `/auth/me` | Current user profile | Required |

## Permissions
Auth endpoints are public or protected by token — no RBAC beyond token validity.

## Dependencies
- `@nestjs/jwt` — JWT generation and verification
- `bcrypt` — password hashing
- `Redis` — refresh token storage, OTP storage
- `NotificationsModule` — send verification/reset emails

## Events Published
- `auth.login` — on successful login
- `auth.logout` — on logout
- `auth.failed_login` — on invalid credentials (for rate limiting)
- `auth.password_reset` — on successful password reset
