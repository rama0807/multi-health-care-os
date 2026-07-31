import { CreateDoctorSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateDoctorDto extends createZodDto(CreateDoctorSchema) {}
