import { CreateInventoryStoreSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateInventoryStoreDto extends createZodDto(CreateInventoryStoreSchema) {}
