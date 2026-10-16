import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'

import { PrescriptionsService } from './prescriptions.service'

jest.mock('./prescription-pdf', () => ({
  generatePrescriptionPdf: jest.fn().mockResolvedValue(Buffer.from('pdf')),
}))

function buildPrescriptionRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'rx_1',
    prescriptionNumber: 'RX-MED-2026-000001',
    patientId: 'patient_1',
    doctorId: 'doctor_1',
    encounterId: 'enc_1',
    organizationId: 'org_1',
    status: 'ACTIVE',
    notes: null,
    prescribedAt: new Date('2026-08-01'),
    createdAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-01'),
    items: [],
    patient: { id: 'patient_1', firstName: 'Vikram', lastName: 'Nair', uhid: 'MED-2026-000001' },
    doctor: { id: 'doctor_1', specialization: 'Cardiology', user: { firstName: 'Priya', lastName: 'Sharma' } },
    ...overrides,
  }
}

describe('PrescriptionsService', () => {
  let prisma: {
    prescription: Record<string, jest.Mock>
    organization: Record<string, jest.Mock>
    patient: Record<string, jest.Mock>
    $transaction: jest.Mock
  }
  let encountersService: { requireEncounter: jest.Mock }
  let doctorRef: { findDoctorProfileForUser: jest.Mock }
  let permissionsService: { getScope: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let service: PrescriptionsService

  beforeEach(() => {
    prisma = {
      prescription: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn(), count: jest.fn(), update: jest.fn() },
      organization: { findUniqueOrThrow: jest.fn().mockResolvedValue({ settings: {}, name: 'Demo Hospital', address: null, phone: '000', email: 'a@b.com' }) },
      patient: { findUniqueOrThrow: jest.fn().mockResolvedValue({ dateOfBirth: new Date('1990-01-01'), gender: 'MALE' }) },
      $transaction: jest.fn(),
    }
    encountersService = {
      requireEncounter: jest.fn().mockResolvedValue({ id: 'enc_1', patientId: 'patient_1', doctorId: 'doctor_1' }),
    }
    doctorRef = { findDoctorProfileForUser: jest.fn() }
    permissionsService = { getScope: jest.fn().mockReturnValue('all') }
    eventEmitter = { emit: jest.fn() }

    service = new PrescriptionsService(
      prisma as never,
      doctorRef as never,
      permissionsService as never,
      eventEmitter as never,
    )
  })

  afterEach(() => jest.clearAllMocks())

  describe('create', () => {
    const validDto = {
      encounterId: 'enc_1',
      items: [{ medicationName: 'Paracetamol', dosage: '500mg', frequency: 'BD', duration: '5 days', route: 'ORAL', quantity: 10 }],
    }

    it('creates a prescription and emits prescription.created', async () => {
      const createdRow = buildPrescriptionRow()
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
        fn({
          $executeRaw: jest.fn(),
          prescription: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue(createdRow) },
        }),
      )

      const result = await service.create('org_1', validDto as never, 'actor_1')

      expect(encountersService.requireEncounter).toHaveBeenCalledWith('org_1', 'enc_1')
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'prescription.created',
        expect.objectContaining({ doctorId: 'doctor_1', patientId: 'patient_1', userId: 'actor_1' }),
      )
      expect(result.prescription.id).toBe('rx_1')
      expect(result.warnings).toEqual([])
    })

    it('returns a drug interaction warning when items conflict', async () => {
      const conflictingDto = {
        encounterId: 'enc_1',
        items: [
          { medicationName: 'Warfarin', dosage: '5mg', frequency: 'OD', duration: '30 days', route: 'ORAL', quantity: 30 },
          { medicationName: 'Aspirin', dosage: '75mg', frequency: 'OD', duration: '30 days', route: 'ORAL', quantity: 30 },
        ],
      }
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
        fn({
          $executeRaw: jest.fn(),
          prescription: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue(buildPrescriptionRow()) },
        }),
      )

      const result = await service.create('org_1', conflictingDto as never)

      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]).toMatchObject({ severity: 'severe' })
    })

    it('checks interactions against the patient\'s other active prescriptions too', async () => {
      prisma.prescription.findMany.mockResolvedValue([
        { items: [{ medicationName: 'Warfarin' }] },
      ])
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
        fn({
          $executeRaw: jest.fn(),
          prescription: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue(buildPrescriptionRow()) },
        }),
      )

      const result = await service.create('org_1', {
        encounterId: 'enc_1',
        items: [{ medicationName: 'Aspirin', dosage: '75mg', frequency: 'OD', duration: '30 days', route: 'ORAL', quantity: 30 }],
      } as never)

      expect(result.warnings).toHaveLength(1)
    })
  })

  describe('updateStatus', () => {
    it('throws NotFoundException for an unknown prescription', async () => {
      prisma.prescription.findFirst.mockResolvedValue(null)

      await expect(service.updateStatus('org_1', 'missing', { status: 'COMPLETED' } as never)).rejects.toThrow(
        NotFoundException,
      )
    })

    it('rejects setting the same status again', async () => {
      prisma.prescription.findFirst.mockResolvedValue(buildPrescriptionRow({ status: 'ACTIVE' }))

      await expect(service.updateStatus('org_1', 'rx_1', { status: 'ACTIVE' } as never)).rejects.toThrow(
        ConflictException,
      )
    })

    it('rejects transitioning out of a terminal state', async () => {
      prisma.prescription.findFirst.mockResolvedValue(buildPrescriptionRow({ status: 'COMPLETED' }))

      await expect(service.updateStatus('org_1', 'rx_1', { status: 'ACTIVE' } as never)).rejects.toThrow(
        BadRequestException,
      )
    })

    it('allows ACTIVE -> DISCONTINUED and emits prescription.status_changed', async () => {
      prisma.prescription.findFirst.mockResolvedValue(buildPrescriptionRow({ status: 'ACTIVE' }))
      prisma.prescription.update.mockResolvedValue(buildPrescriptionRow({ status: 'DISCONTINUED' }))

      const result = await service.updateStatus('org_1', 'rx_1', { status: 'DISCONTINUED' } as never, 'actor_1')

      expect(result.status).toBe('DISCONTINUED')
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'prescription.status_changed',
        expect.objectContaining({ fromStatus: 'ACTIVE', toStatus: 'DISCONTINUED' }),
      )
    })
  })

  describe('assertOwnScopeOk', () => {
    it('passes through when scope is all', async () => {
      permissionsService.getScope.mockReturnValue('all')

      await expect(
        service.assertOwnScopeOk('org_1', 'rx_1', { sub: 'user_1' } as never, 'read'),
      ).resolves.toBeUndefined()
      expect(prisma.prescription.findFirst).not.toHaveBeenCalled()
    })

    it('rejects when own-scoped and the caller is not the prescribing doctor', async () => {
      permissionsService.getScope.mockReturnValue('own')
      prisma.prescription.findFirst.mockResolvedValue(buildPrescriptionRow({ doctorId: 'doctor_1' }))
      doctorRef.findDoctorProfileForUser.mockResolvedValue({ id: 'doctor_2' })

      await expect(
        service.assertOwnScopeOk('org_1', 'rx_1', { sub: 'user_2' } as never, 'read'),
      ).rejects.toThrow(ForbiddenException)
    })

    it('allows when own-scoped and the caller is the prescribing doctor', async () => {
      permissionsService.getScope.mockReturnValue('own')
      prisma.prescription.findFirst.mockResolvedValue(buildPrescriptionRow({ doctorId: 'doctor_1' }))
      doctorRef.findDoctorProfileForUser.mockResolvedValue({ id: 'doctor_1' })

      await expect(
        service.assertOwnScopeOk('org_1', 'rx_1', { sub: 'user_1' } as never, 'read'),
      ).resolves.toBeUndefined()
    })
  })

  describe('generatePdf', () => {
    it('returns a PDF buffer and a filename derived from the prescription number', async () => {
      prisma.prescription.findFirst.mockResolvedValue(buildPrescriptionRow())

      const result = await service.generatePdf('org_1', 'rx_1')

      expect(result.fileName).toBe('RX-MED-2026-000001.pdf')
      expect(Buffer.isBuffer(result.buffer)).toBe(true)
    })
  })
})
