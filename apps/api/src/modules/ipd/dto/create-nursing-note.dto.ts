import { CreateNursingNoteSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateNursingNoteDto extends createZodDto(CreateNursingNoteSchema) {}
