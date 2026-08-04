import { UpdateAssetSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateAssetDto extends createZodDto(UpdateAssetSchema) {}
