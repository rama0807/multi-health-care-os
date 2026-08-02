import { CancelInvoiceSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CancelInvoiceDto extends createZodDto(CancelInvoiceSchema) {}
