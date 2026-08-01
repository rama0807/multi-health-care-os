import { CreateRecurringAppointmentSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateRecurringAppointmentDto extends createZodDto(CreateRecurringAppointmentSchema) {}
