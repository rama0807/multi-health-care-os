import { UpdateRolePermissionsSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateRolePermissionsDto extends createZodDto(UpdateRolePermissionsSchema) {}
