import { UpdateInventoryItemSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateInventoryItemDto extends createZodDto(UpdateInventoryItemSchema) {}
