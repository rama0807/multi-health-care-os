import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'

import { LabTestsService } from './lab-tests.service'

jest.mock('./lab-report-pdf', () => ({
  generateLabReportPdf: jest.fn().mockResolvedValue(Buffer.from('pdf')),
}))

function buildLabTestRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'lab_1',
    labOrderNumber: 'LAB-MED-2026-000001',
    patientId: 'patient_1',
    doctorId: 'doctor_1',
    appointmentId: null,
    encounterId: 'enc_1',
    organizationId: 'org_1',
    status: 'ORDERED',
    priority: 'ROUTINE',
    sampleCollectedBy: null,
    sampleCollectedAt: null,
    reportedAt: null,
    reportFileUrl: null,
    notes: null,
    createdAt: new Date('2026-08-02'),
    updatedAt: new Date('2026-08-02'),
    items: [],
    patient: { id: 'patient_1', firstName: 'Vikram', lastName: 'Nair', uhid: 'MED-2026-000001' },
    doctor: { id: 'doctor_1', specialization: 'Cardiology', user: { firstName: 'Priya', lastName: 'Sharma' } },
    ...overrides,
  }
}

function buildItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'item_1',
    labTestId: 'lab_1',
    catalogItemId: null,
    testName: 'Fasting Blood Sugar',
    testCode: 'FBS',
    category: 'Biochemistry',
    result: null,
    unit: 'mg/dL',
    referenceRange: '70-110',
    referenceRangeLow: 70,
    referenceRangeHigh: 110,
    criticalLow: null,
    criticalHigh: null,
    isAbnormal: false,
    abnormalType: null,
    interpretation: null,
    createdAt: new Date('2026-08-02'),
    ...overrides,
  }
}

describe('LabTestsService', () => {
  let prisma: {
    labTest: Record<string, jest.Mock>
    labTestItem: Record<string, jest.Mock>
    organization: Record<string, jest.Mock>
    patient: Record<string, jest.Mock>
    $transaction: jest.Mock
  }
  let encountersService: { requireEncounter: jest.Mock }
  let catalogService: { requireCatalogItem: jest.Mock }
  let doctorRef: { findDoctorProfileForUser: jest.Mock }
  let permissionsService: { getScope: jest.Mock }
  let storageService: { upload: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let service: LabTestsService

  beforeEach(() => {
    prisma = {
      labTest: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      labTestItem: { update: jest.fn().mockResolvedValue({}) },
      organization: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ settings: {}, name: 'Demo Hospital', address: null, phone: '000', email: 'a@b.com' }),
      },
      patient: { findUniqueOrThrow: jest.fn().mockResolvedValue({ dateOfBirth: new Date('1990-01-01'), gender: 'MALE' }) },
      $transaction: jest.fn(),
    }
    encountersService = {
      requireEncounter: jest.fn().mockResolvedValue({ id: 'enc_1', patientId: 'patient_1', doctorId: 'doctor_1' }),
    }
    catalogService = { requireCatalogItem: jest.fn() }
    doctorRef = { findDoctorProfileForUser: jest.fn() }
    permissionsService = { getScope: jest.fn().mockReturnValue('all') }
    storageService = { upload: jest.fn().mockResolvedValue('http://localhost:4000/uploads/lab-reports/x.pdf') }
    eventEmitter = { emit: jest.fn() }

    service = new LabTestsService(
      prisma as never,
      encountersService as never,
      catalogService as never,
      doctorRef as never,
      permissionsService as never,
      storageService as never,
      eventEmitter as never,
    )
  })

  afterEach(() => jest.clearAllMocks())

  describe('create', () => {
    const adHocDto = {
      encounterId: 'enc_1',
      priority: 'ROUTINE',
      items: [{ testName: 'Fasting Blood Sugar', testCode: 'FBS', category: 'Biochemistry', referenceRangeLow: 70, referenceRangeHigh: 110 }],
    }

    it('creates a lab order from an encounter and emits lab_test.ordered', async () => {
      const createdRow = buildLabTestRow()
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
        fn({
          $executeRaw: jest.fn(),
          labTest: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue(createdRow) },
        }),
      )

      const result = await service.create('org_1', adHocDto as never, 'actor_1')

      expect(encountersService.requireEncounter).toHaveBeenCalledWith('org_1', 'enc_1')
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'lab_test.ordered',
        expect.objectContaining({ doctorId: 'doctor_1', patientId: 'patient_1', userId: 'actor_1' }),
      )
      expect(result.id).toBe('lab_1')
      expect(result.labOrderNumber).toBe('LAB-MED-2026-000001')
    })

    it('generates a sequential order number scoped to the organization and year', async () => {
      let capturedCount: number | undefined
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
        fn({
          $executeRaw: jest.fn(),
          labTest: {
            count: jest.fn().mockResolvedValue(4),
            create: jest.fn().mockImplementation(({ data }: { data: { labOrderNumber: string } }) => {
              capturedCount = Number(data.labOrderNumber.split('-').pop())
              return buildLabTestRow({ labOrderNumber: data.labOrderNumber })
            }),
          },
        }),
      )

      await service.create('org_1', adHocDto as never)

      expect(capturedCount).toBe(5)
    })

    it('auto-populates item fields from the catalog when catalogItemId is provided', async () => {
      catalogService.requireCatalogItem.mockResolvedValue({
        id: 'cat_1',
        testName: 'Complete Blood Count',
        testCode: 'CBC',
        category: 'Hematology',
        unit: 'x10^9/L',
        referenceRangeLow: 4,
        referenceRangeHigh: 11,
        referenceRangeText: null,
        criticalLow: 2,
        criticalHigh: 20,
      })
      let capturedItems: unknown
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
        fn({
          $executeRaw: jest.fn(),
          labTest: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockImplementation(({ data }: { data: { items: { create: unknown } } }) => {
              capturedItems = data.items.create
              return buildLabTestRow()
            }),
          },
        }),
      )

      await service.create('org_1', { encounterId: 'enc_1', priority: 'ROUTINE', items: [{ catalogItemId: 'cat_1' }] } as never)

      expect(catalogService.requireCatalogItem).toHaveBeenCalledWith('org_1', 'cat_1')
      expect(capturedItems).toEqual([
        expect.objectContaining({ testName: 'Complete Blood Count', testCode: 'CBC', referenceRangeLow: 4, referenceRangeHigh: 11 }),
      ])
    })
  })

  describe('collectSample', () => {
    it('transitions ORDERED -> SAMPLE_COLLECTED and records the collector/time', async () => {
      prisma.labTest.findFirst.mockResolvedValue(buildLabTestRow({ status: 'ORDERED' }))
      prisma.labTest.update.mockResolvedValue(buildLabTestRow({ status: 'SAMPLE_COLLECTED', sampleCollectedBy: 'actor_1' }))

      const result = await service.collectSample('org_1', 'lab_1', {}, 'actor_1')

      expect(result.status).toBe('SAMPLE_COLLECTED')
      expect(prisma.labTest.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'SAMPLE_COLLECTED', sampleCollectedBy: 'actor_1' }) }),
      )
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'lab_test.status_changed',
        expect.objectContaining({ fromStatus: 'ORDERED', toStatus: 'SAMPLE_COLLECTED' }),
      )
    })

    it('rejects collecting a sample twice', async () => {
      prisma.labTest.findFirst.mockResolvedValue(buildLabTestRow({ status: 'SAMPLE_COLLECTED' }))

      await expect(service.collectSample('org_1', 'lab_1', {}, 'actor_1')).rejects.toThrow(ConflictException)
    })
  })

  describe('updateStatus (generic - CANCELLED only)', () => {
    it('rejects a non-CANCELLED status via the generic endpoint', async () => {
      await expect(service.updateStatus('org_1', 'lab_1', { status: 'IN_PROGRESS' } as never)).rejects.toThrow(
        BadRequestException,
      )
    })

    it('throws NotFoundException for an unknown lab order', async () => {
      prisma.labTest.findFirst.mockResolvedValue(null)

      await expect(service.updateStatus('org_1', 'missing', { status: 'CANCELLED' } as never)).rejects.toThrow(
        NotFoundException,
      )
    })

    it('cancels an ORDERED lab order', async () => {
      prisma.labTest.findFirst.mockResolvedValue(buildLabTestRow({ status: 'ORDERED' }))
      prisma.labTest.update.mockResolvedValue(buildLabTestRow({ status: 'CANCELLED' }))

      const result = await service.updateStatus('org_1', 'lab_1', { status: 'CANCELLED' } as never, 'actor_1')

      expect(result.status).toBe('CANCELLED')
    })

    it('rejects cancelling out of a terminal state', async () => {
      prisma.labTest.findFirst.mockResolvedValue(buildLabTestRow({ status: 'REPORTED' }))

      await expect(service.updateStatus('org_1', 'lab_1', { status: 'CANCELLED' } as never)).rejects.toThrow(
        BadRequestException,
      )
    })

    it('rejects setting the same terminal status again', async () => {
      prisma.labTest.findFirst.mockResolvedValue(buildLabTestRow({ status: 'CANCELLED' }))

      await expect(service.updateStatus('org_1', 'lab_1', { status: 'CANCELLED' } as never)).rejects.toThrow(
        ConflictException,
      )
    })
  })

  describe('enterResults', () => {
    it('rejects entering results before a sample is collected', async () => {
      prisma.labTest.findFirst.mockResolvedValue(buildLabTestRow({ status: 'ORDERED', items: [buildItem()] }))

      await expect(
        service.enterResults('org_1', 'lab_1', { items: [{ itemId: 'item_1', result: '95' }] } as never),
      ).rejects.toThrow(BadRequestException)
    })

    it('auto-flags a numeric result and completes the order once every item has a result', async () => {
      // range 70-110 (width 40); 20% derived critical high = 118, so 115 is
      // HIGH (outside normal, inside the derived critical threshold).
      const unresolvedItem = buildItem()
      const resolvedItem = buildItem({ result: '115', isAbnormal: true, abnormalType: 'HIGH' })

      prisma.labTest.findFirst
        .mockResolvedValueOnce(buildLabTestRow({ status: 'SAMPLE_COLLECTED', items: [unresolvedItem] }))
        .mockResolvedValue(buildLabTestRow({ status: 'COMPLETED', items: [resolvedItem] }))
      prisma.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops))
      prisma.labTest.update.mockResolvedValue(buildLabTestRow({ status: 'COMPLETED' }))

      const result = await service.enterResults('org_1', 'lab_1', { items: [{ itemId: 'item_1', result: '115' }] } as never, 'actor_1')

      expect(prisma.labTestItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item_1' },
          data: expect.objectContaining({ result: '115', isAbnormal: true, abnormalType: 'HIGH' }),
        }),
      )
      expect(prisma.labTest.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'COMPLETED' } }))
      expect(eventEmitter.emit).toHaveBeenCalledWith('lab_test.results_entered', expect.objectContaining({ labTestId: 'lab_1' }))
      expect(result.status).toBe('COMPLETED')
    })

    it('does not auto-flag a qualitative result and honors the manual override', async () => {
      const qualitativeItem = buildItem({
        testName: 'HIV Screen',
        unit: null,
        referenceRange: 'Non-reactive',
        referenceRangeLow: null,
        referenceRangeHigh: null,
      })

      prisma.labTest.findFirst
        .mockResolvedValueOnce(buildLabTestRow({ status: 'SAMPLE_COLLECTED', items: [qualitativeItem] }))
        .mockResolvedValue(buildLabTestRow({ status: 'COMPLETED', items: [{ ...qualitativeItem, result: 'Reactive', isAbnormal: true }] }))
      prisma.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops))
      prisma.labTest.update.mockResolvedValue(buildLabTestRow({ status: 'COMPLETED' }))

      await service.enterResults(
        'org_1',
        'lab_1',
        { items: [{ itemId: 'item_1', result: 'Reactive', isAbnormalOverride: true }] } as never,
        'actor_1',
      )

      expect(prisma.labTestItem.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ result: 'Reactive', isAbnormal: true, abnormalType: null }) }),
      )
    })

    it('rejects a result for an item that does not belong to the order', async () => {
      prisma.labTest.findFirst.mockResolvedValueOnce(
        buildLabTestRow({ status: 'SAMPLE_COLLECTED', items: [buildItem({ id: 'item_1' })] }),
      )

      await expect(
        service.enterResults('org_1', 'lab_1', { items: [{ itemId: 'item_unknown', result: '95' }] } as never),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('assertOwnScopeOk', () => {
    it('passes through when scope is all', async () => {
      permissionsService.getScope.mockReturnValue('all')

      await expect(service.assertOwnScopeOk('org_1', 'lab_1', { sub: 'user_1' } as never, 'read')).resolves.toBeUndefined()
      expect(prisma.labTest.findFirst).not.toHaveBeenCalled()
    })

    it('rejects when own-scoped and the caller is not the ordering doctor', async () => {
      permissionsService.getScope.mockReturnValue('own')
      prisma.labTest.findFirst.mockResolvedValue(buildLabTestRow({ doctorId: 'doctor_1' }))
      doctorRef.findDoctorProfileForUser.mockResolvedValue({ id: 'doctor_2' })

      await expect(service.assertOwnScopeOk('org_1', 'lab_1', { sub: 'user_2' } as never, 'read')).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('allows when own-scoped and the caller is the ordering doctor', async () => {
      permissionsService.getScope.mockReturnValue('own')
      prisma.labTest.findFirst.mockResolvedValue(buildLabTestRow({ doctorId: 'doctor_1' }))
      doctorRef.findDoctorProfileForUser.mockResolvedValue({ id: 'doctor_1' })

      await expect(service.assertOwnScopeOk('org_1', 'lab_1', { sub: 'user_1' } as never, 'read')).resolves.toBeUndefined()
    })
  })

  describe('generateReportPdf', () => {
    it('rejects generating a report before results exist', async () => {
      prisma.labTest.findFirst.mockResolvedValue(buildLabTestRow({ status: 'ORDERED' }))

      await expect(service.generateReportPdf('org_1', 'lab_1')).rejects.toThrow(BadRequestException)
    })

    it('returns a PDF buffer and a filename derived from the order number once completed', async () => {
      prisma.labTest.findFirst.mockResolvedValue(buildLabTestRow({ status: 'COMPLETED', items: [buildItem({ result: '95' })] }))

      const result = await service.generateReportPdf('org_1', 'lab_1')

      expect(result.fileName).toBe('LAB-MED-2026-000001.pdf')
      expect(Buffer.isBuffer(result.buffer)).toBe(true)
    })
  })
})
