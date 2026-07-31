import { z } from 'zod'

import { SystemRole, UserStatus } from './enums'

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  fullName: string
  phone: string | null
  avatar: string | null
  status: UserStatus
  isEmailVerified: boolean
  timezone: string
  mfaEnabled: boolean
  organizationId: string
  roles: SystemRole[]
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export const CreateUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  phone: z.string().optional(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  roleIds: z.array(z.string()).min(1),
})

export type CreateUserDto = z.infer<typeof CreateUserSchema>

export const UpdateUserSchema = z.object({
  firstName: z.string().min(2).max(50).optional(),
  lastName: z.string().min(2).max(50).optional(),
  phone: z.string().optional(),
  status: z.nativeEnum(UserStatus).optional(),
})

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>
