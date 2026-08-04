import { UpsertDischargeSummarySchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpsertDischargeSummaryDto extends createZodDto(UpsertDischargeSummarySchema) {}
