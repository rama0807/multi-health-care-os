import { CreateGoodsReceiptNoteSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateGoodsReceiptNoteDto extends createZodDto(CreateGoodsReceiptNoteSchema) {}
