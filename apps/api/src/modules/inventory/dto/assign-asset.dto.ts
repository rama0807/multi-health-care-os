import { AssignAssetSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class AssignAssetDto extends createZodDto(AssignAssetSchema) {}
