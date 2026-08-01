import { UpdateEncounterStatusSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateEncounterStatusDto extends createZodDto(UpdateEncounterStatusSchema) {}
