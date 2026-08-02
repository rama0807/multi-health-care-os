import { CreateInvoiceSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateInvoiceDto extends createZodDto(CreateInvoiceSchema) {}
