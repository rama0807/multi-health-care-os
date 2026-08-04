import { AllocateBedSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class AllocateBedDto extends createZodDto(AllocateBedSchema) {}
