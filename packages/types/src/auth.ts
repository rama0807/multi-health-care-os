import { z } from 'zod'

import { OrganizationType, SystemRole } from './enums'

/**
 * The three tenant levels every authenticated request resolves to
 * (Checkpoint 16.3). `platform` is the outermost: true only for users whose
 * organization is flagged `Organization.isPlatform`. `organization` is always
 * present. `hospital` is a *scope*, not a single value - a user with no
 * hospital-scoped role assignment operates org-wide.
 */
export interface TenantContext {
  userId: string
  organizationId: string
  organizationSlug: string
  isPlatformOwner: boolean
  /** Empty means org-wide access, not "no access". */
  hospitalIds: string[]
}

export interface JwtPayload {
  sub: string
  email: string
  orgId: string
  orgSlug: string
  /**
   * The organization type embedded at login/refresh time so route guards and
   * the frontend router can branch without a round trip. Validated server-side
   * against the live `Organization.type` on every request via `JwtStrategy`.
   */
  orgType: OrganizationType
  /**
   * True when this user's organization is the platform tenant. Carried in the
   * token so `PlatformGuard` needs no per-request DB round trip - the same
   * reasoning that already embeds `permissions` rather than re-resolving them.
   * Revoking it takes effect on the next refresh (≤15 min), and
   * `JwtStrategy.validate` still re-checks the organization is active on every
   * request.
   */
  isPlatform: boolean
  roles: SystemRole[]
  /** "resource.action.scope" strings, e.g. "patients.read.own" - resolved at login/refresh time */
  permissions: string[]
  /** Hospitals this user's role assignments are scoped to; empty = org-wide */
  hospitalIds: string[]
  sessionId: string
  iat: number
  exp: number
}

export interface AccessTokenResponse {
  accessToken: string
  expiresIn: number
}

export interface AuthenticatedUser {
  id: string
  email: string
  firstName: string
  lastName: string
  avatar: string | null
  organizationId: string
  organizationSlug: string
  organizationName: string
  /** The type of organization this user belongs to (HOSPITAL, DENTAL, etc.). Used
   *  by the frontend router to branch to the correct application shell. */
  organizationType: OrganizationType
  /** Mirrors `JwtPayload.isPlatform` - lets the web app route to the isolated Platform console. */
  isPlatform: boolean
  roles: SystemRole[]
  permissions: string[]
  hospitalIds: string[]
}

export interface LoginResponse extends AccessTokenResponse {
  user: AuthenticatedUser
}

export interface SessionInfo {
  sessionId: string
  userId: string
  userAgent: string
  ipAddress: string
  createdAt: Date
  lastUsedAt: Date
  isCurrent: boolean
}

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  organizationSlug: z.string().optional(),
  rememberMe: z.boolean().optional().default(false),
})

export type LoginDto = z.infer<typeof LoginSchema>

export const RegisterOrganizationSchema = z.object({
  organizationName: z.string().min(2).max(100),
  organizationSlug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  adminFirstName: z.string().min(2).max(50),
  adminLastName: z.string().min(2).max(50),
  adminEmail: z.string().email(),
  adminPassword: z
    .string()
    .min(8)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain uppercase, lowercase, and number',
    ),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter valid Indian mobile number'),
  /** Defaults to HOSPITAL so the existing hospital signup flow is unchanged. */
  organizationType: z.nativeEnum(OrganizationType).default(OrganizationType.HOSPITAL),
})

export type RegisterOrganizationDto = z.infer<typeof RegisterOrganizationSchema>

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
})

export type ForgotPasswordDto = z.infer<typeof ForgotPasswordSchema>

export const ResetPasswordSchema = z.object({
  token: z.string(),
  password: z
    .string()
    .min(8)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
})

export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>

export const VerifyEmailSchema = z.object({
  token: z.string(),
})

export type VerifyEmailDto = z.infer<typeof VerifyEmailSchema>

export const RefreshTokenSchema = z.object({
  // Web clients rely on the httpOnly cookie; non-browser clients may pass it explicitly.
  refreshToken: z.string().optional(),
})

export type RefreshTokenDto = z.infer<typeof RefreshTokenSchema>

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z
    .string()
    .min(8)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
})

export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>
