import { CreateRadiologyOrderSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateRadiologyOrderDto extends createZodDto(CreateRadiologyOrderSchema) {}
