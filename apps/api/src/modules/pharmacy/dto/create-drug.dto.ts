import { CreateDrugSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateDrugDto extends createZodDto(CreateDrugSchema) {}
