import { ForgotPasswordSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class ForgotPasswordDto extends createZodDto(ForgotPasswordSchema) {}
