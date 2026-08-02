import { InvoiceLineItemSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class AddInvoiceItemDto extends createZodDto(InvoiceLineItemSchema) {}
