import { UpdateVendorSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateVendorDto extends createZodDto(UpdateVendorSchema) {}
