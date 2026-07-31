import { ResetPasswordSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {}
