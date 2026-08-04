import { CreateStockTransferSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateStockTransferDto extends createZodDto(CreateStockTransferSchema) {}
