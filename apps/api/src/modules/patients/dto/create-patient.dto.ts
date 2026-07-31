import { CreatePatientSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreatePatientDto extends createZodDto(CreatePatientSchema) {}
