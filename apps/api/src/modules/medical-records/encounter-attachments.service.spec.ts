import { BadRequestException, NotFoundException } from '@nestjs/common'

import { EncounterAttachmentsService } from './encounter-attachments.service'

describe('EncounterAttachmentsService', () => {
  let prisma: { encounterAttachment: Record<string, jest.Mock> }
  let storageService: { upload: jest.Mock; delete: jest.Mock }
  let encountersService: { requireEncounter: jest.Mock }
  let configService: { get: jest.Mock }
  let service: EncounterAttachmentsService

  beforeEach(() => {
    prisma = { encounterAttachment: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), delete: jest.fn() } }
    storageService = {
      upload: jest.fn().mockResolvedValue('http://localhost:4000/uploads/encounters/org_1/enc_1/abc-report.pdf'),
      delete: jest.fn().mockResolvedValue(undefined),
    }
    encountersService = { requireEncounter: jest.fn().mockResolvedValue({ id: 'enc_1' }) }
    configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'storage.provider') return 'local'
        if (key === 'storage.local.publicUrl') return fallback ?? 'http://localhost:4000/uploads'
        return fallback
      }),
    }

    service = new EncounterAttachmentsService(
      prisma as never,
      storageService as never,
      encountersService as never,
      configService as never,
    )
  })

  describe('upload', () => {
    const validFile = { buffer: Buffer.from('fake'), fileName: 'report.pdf', mimeType: 'application/pdf', size: 100 }

    it('rejects an unsupported mime type', async () => {
      await expect(
        service.upload('org_1', 'enc_1', 'EXTERNAL_REPORT' as never, { ...validFile, mimeType: 'application/x-sh' }),
      ).rejects.toThrow(BadRequestException)
    })

    it('uploads via StorageService', async () => {
      prisma.encounterAttachment.create.mockResolvedValue({
        id: 'att_1',
        encounterId: 'enc_1',
        documentType: 'EXTERNAL_REPORT',
        fileName: 'report.pdf',
        fileUrl: 'http://localhost:4000/uploads/encounters/org_1/enc_1/abc-report.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 100,
        uploadedAt: new Date(),
      })

      const result = await service.upload('org_1', 'enc_1', 'EXTERNAL_REPORT' as never, validFile)

      expect(encountersService.requireEncounter).toHaveBeenCalledWith('org_1', 'enc_1')
      expect(result.documentType).toBe('EXTERNAL_REPORT')
    })
  })

  describe('delete', () => {
    it('throws NotFoundException for an unknown attachment', async () => {
      prisma.encounterAttachment.findFirst.mockResolvedValue(null)

      await expect(service.delete('org_1', 'enc_1', 'missing')).rejects.toThrow(NotFoundException)
    })

    it('deletes the storage object and the row', async () => {
      prisma.encounterAttachment.findFirst.mockResolvedValue({
        id: 'att_1',
        fileUrl: 'http://localhost:4000/uploads/encounters/org_1/enc_1/abc-report.pdf',
      })

      await service.delete('org_1', 'enc_1', 'att_1')

      expect(storageService.delete).toHaveBeenCalledWith('encounters/org_1/enc_1/abc-report.pdf')
      expect(prisma.encounterAttachment.delete).toHaveBeenCalledWith({ where: { id: 'att_1' } })
    })
  })
})
