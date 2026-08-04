import { CreateVendorInvoiceSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateVendorInvoiceDto extends createZodDto(CreateVendorInvoiceSchema) {}
