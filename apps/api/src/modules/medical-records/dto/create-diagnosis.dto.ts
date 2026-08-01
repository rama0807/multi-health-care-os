import { CreateDiagnosisSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateDiagnosisDto extends createZodDto(CreateDiagnosisSchema) {}
