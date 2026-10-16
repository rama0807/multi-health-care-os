import { CreateDentalStaffSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateDentalStaffDto extends createZodDto(CreateDentalStaffSchema) {}
