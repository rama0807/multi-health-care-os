import { CreateStoreRequisitionSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateStoreRequisitionDto extends createZodDto(CreateStoreRequisitionSchema) {}
