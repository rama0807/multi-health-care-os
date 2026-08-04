import { CreateVendorSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateVendorDto extends createZodDto(CreateVendorSchema) {}
