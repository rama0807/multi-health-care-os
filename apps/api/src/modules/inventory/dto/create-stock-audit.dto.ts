import { CreateStockAuditSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateStockAuditDto extends createZodDto(CreateStockAuditSchema) {}
