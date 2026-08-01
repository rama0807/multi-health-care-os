import { CreateWalkInAppointmentSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateWalkInAppointmentDto extends createZodDto(CreateWalkInAppointmentSchema) {}
