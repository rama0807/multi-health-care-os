import { SettleClaimSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class SettleClaimDto extends createZodDto(SettleClaimSchema) {}
