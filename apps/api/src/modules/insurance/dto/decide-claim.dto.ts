import { DecideClaimSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class DecideClaimDto extends createZodDto(DecideClaimSchema) {}
