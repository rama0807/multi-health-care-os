import { z } from 'zod'

import { SystemRole } from './enums'

export interface Permission {
  id: string
  resource: string
  action: string
  scope: string
  description: string | null
}

export interface Role {
  id: string
  name: string
  description: string | null
  systemRole: SystemRole | null
  organizationId: string
  permissions: Permission[]
  createdAt: Date
}

export const CreateRoleSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(255).optional(),
  permissionIds: z.array(z.string()).min(1),
})

export type CreateRoleDto = z.infer<typeof CreateRoleSchema>

export const UpdateRolePermissionsSchema = z.object({
  permissionIds: z.array(z.string()),
})

export type UpdateRolePermissionsDto = z.infer<typeof UpdateRolePermissionsSchema>

export const AssignRoleSchema = z.object({
  userId: z.string(),
  roleId: z.string(),
  hospitalId: z.string().optional(),
})

export type AssignRoleDto = z.infer<typeof AssignRoleSchema>
