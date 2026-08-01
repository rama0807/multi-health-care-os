import { ApplyLeaveSchema, DecideLeaveSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class ApplyLeaveDto extends createZodDto(ApplyLeaveSchema) {}
export class DecideLeaveDto extends createZodDto(DecideLeaveSchema) {}
