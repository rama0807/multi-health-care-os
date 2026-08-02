import { UpdateServiceCatalogItemSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateServiceCatalogItemDto extends createZodDto(UpdateServiceCatalogItemSchema) {}
