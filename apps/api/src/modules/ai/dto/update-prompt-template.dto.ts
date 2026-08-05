import { UpdateAiPromptTemplateSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateAiPromptTemplateDto extends createZodDto(UpdateAiPromptTemplateSchema) {}
