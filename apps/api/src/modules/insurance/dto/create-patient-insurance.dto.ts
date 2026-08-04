import { CreatePatientInsuranceSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreatePatientInsuranceDto extends createZodDto(CreatePatientInsuranceSchema) {}
