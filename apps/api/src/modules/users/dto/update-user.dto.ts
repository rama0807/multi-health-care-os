import { UpdateUserSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateUserDto extends createZodDto(UpdateUserSchema) {}
