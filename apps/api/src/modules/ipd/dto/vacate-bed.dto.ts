import { VacateBedSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class VacateBedDto extends createZodDto(VacateBedSchema) {}
