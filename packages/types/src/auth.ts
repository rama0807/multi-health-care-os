import { z } from 'zod'

import { SystemRole } from './enums'

export interface JwtPayload {
  sub: string
  email: string
  orgId: string
  orgSlug: string
  roles: SystemRole[]
  sessionId: string
  iat: number
  exp: number
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
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

export const ResetPasswordSchema = z.object({
  token: z.string(),
  password: z
    .string()
    .min(8)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
})
