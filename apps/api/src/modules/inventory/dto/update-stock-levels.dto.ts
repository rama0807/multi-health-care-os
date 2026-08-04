import { UpdateStockLevelsSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateStockLevelsDto extends createZodDto(UpdateStockLevelsSchema) {}
