import { UpdateAppointmentStatusSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateAppointmentStatusDto extends createZodDto(UpdateAppointmentStatusSchema) {}
