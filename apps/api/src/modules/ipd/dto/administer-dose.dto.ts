import { AdministerDoseSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class AdministerDoseDto extends createZodDto(AdministerDoseSchema) {}
