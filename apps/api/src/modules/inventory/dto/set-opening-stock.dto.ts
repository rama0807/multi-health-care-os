import { SetOpeningStockSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class SetOpeningStockDto extends createZodDto(SetOpeningStockSchema) {}
