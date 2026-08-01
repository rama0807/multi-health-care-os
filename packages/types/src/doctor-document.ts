import { DoctorDocumentType } from './enums'

export interface DoctorDocument {
  id: string
  doctorId: string
  documentType: DoctorDocumentType
  fileName: string
  fileUrl: string
  mimeType: string
  fileSizeBytes: number
  uploadedAt: Date
}
