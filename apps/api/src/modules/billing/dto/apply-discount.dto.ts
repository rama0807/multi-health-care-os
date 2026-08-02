import { ApplyDiscountSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class ApplyDiscountDto extends createZodDto(ApplyDiscountSchema) {}
