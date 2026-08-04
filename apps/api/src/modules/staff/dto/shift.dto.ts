import {
  AssignShiftRosterSchema,
  BulkAssignShiftRosterSchema,
  CreateShiftSchema,
  UpdateShiftSchema,
} from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateShiftDto extends createZodDto(CreateShiftSchema) {}
export class UpdateShiftDto extends createZodDto(UpdateShiftSchema) {}
export class AssignShiftRosterDto extends createZodDto(AssignShiftRosterSchema) {}
export class BulkAssignShiftRosterDto extends createZodDto(BulkAssignShiftRosterSchema) {}
