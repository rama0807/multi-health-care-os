import { CreateAiPromptTemplateSchema, GenerateAiContentSchema } from '@medicore/types'
import { createZodDto, ZodValidationPipe } from 'nestjs-zod'

export class CreateAiPromptTemplateDto extends createZodDto(CreateAiPromptTemplateSchema) {}

// `UpdateAiPromptTemplateSchema` is a plain object, so it gets a class DTO too.
export { UpdateAiPromptTemplateDto } from './update-prompt-template.dto'

/**
 * `GenerateAiContentSchema` is a discriminated union, which `createZodDto`
 * can't wrap (a union has no statically-known members to build a class from).
 * A per-parameter pipe validates against the schema directly instead, so the
 * union — and the per-feature narrowing it gives every downstream service —
 * survives intact.
 */
export const GenerateAiContentValidationPipe = new ZodValidationPipe(GenerateAiContentSchema)
