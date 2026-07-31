import { CreateHospitalSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateHospitalDto extends createZodDto(CreateHospitalSchema) {}
