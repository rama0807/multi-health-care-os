import { CreateExternalRadiologyAttachmentSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateExternalRadiologyAttachmentDto extends createZodDto(CreateExternalRadiologyAttachmentSchema) {}
