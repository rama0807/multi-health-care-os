import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'

import { RadiologyOrdersService } from './radiology-orders.service'

jest.mock('./radiology-report-pdf', () => ({
  generateRadiologyReportPdf: jest.fn().mockResolvedValue(Buffer.from('pdf')),
}))

function buildOrderRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'rad_1',
    orderNumber: 'RAD-MED-2026-000001',
    patientId: 'patient_1',
    doctorId: 'doctor_1',
    encounterId: 'enc_1',
    catalogItemId: null,
    organizationId: 'org_1',
    modality: 'X_RAY',
    bodyPart: 'Chest',
    clinicalIndication: 'Cough',
    status: 'ORDERED',
    priority: 'ROUTINE',
    scheduledAt: null,
    room: null,
    machine: null,
    technicianUserId: null,
    radiologistDoctorId: null,
    durationMinutes: null,
    technique: null,
    findings: null,
    impression: null,
    recommendations: null,
    reportFileUrl: null,
    reportedBy: null,
    reportedAt: null,
    verifiedByUserId: null,
    verifiedAt: null,
    releasedByUserId: null,
    releasedAt: null,
    createdAt: new Date('2026-08-02'),
    updatedAt: new Date('2026-08-02'),
    reports: [],
    attachments: [],
    patient: { id: 'patient_1', firstName: 'Vikram', lastName: 'Nair', uhid: 'MED-2026-000001' },
    doctor: { id: 'doctor_1', specialization: 'Cardiology', user: { firstName: 'Priya', lastName: 'Sharma' } },
    ...overrides,
  }
}

describe('RadiologyOrdersService', () => {
  let prisma: {
    radiologyOrder: Record<string, jest.Mock>
    radiologyReport: Record<string, jest.Mock>
    radiologyAttachment: Record<string, jest.Mock>
    organization: Record<string, jest.Mock>
    patient: Record<string, jest.Mock>
    doctor: Record<string, jest.Mock>
    $transaction: jest.Mock
  }
  let encountersService: { requireEncounter: jest.Mock }
  let catalogService: { requireCatalogItem: jest.Mock }
  let doctorRef: { findDoctorProfileForUser: jest.Mock; requireDoctor: jest.Mock }
  let permissionsService: { getScope: jest.Mock }
  let storageService: { upload: jest.Mock; delete: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let service: RadiologyOrdersService

  beforeEach(() => {
    prisma = {
      radiologyOrder: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
      },
      radiologyReport: { create: jest.fn().mockResolvedValue({}) },
      radiologyAttachment: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      organization: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ settings: {}, name: 'Demo Hospital', address: null, phone: '000', email: 'a@b.com' }),
      },
      patient: { findUniqueOrThrow: jest.fn().mockResolvedValue({ dateOfBirth: new Date('1990-01-01'), gender: 'MALE' }) },
      doctor: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(),
    }
    encountersService = {
      requireEncounter: jest.fn().mockResolvedValue({ id: 'enc_1', patientId: 'patient_1', doctorId: 'doctor_1' }),
    }
    catalogService = { requireCatalogItem: jest.fn() }
    doctorRef = { findDoctorProfileForUser: jest.fn(), requireDoctor: jest.fn() }
    permissionsService = { getScope: jest.fn().mockReturnValue('all') }
    storageService = {
      upload: jest.fn().mockResolvedValue('http://localhost:4000/uploads/radiology-reports/x.pdf'),
      delete: jest.fn().mockResolvedValue(undefined),
    }
    eventEmitter = { emit: jest.fn() }

    service = new RadiologyOrdersService(
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
    const adHocDto = { encounterId: 'enc_1', priority: 'ROUTINE', modality: 'X_RAY', bodyPart: 'Chest' }

    it('creates a radiology order from an encounter and emits radiology_order.ordered', async () => {
      const createdRow = buildOrderRow()
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
        fn({
          $executeRaw: jest.fn(),
          radiologyOrder: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue(createdRow) },
        }),
      )

      const result = await service.create('org_1', adHocDto as never, 'actor_1')

      expect(encountersService.requireEncounter).toHaveBeenCalledWith('org_1', 'enc_1')
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'radiology_order.ordered',
        expect.objectContaining({ doctorId: 'doctor_1', patientId: 'patient_1', userId: 'actor_1' }),
      )
      expect(result.id).toBe('rad_1')
      expect(result.orderNumber).toBe('RAD-MED-2026-000001')
    })

    it('auto-populates modality/bodyPart from the catalog when catalogItemId is provided', async () => {
      catalogService.requireCatalogItem.mockResolvedValue({ id: 'cat_1', modality: 'CT', bodyPart: 'Brain' })
      let capturedData: Record<string, unknown> | undefined
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
        fn({
          $executeRaw: jest.fn(),
          radiologyOrder: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
              capturedData = data
              return buildOrderRow({ modality: 'CT', bodyPart: 'Brain' })
            }),
          },
        }),
      )

      await service.create('org_1', { encounterId: 'enc_1', priority: 'ROUTINE', catalogItemId: 'cat_1' } as never)

      expect(catalogService.requireCatalogItem).toHaveBeenCalledWith('org_1', 'cat_1')
      expect(capturedData).toEqual(expect.objectContaining({ modality: 'CT', bodyPart: 'Brain' }))
    })

    it('generates a sequential order number scoped to the organization and year', async () => {
      let capturedCount: number | undefined
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
        fn({
          $executeRaw: jest.fn(),
          radiologyOrder: {
            count: jest.fn().mockResolvedValue(4),
            create: jest.fn().mockImplementation(({ data }: { data: { orderNumber: string } }) => {
              capturedCount = Number(data.orderNumber.split('-').pop())
              return buildOrderRow({ orderNumber: data.orderNumber })
            }),
          },
        }),
      )

      await service.create('org_1', adHocDto as never)

      expect(capturedCount).toBe(5)
    })
  })

  describe('schedule', () => {
    it('transitions ORDERED -> SCHEDULED and records scheduling fields', async () => {
      prisma.radiologyOrder.findFirst.mockResolvedValue(buildOrderRow({ status: 'ORDERED' }))
      prisma.radiologyOrder.update.mockResolvedValue(
        buildOrderRow({ status: 'SCHEDULED', room: 'Room 1', machine: 'CT-1' }),
      )

      const result = await service.schedule(
        'org_1',
        'rad_1',
        { scheduledAt: new Date('2026-08-05T10:00:00Z'), room: 'Room 1', machine: 'CT-1' } as never,
        'actor_1',
      )

      expect(result.status).toBe('SCHEDULED')
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'radiology_order.status_changed',
        expect.objectContaining({ fromStatus: 'ORDERED', toStatus: 'SCHEDULED' }),
      )
    })

    it('allows rescheduling while already SCHEDULED without re-emitting a status change', async () => {
      prisma.radiologyOrder.findFirst.mockResolvedValue(buildOrderRow({ status: 'SCHEDULED' }))
      prisma.radiologyOrder.update.mockResolvedValue(buildOrderRow({ status: 'SCHEDULED', room: 'Room 2' }))

      await service.schedule('org_1', 'rad_1', { scheduledAt: new Date(), room: 'Room 2' } as never, 'actor_1')

      expect(eventEmitter.emit).not.toHaveBeenCalled()
    })

    it('rejects scheduling a study that is already IN_PROGRESS', async () => {
      prisma.radiologyOrder.findFirst.mockResolvedValue(buildOrderRow({ status: 'IN_PROGRESS' }))

      await expect(
        service.schedule('org_1', 'rad_1', { scheduledAt: new Date() } as never),
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe('startStudy / completeStudy', () => {
    it('transitions SCHEDULED -> IN_PROGRESS', async () => {
      prisma.radiologyOrder.findFirst.mockResolvedValue(buildOrderRow({ status: 'SCHEDULED' }))
      prisma.radiologyOrder.update.mockResolvedValue(buildOrderRow({ status: 'IN_PROGRESS' }))

      const result = await service.startStudy('org_1', 'rad_1', 'actor_1')

      expect(result.status).toBe('IN_PROGRESS')
    })

    it('rejects starting an order that has not been scheduled', async () => {
      prisma.radiologyOrder.findFirst.mockResolvedValue(buildOrderRow({ status: 'ORDERED' }))

      await expect(service.startStudy('org_1', 'rad_1')).rejects.toThrow(BadRequestException)
    })

    it('transitions IN_PROGRESS -> COMPLETED', async () => {
      prisma.radiologyOrder.findFirst.mockResolvedValue(buildOrderRow({ status: 'IN_PROGRESS' }))
      prisma.radiologyOrder.update.mockResolvedValue(buildOrderRow({ status: 'COMPLETED' }))

      const result = await service.completeStudy('org_1', 'rad_1', 'actor_1')

      expect(result.status).toBe('COMPLETED')
    })
  })

  describe('report authoring — addReportVersion / verifyReport / releaseReport', () => {
    it('rejects authoring a report before the study is COMPLETED', async () => {
      prisma.radiologyOrder.findFirst.mockResolvedValue(buildOrderRow({ status: 'IN_PROGRESS' }))

      await expect(
        service.addReportVersion('org_1', 'rad_1', { findings: 'Clear' } as never),
      ).rejects.toThrow(BadRequestException)
    })

    it('creates version 1, denormalizes onto the order, and resets any prior verification', async () => {
      prisma.radiologyOrder.findFirst
        .mockResolvedValueOnce(buildOrderRow({ status: 'COMPLETED', reports: [] }))
        .mockResolvedValue(buildOrderRow({ status: 'COMPLETED', reports: [{ version: 1 }], findings: 'Clear lungs' }))
      prisma.radiologyOrder.update.mockResolvedValue(undefined)
      prisma.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops))

      const result = await service.addReportVersion(
        'org_1',
        'rad_1',
        { findings: 'Clear lungs', impression: 'Normal' } as never,
        'actor_1',
      )

      expect(prisma.radiologyReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ radiologyOrderId: 'rad_1', version: 1, findings: 'Clear lungs' }),
        }),
      )
      expect(prisma.radiologyOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ findings: 'Clear lungs', verifiedByUserId: null, verifiedAt: null }),
        }),
      )
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'radiology_order.report_drafted',
        expect.objectContaining({ radiologyOrderId: 'rad_1' }),
      )
      expect(result.findings).toBe('Clear lungs')
    })

    it('rejects verifying when no report has been authored yet', async () => {
      prisma.radiologyOrder.findFirst.mockResolvedValue(buildOrderRow({ status: 'COMPLETED', reports: [] }))

      await expect(service.verifyReport('org_1', 'rad_1', 'actor_1')).rejects.toThrow(BadRequestException)
    })

    it('verifies a report once authored', async () => {
      prisma.radiologyOrder.findFirst.mockResolvedValue(
        buildOrderRow({ status: 'COMPLETED', reports: [{ version: 1 }] }),
      )
      prisma.radiologyOrder.update.mockResolvedValue(
        buildOrderRow({ status: 'COMPLETED', verifiedByUserId: 'actor_1', verifiedAt: new Date() }),
      )

      const result = await service.verifyReport('org_1', 'rad_1', 'actor_1')

      expect(result.verifiedByUserId).toBe('actor_1')
    })

    it('rejects releasing an unverified report', async () => {
      prisma.radiologyOrder.findFirst.mockResolvedValue(buildOrderRow({ status: 'COMPLETED', verifiedAt: null }))

      await expect(service.releaseReport('org_1', 'rad_1', 'actor_1')).rejects.toThrow(BadRequestException)
    })

    it('releases a verified report, transitioning to REPORTED', async () => {
      prisma.radiologyOrder.findFirst.mockResolvedValue(
        buildOrderRow({ status: 'COMPLETED', verifiedAt: new Date() }),
      )
      prisma.radiologyOrder.update.mockResolvedValue(buildOrderRow({ status: 'REPORTED' }))

      const result = await service.releaseReport('org_1', 'rad_1', 'actor_1')

      expect(result.status).toBe('REPORTED')
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'radiology_order.status_changed',
        expect.objectContaining({ fromStatus: 'COMPLETED', toStatus: 'REPORTED' }),
      )
    })
  })

  describe('updateStatus (generic — CANCELLED/REJECTED only)', () => {
    it('rejects a non-terminal status via the generic endpoint', async () => {
      await expect(service.updateStatus('org_1', 'rad_1', { status: 'IN_PROGRESS' } as never)).rejects.toThrow(
        BadRequestException,
      )
    })

    it('throws NotFoundException for an unknown order', async () => {
      prisma.radiologyOrder.findFirst.mockResolvedValue(null)

      await expect(service.updateStatus('org_1', 'missing', { status: 'CANCELLED' } as never)).rejects.toThrow(
        NotFoundException,
      )
    })

    it('cancels an ORDERED radiology order', async () => {
      prisma.radiologyOrder.findFirst.mockResolvedValue(buildOrderRow({ status: 'ORDERED' }))
      prisma.radiologyOrder.update.mockResolvedValue(buildOrderRow({ status: 'CANCELLED' }))

      const result = await service.updateStatus('org_1', 'rad_1', { status: 'CANCELLED' } as never, 'actor_1')

      expect(result.status).toBe('CANCELLED')
    })

    it('rejects an order (ORDERED -> REJECTED)', async () => {
      prisma.radiologyOrder.findFirst.mockResolvedValue(buildOrderRow({ status: 'ORDERED' }))
      prisma.radiologyOrder.update.mockResolvedValue(buildOrderRow({ status: 'REJECTED' }))

      const result = await service.updateStatus(
        'org_1',
        'rad_1',
        { status: 'REJECTED', reason: 'Duplicate order' } as never,
        'actor_1',
      )

      expect(result.status).toBe('REJECTED')
    })

    it('rejects cancelling out of a terminal state', async () => {
      prisma.radiologyOrder.findFirst.mockResolvedValue(buildOrderRow({ status: 'REPORTED' }))

      await expect(service.updateStatus('org_1', 'rad_1', { status: 'CANCELLED' } as never)).rejects.toThrow(
        BadRequestException,
      )
    })

    it('rejects setting the same terminal status again', async () => {
      prisma.radiologyOrder.findFirst.mockResolvedValue(buildOrderRow({ status: 'CANCELLED' }))

      await expect(service.updateStatus('org_1', 'rad_1', { status: 'CANCELLED' } as never)).rejects.toThrow(
        ConflictException,
      )
    })
  })

  describe('assertOwnScopeOk', () => {
    it('passes through when scope is all', async () => {
      permissionsService.getScope.mockReturnValue('all')

      await expect(
        service.assertOwnScopeOk('org_1', 'rad_1', { sub: 'user_1' } as never, 'read'),
      ).resolves.toBeUndefined()
      expect(prisma.radiologyOrder.findFirst).not.toHaveBeenCalled()
    })

    it('rejects when own-scoped and the caller is not the ordering doctor', async () => {
      permissionsService.getScope.mockReturnValue('own')
      prisma.radiologyOrder.findFirst.mockResolvedValue(buildOrderRow({ doctorId: 'doctor_1' }))
      doctorRef.findDoctorProfileForUser.mockResolvedValue({ id: 'doctor_2' })

      await expect(
        service.assertOwnScopeOk('org_1', 'rad_1', { sub: 'user_2' } as never, 'read'),
      ).rejects.toThrow(ForbiddenException)
    })

    it('allows when own-scoped and the caller is the ordering doctor', async () => {
      permissionsService.getScope.mockReturnValue('own')
      prisma.radiologyOrder.findFirst.mockResolvedValue(buildOrderRow({ doctorId: 'doctor_1' }))
      doctorRef.findDoctorProfileForUser.mockResolvedValue({ id: 'doctor_1' })

      await expect(
        service.assertOwnScopeOk('org_1', 'rad_1', { sub: 'user_1' } as never, 'read'),
      ).resolves.toBeUndefined()
    })
  })

  describe('generateReportPdf', () => {
    it('rejects generating a report before the study is at least COMPLETED', async () => {
      prisma.radiologyOrder.findFirst.mockResolvedValue(buildOrderRow({ status: 'SCHEDULED' }))

      await expect(service.generateReportPdf('org_1', 'rad_1')).rejects.toThrow(BadRequestException)
    })

    it('returns a PDF buffer and a filename derived from the order number once completed', async () => {
      prisma.radiologyOrder.findFirst.mockResolvedValue(buildOrderRow({ status: 'COMPLETED', findings: 'Clear' }))

      const result = await service.generateReportPdf('org_1', 'rad_1')

      expect(result.fileName).toBe('RAD-MED-2026-000001.pdf')
      expect(Buffer.isBuffer(result.buffer)).toBe(true)
    })
  })

  describe('attachments', () => {
    it('rejects an unsupported mime type for an IMAGE attachment', async () => {
      prisma.radiologyOrder.findFirst.mockResolvedValue(buildOrderRow())

      await expect(
        service.addFileAttachment(
          'org_1',
          'rad_1',
          'IMAGE' as never,
          { buffer: Buffer.from('x'), fileName: 'scan.txt', mimeType: 'text/plain', size: 1 },
          'actor_1',
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('uploads a valid image attachment via StorageService', async () => {
      prisma.radiologyOrder.findFirst.mockResolvedValue(buildOrderRow())
      prisma.radiologyAttachment.create.mockResolvedValue({
        id: 'att_1',
        radiologyOrderId: 'rad_1',
        organizationId: 'org_1',
        type: 'IMAGE',
        fileName: 'scan.png',
        fileUrl: 'http://localhost:4000/uploads/radiology-attachments/x.png',
        mimeType: 'image/png',
        fileSizeBytes: 1,
        metadata: null,
        uploadedByUserId: 'actor_1',
        uploadedAt: new Date('2026-08-02'),
      })

      const result = await service.addFileAttachment(
        'org_1',
        'rad_1',
        'IMAGE' as never,
        { buffer: Buffer.from('x'), fileName: 'scan.png', mimeType: 'image/png', size: 1 },
        'actor_1',
      )

      expect(storageService.upload).toHaveBeenCalled()
      expect(result.type).toBe('IMAGE')
    })

    it('records an external-imaging attachment without touching StorageService', async () => {
      prisma.radiologyOrder.findFirst.mockResolvedValue(buildOrderRow())
      prisma.radiologyAttachment.create.mockResolvedValue({
        id: 'att_2',
        radiologyOrderId: 'rad_1',
        organizationId: 'org_1',
        type: 'EXTERNAL_IMAGING',
        fileName: null,
        fileUrl: null,
        mimeType: null,
        fileSizeBytes: null,
        metadata: { accessionNumber: 'ACC-1' },
        uploadedByUserId: 'actor_1',
        uploadedAt: new Date('2026-08-02'),
      })

      const result = await service.addExternalAttachment(
        'org_1',
        'rad_1',
        'EXTERNAL_IMAGING' as never,
        { accessionNumber: 'ACC-1' },
        'actor_1',
      )

      expect(storageService.upload).not.toHaveBeenCalled()
      expect(result.metadata).toEqual({ accessionNumber: 'ACC-1' })
    })
  })

  describe('getDashboardStats', () => {
    it('returns counts for each dashboard metric', async () => {
      prisma.radiologyOrder.count.mockResolvedValue(2)

      const result = await service.getDashboardStats('org_1')

      expect(result).toEqual({
        todaysStudies: 2,
        pendingReporting: 2,
        completedStudies: 2,
        cancelled: 2,
        urgent: 2,
      })
      expect(prisma.radiologyOrder.count).toHaveBeenCalledTimes(5)
    })
  })
})
