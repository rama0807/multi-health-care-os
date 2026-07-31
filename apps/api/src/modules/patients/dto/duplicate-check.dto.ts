import { DuplicateCheckSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class DuplicateCheckDto extends createZodDto(DuplicateCheckSchema) {}
