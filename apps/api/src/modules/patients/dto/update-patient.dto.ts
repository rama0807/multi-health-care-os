import { UpdatePatientSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdatePatientDto extends createZodDto(UpdatePatientSchema) {}
