import { DispensePartialSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class DispensePartialDto extends createZodDto(DispensePartialSchema) {}
