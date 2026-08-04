import { GenerateScheduledDosesSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class GenerateScheduledDosesDto extends createZodDto(GenerateScheduledDosesSchema) {}
