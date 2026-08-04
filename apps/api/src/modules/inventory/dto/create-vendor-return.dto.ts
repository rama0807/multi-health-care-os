import { CreateVendorReturnSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateVendorReturnDto extends createZodDto(CreateVendorReturnSchema) {}
