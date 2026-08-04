import { CreatePreAuthorizationSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreatePreAuthorizationDto extends createZodDto(CreatePreAuthorizationSchema) {}
