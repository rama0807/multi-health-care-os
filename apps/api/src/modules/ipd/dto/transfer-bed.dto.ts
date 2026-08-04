import { TransferBedSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class TransferBedDto extends createZodDto(TransferBedSchema) {}
