import { UpdateInventoryItemGroupSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateInventoryItemGroupDto extends createZodDto(UpdateInventoryItemGroupSchema) {}
