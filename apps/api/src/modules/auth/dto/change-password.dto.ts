import { ChangePasswordSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class ChangePasswordDto extends createZodDto(ChangePasswordSchema) {}
