import { DecidePreAuthorizationSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class DecidePreAuthorizationDto extends createZodDto(DecidePreAuthorizationSchema) {}
