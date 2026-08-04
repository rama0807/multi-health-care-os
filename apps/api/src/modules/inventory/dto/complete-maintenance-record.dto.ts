import { CompleteMaintenanceRecordSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CompleteMaintenanceRecordDto extends createZodDto(CompleteMaintenanceRecordSchema) {}
