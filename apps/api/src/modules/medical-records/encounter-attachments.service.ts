import { EncounterAttachment, EncounterAttachmentType } from '@medicore/types'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  EncounterAttachment as PrismaEncounterAttachment,
  EncounterAttachmentType as PrismaEncounterAttachmentType,
} from '@prisma/client'
import { nanoid } from 'nanoid'

import { StorageService } from '../../common/storage/storage.service'
import { PrismaService } from '../../prisma/prisma.service'

import { EncountersService } from './encounters.service'

export interface UploadedFileInput {
  buffer: Buffer
  fileName: string
  mimeType: string
  size: number
}

const ALLOWED_ATTACHMENT_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024

@Injectable()
export class EncounterAttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly encountersService: EncountersService,
    private readonly configService: ConfigService,
  ) {}

  async list(organizationId: string, encounterId: string): Promise<EncounterAttachment[]> {
    await this.encountersService.requireEncounter(organizationId, encounterId)
    const attachments = await this.prisma.encounterAttachment.findMany({
      where: { encounterId },
      orderBy: { uploadedAt: 'desc' },
    })
    return attachments.map((a) => this.toResponse(a))
  }

  async upload(
    organizationId: string,
    encounterId: string,
    documentType: EncounterAttachmentType,
    file: UploadedFileInput,
  ): Promise<EncounterAttachment> {
    await this.encountersService.requireEncounter(organizationId, encounterId)

    if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(file.mimeType)) {
      throw new BadRequestException('Unsupported file type — allowed: PNG, JPEG, WEBP, PDF')
    }
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new BadRequestException('File exceeds the 10MB upload limit')
    }

    const key = `encounters/${organizationId}/${encounterId}/${nanoid()}-${sanitizeFileName(file.fileName)}`
    const fileUrl = await this.storageService.upload({ key, buffer: file.buffer, mimeType: file.mimeType })

    const attachment = await this.prisma.encounterAttachment.create({
      data: {
        encounterId,
        organizationId,
        documentType: documentType as unknown as PrismaEncounterAttachmentType,
        fileName: file.fileName,
        fileUrl,
        mimeType: file.mimeType,
        fileSizeBytes: file.size,
      },
    })

    return this.toResponse(attachment)
  }

  async delete(organizationId: string, encounterId: string, attachmentId: string): Promise<void> {
    const attachment = await this.prisma.encounterAttachment.findFirst({
      where: { id: attachmentId, encounterId, organizationId },
    })
    if (!attachment) throw new NotFoundException('Attachment not found')

    const key = this.extractStorageKey(attachment.fileUrl)
    if (key) await this.storageService.delete(key).catch(() => undefined)
    await this.prisma.encounterAttachment.delete({ where: { id: attachmentId } })
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

  private toResponse(attachment: PrismaEncounterAttachment): EncounterAttachment {
    return {
      id: attachment.id,
      encounterId: attachment.encounterId,
      documentType: attachment.documentType as unknown as EncounterAttachmentType,
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl,
      mimeType: attachment.mimeType,
      fileSizeBytes: attachment.fileSizeBytes,
      uploadedAt: attachment.uploadedAt,
    }
  }
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9_.-]/g, '_')
}
