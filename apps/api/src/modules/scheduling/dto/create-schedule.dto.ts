import { CreateDoctorScheduleSchema, UpdateDoctorScheduleVersionSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateDoctorScheduleDto extends createZodDto(CreateDoctorScheduleSchema) {}
export class UpdateDoctorScheduleVersionDto extends createZodDto(UpdateDoctorScheduleVersionSchema) {}
