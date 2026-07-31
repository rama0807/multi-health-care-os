import { z } from 'zod'

import { SystemRole } from './enums'

export interface JwtPayload {
  sub: string
  email: string
  orgId: string
  orgSlug: string
  roles: SystemRole[]
  /** "resource.action.scope" strings, e.g. "patients.read.own" — resolved at login/refresh time */
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
