import { RegisterOrganizationSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class RegisterOrganizationDto extends createZodDto(RegisterOrganizationSchema) {}
