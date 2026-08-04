import { CreateInventoryBrandSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateInventoryBrandDto extends createZodDto(CreateInventoryBrandSchema) {}
