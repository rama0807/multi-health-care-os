import { UpdateRadiologyCatalogItemSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateRadiologyCatalogItemDto extends createZodDto(UpdateRadiologyCatalogItemSchema) {}
