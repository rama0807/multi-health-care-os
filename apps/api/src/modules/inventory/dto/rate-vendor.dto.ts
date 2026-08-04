import { RateVendorSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class RateVendorDto extends createZodDto(RateVendorSchema) {}
