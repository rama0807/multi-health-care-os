import { UpdateInventoryStoreSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateInventoryStoreDto extends createZodDto(UpdateInventoryStoreSchema) {}
