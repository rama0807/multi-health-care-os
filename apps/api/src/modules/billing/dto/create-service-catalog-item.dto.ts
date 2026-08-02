import { CreateServiceCatalogItemSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateServiceCatalogItemDto extends createZodDto(CreateServiceCatalogItemSchema) {}
