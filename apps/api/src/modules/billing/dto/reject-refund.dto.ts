import { RejectRefundSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class RejectRefundDto extends createZodDto(RejectRefundSchema) {}
