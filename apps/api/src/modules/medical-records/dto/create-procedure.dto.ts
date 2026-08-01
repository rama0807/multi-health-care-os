import { CreateProcedureSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateProcedureDto extends createZodDto(CreateProcedureSchema) {}
