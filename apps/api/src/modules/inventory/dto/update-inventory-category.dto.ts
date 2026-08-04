import { UpdateInventoryCategorySchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateInventoryCategoryDto extends createZodDto(UpdateInventoryCategorySchema) {}
