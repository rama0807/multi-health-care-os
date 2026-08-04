import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'

import { InsuranceClaimsService } from './insurance-claims.service'

function decimal(value: string) {
  return { toString: () => value, valueOf: () => Number(value) }
}

function buildClaimRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'claim_1',
    claimNumber: 'CLM-2026-000001',
    patientId: 'pat_1',
    invoiceId: 'inv_1',
    encounterId: 'enc_1',
    organizationId: 'org_1',
    providerId: 'prov_1',
    planId: 'plan_1',
    patientInsuranceId: 'cov_1',
    preAuthorizationId: null,
    insuranceProvider: 'Acme Insurance',
    policyNumber: 'POL-1',
    membershipId: 'MEM-1',
    claimedAmount: decimal('10000'),
    approvedAmount: null,
    rejectedAmount: null,
    insuranceShare: null,
    patientShare: null,
    adjustmentAmount: decimal('0'),
    writeOffAmount: decimal('0'),
    outstandingAmount: null,
    paymentStatus: 'PENDING',
    status: 'DRAFT',
    rejectionReason: null,
    submittedAt: null,
    settledAt: null,
    closedAt: null,
    createdByUserId: 'user_1',
    createdAt: new Date('2026-08-03'),
    updatedAt: new Date('2026-08-03'),
    patient: { id: 'pat_1', firstName: 'Jane', lastName: 'Doe', uhid: 'MED-2026-000001' },
    invoice: { id: 'inv_1', invoiceNumber: 'INV-2026-000001', totalAmount: decimal('10000'), balanceDue: decimal('10000') },
    documents: [],
    ...overrides,
  }
}

describe('InsuranceClaimsService', () => {
  let prisma: {
    insuranceClaim: Record<string, jest.Mock>
    invoice: Record<string, jest.Mock>
    $transaction: jest.Mock
  }
  let encountersService: { requireEncounter: jest.Mock }
  let patientInsuranceService: { requireActiveCoverage: jest.Mock }
  let preAuthorizationService: { requirePreAuthorization: jest.Mock }
  let claimDocumentsService: { autoAttachForClaim: jest.Mock; uploadManual: jest.Mock }
  let paymentsService: { create: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let service: InsuranceClaimsService

  beforeEach(() => {
    prisma = {
      insuranceClaim: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
      invoice: { findFirst: jest.fn().mockResolvedValue({ id: 'inv_1', patientId: 'pat_1' }) },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb({ $executeRaw: jest.fn(), insuranceClaim: prisma.insuranceClaim })),
    }
    encountersService = { requireEncounter: jest.fn().mockResolvedValue({ id: 'enc_1', patientId: 'pat_1' }) }
    patientInsuranceService = {
      requireActiveCoverage: jest.fn().mockResolvedValue({
        id: 'cov_1',
        patientId: 'pat_1',
        providerId: 'prov_1',
        planId: 'plan_1',
        policyNumber: 'POL-1',
        memberId: 'MEM-1',
        provider: { name: 'Acme Insurance' },
      }),
    }
    preAuthorizationService = { requirePreAuthorization: jest.fn() }
    claimDocumentsService = { autoAttachForClaim: jest.fn().mockResolvedValue(undefined), uploadManual: jest.fn() }
    paymentsService = { create: jest.fn().mockResolvedValue({ id: 'pay_1' }) }
    eventEmitter = { emit: jest.fn() }
    service = new InsuranceClaimsService(
      prisma as never,
      encountersService as never,
      patientInsuranceService as never,
      preAuthorizationService as never,
      claimDocumentsService as never,
      paymentsService as never,
      eventEmitter as never,
    )
  })

  describe('create', () => {
    it('creates a claim and auto-attaches documents', async () => {
      prisma.insuranceClaim.findUnique.mockResolvedValue(null)
      prisma.insuranceClaim.create.mockResolvedValue(buildClaimRow())
      prisma.insuranceClaim.findFirst.mockResolvedValue(buildClaimRow())

      const result = await service.create(
        'org_1',
        { encounterId: 'enc_1', invoiceId: 'inv_1', patientInsuranceId: 'cov_1', claimedAmount: 10000 },
        'user_1',
      )

      expect(result.claimNumber).toBe('CLM-2026-000001')
      expect(claimDocumentsService.autoAttachForClaim).toHaveBeenCalledWith('org_1', 'claim_1', 'enc_1', 'inv_1')
      expect(eventEmitter.emit).toHaveBeenCalledWith('insurance.claim_created', expect.objectContaining({ claimId: 'claim_1' }))
    })

    it('rejects when the invoice already has a claim', async () => {
      prisma.insuranceClaim.findUnique.mockResolvedValue(buildClaimRow())

      await expect(
        service.create(
          'org_1',
          { encounterId: 'enc_1', invoiceId: 'inv_1', patientInsuranceId: 'cov_1', claimedAmount: 10000 },
          'user_1',
        ),
      ).rejects.toThrow(ConflictException)
    })

    it('rejects when the invoice belongs to a different patient than the encounter', async () => {
      prisma.invoice.findFirst.mockResolvedValue({ id: 'inv_1', patientId: 'other_patient' })

      await expect(
        service.create(
          'org_1',
          { encounterId: 'enc_1', invoiceId: 'inv_1', patientInsuranceId: 'cov_1', claimedAmount: 10000 },
          'user_1',
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('throws NotFoundException when the invoice does not exist', async () => {
      prisma.invoice.findFirst.mockResolvedValue(null)

      await expect(
        service.create(
          'org_1',
          { encounterId: 'enc_1', invoiceId: 'missing', patientInsuranceId: 'cov_1', claimedAmount: 10000 },
          'user_1',
        ),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('decide', () => {
    it('requires an approvedAmount when approving', async () => {
      prisma.insuranceClaim.findFirst.mockResolvedValue(buildClaimRow({ status: 'UNDER_REVIEW' }))

      await expect(service.decide('org_1', 'claim_1', { status: 'APPROVED' } as never, 'user_1')).rejects.toThrow(
        BadRequestException,
      )
    })

    it('requires a rejectionReason when rejecting', async () => {
      prisma.insuranceClaim.findFirst.mockResolvedValue(buildClaimRow({ status: 'UNDER_REVIEW' }))

      await expect(service.decide('org_1', 'claim_1', { status: 'REJECTED' } as never, 'user_1')).rejects.toThrow(
        BadRequestException,
      )
    })

    it('rejects an approvedAmount above the claimed amount', async () => {
      prisma.insuranceClaim.findFirst.mockResolvedValue(buildClaimRow({ status: 'UNDER_REVIEW' }))

      await expect(
        service.decide('org_1', 'claim_1', { status: 'APPROVED', approvedAmount: 20000 } as never, 'user_1'),
      ).rejects.toThrow(BadRequestException)
    })

    it('computes the rejected remainder on partial approval', async () => {
      prisma.insuranceClaim.findFirst
        .mockResolvedValueOnce(buildClaimRow({ status: 'UNDER_REVIEW' }))
        .mockResolvedValueOnce(buildClaimRow({ status: 'PARTIALLY_APPROVED' }))

      await service.decide('org_1', 'claim_1', { status: 'PARTIALLY_APPROVED', approvedAmount: 7000 } as never, 'user_1')

      expect(prisma.insuranceClaim.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ rejectedAmount: 3000 }) }),
      )
    })

    it('rejects deciding a claim that is not under review', async () => {
      prisma.insuranceClaim.findFirst.mockResolvedValue(buildClaimRow({ status: 'DRAFT' }))

      await expect(
        service.decide('org_1', 'claim_1', { status: 'APPROVED', approvedAmount: 5000 } as never, 'user_1'),
      ).rejects.toThrow(ConflictException)
    })
  })

  describe('settle', () => {
    it('rejects settling a claim that is not approved', async () => {
      prisma.insuranceClaim.findFirst.mockResolvedValue(buildClaimRow({ status: 'DRAFT' }))

      await expect(
        service.settle('org_1', 'claim_1', { insuranceShare: 8000, patientShare: 0, adjustmentAmount: 0, writeOffAmount: 0 }, 'user_1'),
      ).rejects.toThrow(ConflictException)
    })

    it('fully settles a claim when the shares cover the claimed amount', async () => {
      prisma.insuranceClaim.findFirst
        .mockResolvedValueOnce(buildClaimRow({ status: 'APPROVED', claimedAmount: decimal('10000') }))
        .mockResolvedValueOnce(buildClaimRow({ status: 'SETTLED' }))

      await service.settle(
        'org_1',
        'claim_1',
        { insuranceShare: 8000, patientShare: 2000, adjustmentAmount: 0, writeOffAmount: 0 },
        'user_1',
      )

      expect(prisma.insuranceClaim.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'SETTLED', outstandingAmount: 0, paymentStatus: 'PAID' }) }),
      )
      expect(paymentsService.create).toHaveBeenCalledWith(
        'org_1',
        'inv_1',
        expect.objectContaining({ amount: 8000, paymentMode: 'INSURANCE' }),
        'user_1',
      )
    })

    it('partially settles when an outstanding balance remains', async () => {
      prisma.insuranceClaim.findFirst
        .mockResolvedValueOnce(buildClaimRow({ status: 'APPROVED', claimedAmount: decimal('10000') }))
        .mockResolvedValueOnce(buildClaimRow({ status: 'PARTIALLY_SETTLED' }))

      await service.settle(
        'org_1',
        'claim_1',
        { insuranceShare: 5000, patientShare: 0, adjustmentAmount: 0, writeOffAmount: 0 },
        'user_1',
      )

      expect(prisma.insuranceClaim.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PARTIALLY_SETTLED', outstandingAmount: 5000, paymentStatus: 'PARTIAL' }),
        }),
      )
    })

    it('does not record a payment when the insurance share is zero', async () => {
      prisma.insuranceClaim.findFirst
        .mockResolvedValueOnce(buildClaimRow({ status: 'APPROVED', claimedAmount: decimal('10000') }))
        .mockResolvedValueOnce(buildClaimRow({ status: 'PARTIALLY_SETTLED' }))

      await service.settle(
        'org_1',
        'claim_1',
        { insuranceShare: 0, patientShare: 0, adjustmentAmount: 0, writeOffAmount: 0 },
        'user_1',
      )

      expect(paymentsService.create).not.toHaveBeenCalled()
    })
  })

  describe('close', () => {
    it('rejects closing a claim still in review', async () => {
      prisma.insuranceClaim.findFirst.mockResolvedValue(buildClaimRow({ status: 'UNDER_REVIEW' }))

      await expect(service.close('org_1', 'claim_1', 'user_1')).rejects.toThrow(ConflictException)
    })

    it('closes a settled claim', async () => {
      prisma.insuranceClaim.findFirst
        .mockResolvedValueOnce(buildClaimRow({ status: 'SETTLED' }))
        .mockResolvedValueOnce(buildClaimRow({ status: 'CLOSED' }))

      const result = await service.close('org_1', 'claim_1', 'user_1')
      expect(result.status).toBe('CLOSED')
    })
  })
})
