import { RejectDiscountSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class RejectDiscountDto extends createZodDto(RejectDiscountSchema) {}
