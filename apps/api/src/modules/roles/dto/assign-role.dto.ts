import { AssignRoleSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class AssignRoleDto extends createZodDto(AssignRoleSchema) {}
