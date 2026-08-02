import { CreateLabOrderSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateLabOrderDto extends createZodDto(CreateLabOrderSchema) {}
