import { CreateIpdOrderSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateIpdOrderDto extends createZodDto(CreateIpdOrderSchema) {}
