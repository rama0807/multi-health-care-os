import { UpdateLabTestStatusSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateLabTestStatusDto extends createZodDto(UpdateLabTestStatusSchema) {}
