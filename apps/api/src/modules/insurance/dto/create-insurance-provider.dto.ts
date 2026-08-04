import { CreateInsuranceProviderSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateInsuranceProviderDto extends createZodDto(CreateInsuranceProviderSchema) {}
