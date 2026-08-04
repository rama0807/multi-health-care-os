import {
  ApplyStaffLeaveSchema,
  DecideStaffLeaveSchema,
  UpsertHolidaySchema,
  UpsertLeaveTypeConfigSchema,
} from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class ApplyStaffLeaveDto extends createZodDto(ApplyStaffLeaveSchema) {}
export class DecideStaffLeaveDto extends createZodDto(DecideStaffLeaveSchema) {}
export class UpsertHolidayDto extends createZodDto(UpsertHolidaySchema) {}
export class UpsertLeaveTypeConfigDto extends createZodDto(UpsertLeaveTypeConfigSchema) {}
