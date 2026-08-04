import { CreateInventoryItemSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateInventoryItemDto extends createZodDto(CreateInventoryItemSchema) {}
