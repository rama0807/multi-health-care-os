import { UpdateHospitalSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateHospitalDto extends createZodDto(UpdateHospitalSchema) {}
