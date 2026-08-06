import { StaffDocument, StaffDocumentType } from '@medicore/types'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { StaffDocument as PrismaStaffDocument, StaffDocumentType as PrismaStaffDocumentType } from '@prisma/client'
import { nanoid } from 'nanoid'

import { StorageService } from '../../common/storage/storage.service'
import { PrismaService } from '../../prisma/prisma.service'

import { StaffRefService } from './staff-ref.service'

export interface UploadedFileInput {
  buffer: Buffer
  fileName: string
  mimeType: string
  size: number
}

const ALLOWED_DOCUMENT_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024

@Injectable()
export class StaffDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly staffRef: StaffRefService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {}

  async list(organizationId: string, staffId: string): Promise<StaffDocument[]> {
    await this.staffRef.requireStaff(organizationId, staffId)
    const documents = await this.prisma.staffDocument.findMany({
      where: { staffId, organizationId },
      orderBy: { uploadedAt: 'desc' },
    })
    return documents.map((doc) => this.toResponse(doc))
  }

  async upload(
    organizationId: string,
    staffId: string,
    documentType: StaffDocumentType,
    file: UploadedFileInput,
    actorUserId?: string,
  ): Promise<StaffDocument> {
    await this.staffRef.requireStaff(organizationId, staffId)

    if (!ALLOWED_DOCUMENT_MIME_TYPES.has(file.mimeType)) {
      throw new BadRequestException('Unsupported file type - allowed: PNG, JPEG, WEBP, PDF')
    }
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      throw new BadRequestException('File exceeds the 10MB upload limit')
    }

    const key = `staff/${organizationId}/${staffId}/${nanoid()}-${sanitizeFileName(file.fileName)}`
    const fileUrl = await this.storageService.upload({ key, buffer: file.buffer, mimeType: file.mimeType })

    const document = await this.prisma.staffDocument.create({
      data: {
        staffId,
        organizationId,
        documentType: documentType as unknown as PrismaStaffDocumentType,
        fileName: file.fileName,
        fileUrl,
        mimeType: file.mimeType,
        fileSizeBytes: file.size,
      },
    })

    this.eventEmitter.emit('staff.document_uploaded', {
      staffId,
      organizationId,
      userId: actorUserId,
      documentId: document.id,
    })

    return this.toResponse(document)
  }

  async delete(organizationId: string, staffId: string, documentId: string, actorUserId?: string): Promise<void> {
    const document = await this.prisma.staffDocument.findFirst({
      where: { id: documentId, staffId, organizationId },
    })
    if (!document) throw new NotFoundException('Document not found')

    const key = this.extractStorageKey(document.fileUrl)
    if (key) await this.storageService.delete(key).catch(() => undefined)

    await this.prisma.staffDocument.delete({ where: { id: documentId } })

    this.eventEmitter.emit('staff.document_deleted', {
      staffId,
      organizationId,
      userId: actorUserId,
      documentId,
    })
  }

  private extractStorageKey(fileUrl: string): string | null {
    const provider = this.configService.get<string>('storage.provider')
    const base =
      provider === 's3'
        ? this.configService.get<string>('storage.s3.publicUrl')
        : this.configService.get<string>('storage.local.publicUrl', 'http://localhost:4000/uploads')

    if (base && fileUrl.startsWith(`${base}/`)) return fileUrl.slice(base.length + 1)
    return null
  }

  private toResponse(document: PrismaStaffDocument): StaffDocument {
    return {
      id: document.id,
      staffId: document.staffId,
      documentType: document.documentType as unknown as StaffDocumentType,
      fileName: document.fileName,
      fileUrl: document.fileUrl,
      mimeType: document.mimeType,
      fileSizeBytes: document.fileSizeBytes,
      uploadedAt: document.uploadedAt,
    }
  }
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9_.-]/g, '_')
}
