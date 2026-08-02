import { UpdateRadiologyOrderSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateRadiologyOrderDto extends createZodDto(UpdateRadiologyOrderSchema) {}
