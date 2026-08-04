import { CreateAdHocDoseSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateAdHocDoseDto extends createZodDto(CreateAdHocDoseSchema) {}
