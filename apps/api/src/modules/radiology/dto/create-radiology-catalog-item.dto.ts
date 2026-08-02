import { CreateRadiologyCatalogItemSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateRadiologyCatalogItemDto extends createZodDto(CreateRadiologyCatalogItemSchema) {}
