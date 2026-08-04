import { BadRequestException } from '@nestjs/common'

import { ClaimDocumentsService } from './claim-documents.service'

describe('ClaimDocumentsService', () => {
  let prisma: {
    claimDocument: Record<string, jest.Mock>
    prescription: Record<string, jest.Mock>
    labTest: Record<string, jest.Mock>
    radiologyOrder: Record<string, jest.Mock>
    encounter: Record<string, jest.Mock>
  }
  let storageService: { upload: jest.Mock }
  let invoicesService: { generatePdf: jest.Mock }
  let prescriptionsService: { generatePdf: jest.Mock }
  let labTestsService: { generateReportPdf: jest.Mock }
  let radiologyOrdersService: { generateReportPdf: jest.Mock }
  let service: ClaimDocumentsService

  beforeEach(() => {
    prisma = {
      claimDocument: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue({ id: 'doc_1' }) },
      prescription: { findMany: jest.fn().mockResolvedValue([]) },
      labTest: { findMany: jest.fn().mockResolvedValue([]) },
      radiologyOrder: { findMany: jest.fn().mockResolvedValue([]) },
      encounter: {
        findFirstOrThrow: jest.fn().mockResolvedValue({
          id: 'enc_1',
          type: 'OPD',
          status: 'COMPLETED',
          createdAt: new Date('2026-08-03'),
          organization: { name: 'MediCore', address: null, phone: '123', email: 'a@b.com' },
          doctor: { specialization: 'Cardiology', user: { firstName: 'Priya', lastName: 'Sharma' } },
          patient: { firstName: 'Jane', lastName: 'Doe', uhid: 'MED-1' },
          clinicalNotes: [],
          diagnoses: [],
          vitals: [],
          procedures: [],
        }),
      },
    }
    storageService = { upload: jest.fn().mockResolvedValue('https://cdn/claims/file.pdf') }
    invoicesService = { generatePdf: jest.fn().mockResolvedValue({ buffer: Buffer.from('x'), fileName: 'invoice.pdf' }) }
    prescriptionsService = { generatePdf: jest.fn() }
    labTestsService = { generateReportPdf: jest.fn() }
    radiologyOrdersService = { generateReportPdf: jest.fn() }
    service = new ClaimDocumentsService(
      prisma as never,
      storageService as never,
      invoicesService as never,
      prescriptionsService as never,
      labTestsService as never,
      radiologyOrdersService as never,
    )
  })

  describe('autoAttachForClaim', () => {
    it('attaches the invoice PDF and the encounter summary', async () => {
      await service.autoAttachForClaim('org_1', 'claim_1', 'enc_1', 'inv_1')

      expect(invoicesService.generatePdf).toHaveBeenCalledWith('org_1', 'inv_1')
      expect(storageService.upload).toHaveBeenCalled()
      expect(prisma.claimDocument.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'INVOICE', autoAttached: true }) }),
      )
    })

    it('skips a document instead of throwing when a generator fails', async () => {
      invoicesService.generatePdf.mockRejectedValue(new Error('boom'))

      await expect(service.autoAttachForClaim('org_1', 'claim_1', 'enc_1', 'inv_1')).resolves.toBeUndefined()
      expect(prisma.claimDocument.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'INVOICE' }) }),
      )
    })
  })

  describe('uploadManual', () => {
    it('rejects an unsupported mime type', async () => {
      await expect(
        service.uploadManual('org_1', 'claim_1', 'MANUAL_UPLOAD' as never, {
          buffer: Buffer.from('x'),
          fileName: 'a.exe',
          mimeType: 'application/x-msdownload',
          size: 1,
        }, 'user_1'),
      ).rejects.toThrow(BadRequestException)
    })

    it('uploads a valid document', async () => {
      const result = await service.uploadManual(
        'org_1',
        'claim_1',
        'MANUAL_UPLOAD' as never,
        { buffer: Buffer.from('x'), fileName: 'report.pdf', mimeType: 'application/pdf', size: 1 },
        'user_1',
      )
      expect(storageService.upload).toHaveBeenCalled()
      expect(result).toBeDefined()
    })
  })
})
