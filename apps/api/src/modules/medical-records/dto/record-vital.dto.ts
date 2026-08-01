import { RecordVitalSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class RecordVitalDto extends createZodDto(RecordVitalSchema) {}
