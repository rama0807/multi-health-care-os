import { CreateIntakeOutputSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateIntakeOutputDto extends createZodDto(CreateIntakeOutputSchema) {}
