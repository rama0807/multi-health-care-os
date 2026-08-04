import { CreateNursingAssessmentSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateNursingAssessmentDto extends createZodDto(CreateNursingAssessmentSchema) {}
