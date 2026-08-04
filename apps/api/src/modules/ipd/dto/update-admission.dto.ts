import { UpdateAdmissionSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateAdmissionDto extends createZodDto(UpdateAdmissionSchema) {}
