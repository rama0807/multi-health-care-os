import { RejectStoreRequisitionSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class RejectStoreRequisitionDto extends createZodDto(RejectStoreRequisitionSchema) {}
