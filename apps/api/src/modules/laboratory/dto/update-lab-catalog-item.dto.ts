import { UpdateLabCatalogItemSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateLabCatalogItemDto extends createZodDto(UpdateLabCatalogItemSchema) {}
