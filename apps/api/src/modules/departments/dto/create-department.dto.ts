import { CreateDepartmentSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateDepartmentDto extends createZodDto(CreateDepartmentSchema) {}
