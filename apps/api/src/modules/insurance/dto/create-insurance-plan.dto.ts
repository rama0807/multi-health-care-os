import { CreateInsurancePlanSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateInsurancePlanDto extends createZodDto(CreateInsurancePlanSchema) {}
