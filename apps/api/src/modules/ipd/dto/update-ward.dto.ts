import { UpdateWardSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateWardDto extends createZodDto(UpdateWardSchema) {}
