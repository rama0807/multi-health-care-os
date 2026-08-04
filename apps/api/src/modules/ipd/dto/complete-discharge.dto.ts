import { CompleteDischargeSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CompleteDischargeDto extends createZodDto(CompleteDischargeSchema) {}
