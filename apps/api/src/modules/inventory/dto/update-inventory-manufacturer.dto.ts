import { UpdateInventoryManufacturerSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateInventoryManufacturerDto extends createZodDto(UpdateInventoryManufacturerSchema) {}
