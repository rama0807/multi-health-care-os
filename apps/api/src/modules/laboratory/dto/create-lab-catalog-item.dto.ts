import { CreateLabCatalogItemSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateLabCatalogItemDto extends createZodDto(CreateLabCatalogItemSchema) {}
