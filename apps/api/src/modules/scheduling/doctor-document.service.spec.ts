import { BadRequestException, NotFoundException } from '@nestjs/common'

import { DoctorDocumentService } from './doctor-document.service'

function buildDocumentRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'doc_1',
    doctorId: 'doctor_1',
    organizationId: 'org_1',
    documentType: 'MEDICAL_LICENSE',
    fileName: 'license.pdf',
    fileUrl: 'http://localhost:4000/uploads/doctors/org_1/doctor_1/abc-license.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 1024,
    uploadedAt: new Date('2026-08-01'),
    ...overrides,
  }
}

describe('DoctorDocumentService', () => {
  let prisma: { doctorDocument: Record<string, jest.Mock> }
  let storageService: { upload: jest.Mock; delete: jest.Mock }
  let doctorRef: { requireDoctor: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let configService: { get: jest.Mock }
  let service: DoctorDocumentService

  beforeEach(() => {
    prisma = {
      doctorDocument: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    }
    storageService = {
      upload: jest.fn().mockResolvedValue('http://localhost:4000/uploads/doctors/org_1/doctor_1/abc-license.pdf'),
      delete: jest.fn().mockResolvedValue(undefined),
    }
    doctorRef = { requireDoctor: jest.fn().mockResolvedValue({ id: 'doctor_1' }) }
    eventEmitter = { emit: jest.fn() }
    configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'storage.provider') return 'local'
        if (key === 'storage.local.publicUrl') return fallback ?? 'http://localhost:4000/uploads'
        return fallback
      }),
    }

    service = new DoctorDocumentService(
      prisma as never,
      storageService as never,
      doctorRef as never,
      eventEmitter as never,
      configService as never,
    )
  })

  afterEach(() => jest.clearAllMocks())

  describe('list', () => {
    it('returns documents for the doctor', async () => {
      prisma.doctorDocument.findMany.mockResolvedValue([buildDocumentRow()])

      const result = await service.list('org_1', 'doctor_1')

      expect(doctorRef.requireDoctor).toHaveBeenCalledWith('org_1', 'doctor_1')
      expect(result).toHaveLength(1)
      expect(result[0].fileName).toBe('license.pdf')
    })
  })

  describe('upload', () => {
    const validFile = { buffer: Buffer.from('fake'), fileName: 'license.pdf', mimeType: 'application/pdf', size: 100 }

    it('rejects an unsupported mime type', async () => {
      await expect(
        service.upload('org_1', 'doctor_1', 'MEDICAL_LICENSE' as never, {
          ...validFile,
          mimeType: 'application/x-sh',
        }),
      ).rejects.toThrow(BadRequestException)
      expect(prisma.doctorDocument.create).not.toHaveBeenCalled()
    })

    it('rejects a file over the size limit', async () => {
      await expect(
        service.upload('org_1', 'doctor_1', 'MEDICAL_LICENSE' as never, {
          ...validFile,
          size: 11 * 1024 * 1024,
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('uploads via StorageService and emits doctor.document_uploaded', async () => {
      prisma.doctorDocument.create.mockResolvedValue(buildDocumentRow())

      const result = await service.upload('org_1', 'doctor_1', 'MEDICAL_LICENSE' as never, validFile, 'actor_1')

      expect(storageService.upload).toHaveBeenCalledWith(
        expect.objectContaining({ mimeType: 'application/pdf' }),
      )
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'doctor.document_uploaded',
        expect.objectContaining({ doctorId: 'doctor_1', organizationId: 'org_1', userId: 'actor_1' }),
      )
      expect(result.id).toBe('doc_1')
    })
  })

  describe('delete', () => {
    it('throws NotFoundException for an unknown document', async () => {
      prisma.doctorDocument.findFirst.mockResolvedValue(null)

      await expect(service.delete('org_1', 'doctor_1', 'missing')).rejects.toThrow(NotFoundException)
      expect(prisma.doctorDocument.delete).not.toHaveBeenCalled()
    })

    it('deletes the storage object + row and emits doctor.document_deleted', async () => {
      prisma.doctorDocument.findFirst.mockResolvedValue(buildDocumentRow())

      await service.delete('org_1', 'doctor_1', 'doc_1', 'actor_1')

      expect(storageService.delete).toHaveBeenCalledWith('doctors/org_1/doctor_1/abc-license.pdf')
      expect(prisma.doctorDocument.delete).toHaveBeenCalledWith({ where: { id: 'doc_1' } })
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'doctor.document_deleted',
        expect.objectContaining({ doctorId: 'doctor_1', organizationId: 'org_1', userId: 'actor_1' }),
      )
    })
  })
})
