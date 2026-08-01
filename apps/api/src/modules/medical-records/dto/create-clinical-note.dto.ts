import { CreateClinicalNoteSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateClinicalNoteDto extends createZodDto(CreateClinicalNoteSchema) {}
