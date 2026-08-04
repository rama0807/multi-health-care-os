import { CreateStaffSchema, UpdateStaffSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateStaffDto extends createZodDto(CreateStaffSchema) {}
export class UpdateStaffDto extends createZodDto(UpdateStaffSchema) {}
