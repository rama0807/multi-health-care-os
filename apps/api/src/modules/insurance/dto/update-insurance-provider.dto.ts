import { UpdateInsuranceProviderSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateInsuranceProviderDto extends createZodDto(UpdateInsuranceProviderSchema) {}
