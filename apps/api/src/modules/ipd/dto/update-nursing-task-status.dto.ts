import { UpdateNursingTaskStatusSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateNursingTaskStatusDto extends createZodDto(UpdateNursingTaskStatusSchema) {}
