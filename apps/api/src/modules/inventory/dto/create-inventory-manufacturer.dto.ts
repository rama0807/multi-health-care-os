import { CreateInventoryManufacturerSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateInventoryManufacturerDto extends createZodDto(CreateInventoryManufacturerSchema) {}
