import { CreateMaintenanceRecordSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateMaintenanceRecordDto extends createZodDto(CreateMaintenanceRecordSchema) {}
