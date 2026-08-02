import { PrepareDispenseItemsSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class PrepareDispenseItemsDto extends createZodDto(PrepareDispenseItemsSchema) {}
