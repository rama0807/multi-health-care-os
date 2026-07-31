import { VerifyEmailSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class VerifyEmailDto extends createZodDto(VerifyEmailSchema) {}
