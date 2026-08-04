import { RejectPurchaseRequestSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class RejectPurchaseRequestDto extends createZodDto(RejectPurchaseRequestSchema) {}
