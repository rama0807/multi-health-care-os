import { UpdatePatientInsuranceSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdatePatientInsuranceDto extends createZodDto(UpdatePatientInsuranceSchema) {}
