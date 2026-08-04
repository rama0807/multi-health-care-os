import { CreateInventoryItemGroupSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateInventoryItemGroupDto extends createZodDto(CreateInventoryItemGroupSchema) {}
