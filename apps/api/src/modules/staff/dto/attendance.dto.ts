import { ClockInSchema, ClockOutSchema, CorrectAttendanceSchema, MarkAttendanceSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class ClockInDto extends createZodDto(ClockInSchema) {}
export class ClockOutDto extends createZodDto(ClockOutSchema) {}
export class MarkAttendanceDto extends createZodDto(MarkAttendanceSchema) {}
export class CorrectAttendanceDto extends createZodDto(CorrectAttendanceSchema) {}
