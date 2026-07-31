import { UpdateDepartmentSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateDepartmentDto extends createZodDto(UpdateDepartmentSchema) {}
