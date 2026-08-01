import { CreatePrescriptionSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreatePrescriptionDto extends createZodDto(CreatePrescriptionSchema) {}
