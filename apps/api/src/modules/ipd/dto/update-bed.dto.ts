import { UpdateBedSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateBedDto extends createZodDto(UpdateBedSchema) {}
