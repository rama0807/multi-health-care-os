import { CreateChargeSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateChargeDto extends createZodDto(CreateChargeSchema) {}
