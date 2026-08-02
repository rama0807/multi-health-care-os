import { UpdateRadiologyStatusSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateRadiologyStatusDto extends createZodDto(UpdateRadiologyStatusSchema) {}
