import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'

import { PreAuthorizationService } from './pre-authorization.service'

function decimal(value: string) {
  return { toString: () => value }
}

function buildPreAuthRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'pa_1',
    authNumber: 'PA-2026-000001',
    organizationId: 'org_1',
    patientId: 'pat_1',
    encounterId: 'enc_1',
    patientInsuranceId: 'cov_1',
    status: 'DRAFT',
    clinicalNotes: null,
    doctorNotes: null,
    requestedAmount: decimal('10000'),
    approvedAmount: null,
    rejectionReason: null,
    submittedAt: null,
    decidedAt: null,
    decidedByUserId: null,
    createdByUserId: 'user_1',
    createdAt: new Date('2026-08-03'),
    updatedAt: new Date('2026-08-03'),
    patient: { id: 'pat_1', firstName: 'Jane', lastName: 'Doe', uhid: 'MED-2026-000001' },
    patientInsurance: { id: 'cov_1', memberId: 'MEM-1', policyNumber: 'POL-1', provider: { id: 'prov_1', name: 'Acme' } },
    attachments: [],
    ...overrides,
  }
}

describe('PreAuthorizationService', () => {
  let prisma: {
    preAuthorization: Record<string, jest.Mock>
    preAuthAttachment: Record<string, jest.Mock>
    $transaction: jest.Mock
  }
  let encountersService: { requireEncounter: jest.Mock }
  let patientInsuranceService: { requireActiveCoverage: jest.Mock }
  let storageService: { upload: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let service: PreAuthorizationService

  beforeEach(() => {
    prisma = {
      preAuthorization: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
      preAuthAttachment: { create: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb({ $executeRaw: jest.fn(), preAuthorization: prisma.preAuthorization })),
    }
    encountersService = { requireEncounter: jest.fn().mockResolvedValue({ id: 'enc_1', patientId: 'pat_1' }) }
    patientInsuranceService = { requireActiveCoverage: jest.fn().mockResolvedValue({ id: 'cov_1', patientId: 'pat_1' }) }
    storageService = { upload: jest.fn().mockResolvedValue('https://cdn/preauth/file.pdf') }
    eventEmitter = { emit: jest.fn() }
    service = new PreAuthorizationService(
      prisma as never,
      encountersService as never,
      patientInsuranceService as never,
      storageService as never,
      eventEmitter as never,
    )
  })

  describe('create', () => {
    it('creates a pre-authorization when the coverage matches the encounter patient', async () => {
      prisma.preAuthorization.create.mockResolvedValue(buildPreAuthRow())

      const result = await service.create(
        'org_1',
        { encounterId: 'enc_1', patientInsuranceId: 'cov_1', requestedAmount: 10000 },
        'user_1',
      )

      expect(result.authNumber).toBe('PA-2026-000001')
      expect(eventEmitter.emit).toHaveBeenCalledWith('insurance.preauth_created', expect.objectContaining({ preAuthId: 'pa_1' }))
    })

    it('rejects when the coverage belongs to a different patient', async () => {
      patientInsuranceService.requireActiveCoverage.mockResolvedValue({ id: 'cov_1', patientId: 'other_patient' })

      await expect(
        service.create('org_1', { encounterId: 'enc_1', patientInsuranceId: 'cov_1', requestedAmount: 10000 }, 'user_1'),
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe('submit', () => {
    it('transitions DRAFT to SUBMITTED', async () => {
      prisma.preAuthorization.findFirst.mockResolvedValueOnce(buildPreAuthRow()).mockResolvedValueOnce(buildPreAuthRow({ status: 'SUBMITTED' }))
      prisma.preAuthorization.update.mockResolvedValue(buildPreAuthRow({ status: 'SUBMITTED' }))

      const result = await service.submit('org_1', 'pa_1', 'user_1')
      expect(result.status).toBe('SUBMITTED')
    })

    it('rejects submitting an already-submitted pre-authorization', async () => {
      prisma.preAuthorization.findFirst.mockResolvedValue(buildPreAuthRow({ status: 'SUBMITTED' }))

      await expect(service.submit('org_1', 'pa_1', 'user_1')).rejects.toThrow(ConflictException)
    })
  })

  describe('decide', () => {
    it('requires an approvedAmount when approving', async () => {
      prisma.preAuthorization.findFirst.mockResolvedValue(buildPreAuthRow({ status: 'UNDER_REVIEW' }))

      await expect(
        service.decide('org_1', 'pa_1', { status: 'APPROVED' } as never, 'user_1'),
      ).rejects.toThrow(BadRequestException)
    })

    it('rejects deciding from a state that has already resolved', async () => {
      prisma.preAuthorization.findFirst.mockResolvedValue(buildPreAuthRow({ status: 'APPROVED' }))

      await expect(
        service.decide('org_1', 'pa_1', { status: 'REJECTED', rejectionReason: 'no' } as never, 'user_1'),
      ).rejects.toThrow(ConflictException)
    })

    it('approves when transitioning from UNDER_REVIEW with an approvedAmount', async () => {
      prisma.preAuthorization.findFirst
        .mockResolvedValueOnce(buildPreAuthRow({ status: 'UNDER_REVIEW' }))
        .mockResolvedValueOnce(buildPreAuthRow({ status: 'APPROVED', approvedAmount: decimal('9000') }))
      prisma.preAuthorization.update.mockResolvedValue(buildPreAuthRow({ status: 'APPROVED' }))

      const result = await service.decide('org_1', 'pa_1', { status: 'APPROVED', approvedAmount: 9000 } as never, 'user_1')
      expect(result.status).toBe('APPROVED')
    })
  })

  describe('requirePreAuthorization', () => {
    it('throws NotFoundException when missing', async () => {
      prisma.preAuthorization.findFirst.mockResolvedValue(null)
      await expect(service.requirePreAuthorization('org_1', 'missing')).rejects.toThrow(NotFoundException)
    })
  })

  describe('uploadAttachment', () => {
    it('rejects an unsupported mime type', async () => {
      prisma.preAuthorization.findFirst.mockResolvedValue(buildPreAuthRow())

      await expect(
        service.uploadAttachment(
          'org_1',
          'pa_1',
          { buffer: Buffer.from('x'), fileName: 'a.exe', mimeType: 'application/x-msdownload', size: 1 },
          'user_1',
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('uploads a valid attachment', async () => {
      prisma.preAuthorization.findFirst
        .mockResolvedValueOnce(buildPreAuthRow())
        .mockResolvedValueOnce(buildPreAuthRow({ attachments: [{ id: 'att_1' }] }))
      prisma.preAuthAttachment.create.mockResolvedValue({ id: 'att_1' })

      const result = await service.uploadAttachment(
        'org_1',
        'pa_1',
        { buffer: Buffer.from('x'), fileName: 'report.pdf', mimeType: 'application/pdf', size: 1 },
        'user_1',
      )
      expect(storageService.upload).toHaveBeenCalled()
      expect(result.attachments).toHaveLength(1)
    })
  })
})
