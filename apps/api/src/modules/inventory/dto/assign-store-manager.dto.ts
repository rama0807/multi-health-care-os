import { AssignStoreManagerSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class AssignStoreManagerDto extends createZodDto(AssignStoreManagerSchema) {}
