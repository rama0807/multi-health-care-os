import { CancelDispenseOrderSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CancelDispenseOrderDto extends createZodDto(CancelDispenseOrderSchema) {}
