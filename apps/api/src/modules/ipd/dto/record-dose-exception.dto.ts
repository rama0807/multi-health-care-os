import { RecordDoseExceptionSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class RecordDoseExceptionDto extends createZodDto(RecordDoseExceptionSchema) {}
