import { SuspendOrganizationSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class SuspendOrganizationDto extends createZodDto(SuspendOrganizationSchema) {}
