import { CreateAssetSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateAssetDto extends createZodDto(CreateAssetSchema) {}
