import { UpdateOrganizationSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateOrganizationDto extends createZodDto(UpdateOrganizationSchema) {}
