import { CreateRadiologyReportSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateRadiologyReportDto extends createZodDto(CreateRadiologyReportSchema) {}
