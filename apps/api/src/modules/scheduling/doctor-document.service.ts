import { DoctorDocument, DoctorDocumentType } from '@medicore/types'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { DoctorDocument as PrismaDoctorDocument, DoctorDocumentType as PrismaDoctorDocumentType } from '@prisma/client'
import { nanoid } from 'nanoid'

import { StorageService } from '../../common/storage/storage.service'
import { PrismaService } from '../../prisma/prisma.service'

import { DoctorRefService } from './doctor-ref.service'

export interface UploadedFileInput {
  buffer: Buffer
  fileName: string
  mimeType: string
  size: number
}

const ALLOWED_DOCUMENT_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024

@Injectable()
export class DoctorDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly doctorRef: DoctorRefService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {}

  async list(organizationId: string, doctorId: string): Promise<DoctorDocument[]> {
    await this.doctorRef.requireDoctor(organizationId, doctorId)
    const documents = await this.prisma.doctorDocument.findMany({
      where: { doctorId, organizationId },
      orderBy: { uploadedAt: 'desc' },
    })
    return documents.map((doc) => this.toResponse(doc))
  }

  async upload(
    organizationId: string,
    doctorId: string,
    documentType: DoctorDocumentType,
    file: UploadedFileInput,
    actorUserId?: string,
  ): Promise<DoctorDocument> {
    await this.doctorRef.requireDoctor(organizationId, doctorId)

    if (!ALLOWED_DOCUMENT_MIME_TYPES.has(file.mimeType)) {
      throw new BadRequestException('Unsupported file type - allowed: PNG, JPEG, WEBP, PDF')
    }
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      throw new BadRequestException('File exceeds the 10MB upload limit')
    }

    const key = `doctors/${organizationId}/${doctorId}/${nanoid()}-${sanitizeFileName(file.fileName)}`
    const fileUrl = await this.storageService.upload({ key, buffer: file.buffer, mimeType: file.mimeType })

    const document = await this.prisma.doctorDocument.create({
      data: {
        doctorId,
        organizationId,
        documentType: documentType as unknown as PrismaDoctorDocumentType,
        fileName: file.fileName,
        fileUrl,
        mimeType: file.mimeType,
        fileSizeBytes: file.size,
      },
    })

    this.eventEmitter.emit('doctor.document_uploaded', {
      doctorId,
      organizationId,
      userId: actorUserId,
      documentId: document.id,
    })

    return this.toResponse(document)
  }

  async delete(organizationId: string, doctorId: string, documentId: string, actorUserId?: string): Promise<void> {
    const document = await this.prisma.doctorDocument.findFirst({
      where: { id: documentId, doctorId, organizationId },
    })
    if (!document) throw new NotFoundException('Document not found')

    const key = this.extractStorageKey(document.fileUrl)
    if (key) await this.storageService.delete(key).catch(() => undefined)

    await this.prisma.doctorDocument.delete({ where: { id: documentId } })

    this.eventEmitter.emit('doctor.document_deleted', {
      doctorId,
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

  private toResponse(document: PrismaDoctorDocument): DoctorDocument {
    return {
      id: document.id,
      doctorId: document.doctorId,
      documentType: document.documentType as unknown as DoctorDocumentType,
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
