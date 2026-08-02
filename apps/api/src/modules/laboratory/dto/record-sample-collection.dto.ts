import { RecordSampleCollectionSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class RecordSampleCollectionDto extends createZodDto(RecordSampleCollectionSchema) {}
