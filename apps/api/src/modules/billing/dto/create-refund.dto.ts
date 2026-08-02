import { CreateRefundSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateRefundDto extends createZodDto(CreateRefundSchema) {}
