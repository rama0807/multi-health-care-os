import { UpdateInventoryUnitSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateInventoryUnitDto extends createZodDto(UpdateInventoryUnitSchema) {}
