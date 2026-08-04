import { CreateNursingTaskSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateNursingTaskDto extends createZodDto(CreateNursingTaskSchema) {}
