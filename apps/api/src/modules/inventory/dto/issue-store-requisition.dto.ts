import { IssueStoreRequisitionSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class IssueStoreRequisitionDto extends createZodDto(IssueStoreRequisitionSchema) {}
