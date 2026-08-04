import { UploadClaimDocumentMetaSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UploadClaimDocumentMetaDto extends createZodDto(UploadClaimDocumentMetaSchema) {}
