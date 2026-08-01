import { UpdatePrescriptionStatusSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdatePrescriptionStatusDto extends createZodDto(UpdatePrescriptionStatusSchema) {}
