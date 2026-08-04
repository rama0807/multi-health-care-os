import { CancelPreAuthorizationSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CancelPreAuthorizationDto extends createZodDto(CancelPreAuthorizationSchema) {}
