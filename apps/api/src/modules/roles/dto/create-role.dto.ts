import { CreateRoleSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateRoleDto extends createZodDto(CreateRoleSchema) {}
