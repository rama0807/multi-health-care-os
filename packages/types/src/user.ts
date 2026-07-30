import { z } from 'zod'

import { SystemRole } from './enums'

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  fullName: string
  phone: string | null
  avatar: string | null
  isActive: boolean
  isEmailVerified: boolean
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
  roles: z.array(z.nativeEnum(SystemRole)).min(1),
})

export type CreateUserDto = z.infer<typeof CreateUserSchema>

export const UpdateUserSchema = z.object({
  firstName: z.string().min(2).max(50).optional(),
  lastName: z.string().min(2).max(50).optional(),
  phone: z.string().optional(),
  roles: z.array(z.nativeEnum(SystemRole)).optional(),
})

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>
