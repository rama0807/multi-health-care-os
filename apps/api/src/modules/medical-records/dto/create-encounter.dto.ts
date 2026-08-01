import { CreateEncounterSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateEncounterDto extends createZodDto(CreateEncounterSchema) {}
