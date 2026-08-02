import { CreatePaymentSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreatePaymentDto extends createZodDto(CreatePaymentSchema) {}
