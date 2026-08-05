import { OnboardHospitalSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class OnboardHospitalDto extends createZodDto(OnboardHospitalSchema) {}
