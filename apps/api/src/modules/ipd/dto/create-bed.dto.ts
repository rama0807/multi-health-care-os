import { CreateBedSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateBedDto extends createZodDto(CreateBedSchema) {}
