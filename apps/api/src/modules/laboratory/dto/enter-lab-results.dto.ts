import { EnterLabResultsSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class EnterLabResultsDto extends createZodDto(EnterLabResultsSchema) {}
