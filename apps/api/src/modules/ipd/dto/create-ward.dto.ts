import { CreateWardSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateWardDto extends createZodDto(CreateWardSchema) {}
