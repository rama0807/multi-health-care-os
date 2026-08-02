import { UpdateDrugSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateDrugDto extends createZodDto(UpdateDrugSchema) {}
