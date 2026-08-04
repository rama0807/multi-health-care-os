import { CreateInventoryCategorySchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateInventoryCategoryDto extends createZodDto(CreateInventoryCategorySchema) {}
