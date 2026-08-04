import { DiscontinueIpdOrderSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class DiscontinueIpdOrderDto extends createZodDto(DiscontinueIpdOrderSchema) {}
