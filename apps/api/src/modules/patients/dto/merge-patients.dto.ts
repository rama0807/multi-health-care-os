import { MergePatientsSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class MergePatientsDto extends createZodDto(MergePatientsSchema) {}
