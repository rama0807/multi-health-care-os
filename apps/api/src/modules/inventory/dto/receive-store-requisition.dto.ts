import { ReceiveStoreRequisitionSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class ReceiveStoreRequisitionDto extends createZodDto(ReceiveStoreRequisitionSchema) {}
