import { CancelAdmissionSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CancelAdmissionDto extends createZodDto(CancelAdmissionSchema) {}
