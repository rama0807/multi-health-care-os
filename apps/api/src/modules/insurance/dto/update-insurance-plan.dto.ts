import { UpdateInsurancePlanSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateInsurancePlanDto extends createZodDto(UpdateInsurancePlanSchema) {}
