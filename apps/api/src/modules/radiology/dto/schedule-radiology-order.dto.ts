import { ScheduleRadiologyOrderSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class ScheduleRadiologyOrderDto extends createZodDto(ScheduleRadiologyOrderSchema) {}
