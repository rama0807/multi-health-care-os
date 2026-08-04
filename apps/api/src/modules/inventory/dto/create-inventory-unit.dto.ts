import { CreateInventoryUnitSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateInventoryUnitDto extends createZodDto(CreateInventoryUnitSchema) {}
