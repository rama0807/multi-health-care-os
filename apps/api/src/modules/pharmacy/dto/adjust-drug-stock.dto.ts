import { AdjustDrugStockSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class AdjustDrugStockDto extends createZodDto(AdjustDrugStockSchema) {}
