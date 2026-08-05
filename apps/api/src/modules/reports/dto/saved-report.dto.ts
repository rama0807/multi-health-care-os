import { CreateSavedReportSchema, UpdateSavedReportSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateSavedReportDto extends createZodDto(CreateSavedReportSchema) {}
export class UpdateSavedReportDto extends createZodDto(UpdateSavedReportSchema) {}
