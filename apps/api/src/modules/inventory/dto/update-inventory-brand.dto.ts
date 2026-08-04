import { UpdateInventoryBrandSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateInventoryBrandDto extends createZodDto(UpdateInventoryBrandSchema) {}
