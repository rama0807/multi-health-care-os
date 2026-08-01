import { CreateAppointmentSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateAppointmentDto extends createZodDto(CreateAppointmentSchema) {}
