import { RecordVendorInvoicePaymentSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class RecordVendorInvoicePaymentDto extends createZodDto(RecordVendorInvoicePaymentSchema) {}
