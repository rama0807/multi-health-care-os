import { CreateUserSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateUserDto extends createZodDto(CreateUserSchema) {}
