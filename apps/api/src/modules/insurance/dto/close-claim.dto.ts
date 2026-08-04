import { CloseClaimSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CloseClaimDto extends createZodDto(CloseClaimSchema) {}
