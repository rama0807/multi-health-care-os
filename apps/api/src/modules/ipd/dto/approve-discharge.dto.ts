import { ApproveDischargeSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class ApproveDischargeDto extends createZodDto(ApproveDischargeSchema) {}
