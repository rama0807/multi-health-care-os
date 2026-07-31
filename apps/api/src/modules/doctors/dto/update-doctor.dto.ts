import { UpdateDoctorSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateDoctorDto extends createZodDto(UpdateDoctorSchema) {}
