import { CreateInsuranceClaimSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateInsuranceClaimDto extends createZodDto(CreateInsuranceClaimSchema) {}
