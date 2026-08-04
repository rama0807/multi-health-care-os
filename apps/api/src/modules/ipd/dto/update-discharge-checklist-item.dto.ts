import { UpdateDischargeChecklistItemSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateDischargeChecklistItemDto extends createZodDto(UpdateDischargeChecklistItemSchema) {}
