import { LoginSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class LoginDto extends createZodDto(LoginSchema) {}
