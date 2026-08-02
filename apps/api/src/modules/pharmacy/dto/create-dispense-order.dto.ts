import { CreateDispenseOrderSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateDispenseOrderDto extends createZodDto(CreateDispenseOrderSchema) {}
