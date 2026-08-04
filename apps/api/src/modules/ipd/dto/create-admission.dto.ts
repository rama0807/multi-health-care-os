import { CreateAdmissionSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateAdmissionDto extends createZodDto(CreateAdmissionSchema) {}
