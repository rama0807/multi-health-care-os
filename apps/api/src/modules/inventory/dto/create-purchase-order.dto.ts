import { CreatePurchaseOrderSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreatePurchaseOrderDto extends createZodDto(CreatePurchaseOrderSchema) {}
