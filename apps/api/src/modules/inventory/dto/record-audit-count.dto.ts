import { RecordAuditCountSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class RecordAuditCountDto extends createZodDto(RecordAuditCountSchema) {}
