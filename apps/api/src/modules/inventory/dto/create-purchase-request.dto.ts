import { CreatePurchaseRequestSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreatePurchaseRequestDto extends createZodDto(CreatePurchaseRequestSchema) {}
