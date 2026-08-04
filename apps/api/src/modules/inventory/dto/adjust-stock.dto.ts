import { AdjustStockSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class AdjustStockDto extends createZodDto(AdjustStockSchema) {}
