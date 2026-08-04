import { CancelPurchaseOrderSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CancelPurchaseOrderDto extends createZodDto(CancelPurchaseOrderSchema) {}
