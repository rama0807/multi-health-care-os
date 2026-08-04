import { UpdateVendorInvoiceStatusSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateVendorInvoiceStatusDto extends createZodDto(UpdateVendorInvoiceStatusSchema) {}
