import { RefreshTokenSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class RefreshTokenDto extends createZodDto(RefreshTokenSchema) {}
