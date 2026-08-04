import { ReserveBedSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class ReserveBedDto extends createZodDto(ReserveBedSchema) {}
