import { StaffDocumentType } from './enums'

export interface StaffDocument {
  id: string
  staffId: string
  documentType: StaffDocumentType
  fileName: string
  fileUrl: string
  mimeType: string
  fileSizeBytes: number
  uploadedAt: Date
}
