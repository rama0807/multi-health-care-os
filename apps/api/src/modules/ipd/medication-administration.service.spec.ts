import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'

import { MedicationAdministrationService } from './medication-administration.service'

function buildItem(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: 'item_1', medicationName: 'Paracetamol', dosage: '500mg', route: 'ORAL', frequency: 'TID', ...overrides }
}

describe('MedicationAdministrationService', () => {
  let prisma: {
    medicationAdministration: Record<string, jest.Mock>
    prescriptionItem: Record<string, jest.Mock>
  }
  let admissionsService: { requireAdmission: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let service: MedicationAdministrationService

  beforeEach(() => {
    prisma = {
      medicationAdministration: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      prescriptionItem: { findFirst: jest.fn() },
    }
    admissionsService = {
      requireAdmission: jest.fn().mockResolvedValue({ id: 'adm_1', patientId: 'patient_1', status: 'ADMITTED' }),
    }
    eventEmitter = { emit: jest.fn() }
    service = new MedicationAdministrationService(prisma as never, admissionsService as never, eventEmitter as never)
  })

  describe('generateScheduled', () => {
    it('creates one row per time per day', async () => {
      prisma.prescriptionItem.findFirst.mockResolvedValue(buildItem())
      prisma.medicationAdministration.createMany.mockResolvedValue({ count: 6 })

      const result = await service.generateScheduled(
        'org_1',
        'adm_1',
        { prescriptionItemId: 'item_1', times: ['08:00', '14:00', '20:00'], days: 2 } as never,
        'nurse_1',
      )

      expect(result.created).toBe(6)
      const rows = prisma.medicationAdministration.createMany.mock.calls[0][0].data
      expect(rows).toHaveLength(6)
      expect(rows[0].type).toBe('SCHEDULED')
    })

    it('rejects scheduling for a non-active admission', async () => {
      admissionsService.requireAdmission.mockResolvedValue({ id: 'adm_1', patientId: 'patient_1', status: 'DISCHARGED' })

      await expect(
        service.generateScheduled('org_1', 'adm_1', { prescriptionItemId: 'item_1', times: ['08:00'], days: 1 } as never, 'nurse_1'),
      ).rejects.toThrow(ConflictException)
    })

    it('rejects a prescription item that does not belong to this patient', async () => {
      prisma.prescriptionItem.findFirst.mockResolvedValue(null)

      await expect(
        service.generateScheduled('org_1', 'adm_1', { prescriptionItemId: 'item_x', times: ['08:00'], days: 1 } as never, 'nurse_1'),
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe('administer', () => {
    it('marks a pending dose administered with a nurse signature', async () => {
      prisma.medicationAdministration.findFirst.mockResolvedValue({ id: 'dose_1', status: 'PENDING', route: 'ORAL' })
      prisma.medicationAdministration.update.mockResolvedValue({
        id: 'dose_1',
        admissionId: 'adm_1',
        prescriptionItemId: 'item_1',
        organizationId: 'org_1',
        type: 'SCHEDULED',
        scheduledAt: new Date(),
        administeredAt: new Date(),
        status: 'ADMINISTERED',
        doseGiven: '500mg',
        route: 'ORAL',
        notes: null,
        barcodeVerified: false,
        scannedCode: null,
        administeredByUserId: 'nurse_1',
        nurseSignature: 'A. Verma',
        createdByUserId: 'nurse_1',
        createdAt: new Date(),
        updatedAt: new Date(),
        prescriptionItem: buildItem(),
      })

      const result = await service.administer(
        'org_1',
        'adm_1',
        'dose_1',
        { doseGiven: '500mg', nurseSignature: 'A. Verma', barcodeVerified: false } as never,
        'nurse_1',
      )

      expect(result.status).toBe('ADMINISTERED')
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'ipd.mar_dose_status_changed',
        expect.objectContaining({ toStatus: 'ADMINISTERED' }),
      )
    })

    it('rejects administering a dose that is not pending', async () => {
      prisma.medicationAdministration.findFirst.mockResolvedValue({ id: 'dose_1', status: 'ADMINISTERED' })

      await expect(
        service.administer('org_1', 'adm_1', 'dose_1', { nurseSignature: 'A. Verma' } as never, 'nurse_1'),
      ).rejects.toThrow(ConflictException)
    })

    it('throws NotFoundException for an unknown dose', async () => {
      prisma.medicationAdministration.findFirst.mockResolvedValue(null)

      await expect(
        service.administer('org_1', 'adm_1', 'missing', { nurseSignature: 'A. Verma' } as never, 'nurse_1'),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('recordException', () => {
    it('records a missed dose with notes and signature', async () => {
      prisma.medicationAdministration.findFirst.mockResolvedValue({ id: 'dose_1', status: 'PENDING' })
      prisma.medicationAdministration.update.mockResolvedValue({
        id: 'dose_1',
        admissionId: 'adm_1',
        prescriptionItemId: 'item_1',
        organizationId: 'org_1',
        type: 'SCHEDULED',
        scheduledAt: new Date(),
        administeredAt: null,
        status: 'MISSED',
        doseGiven: null,
        route: 'ORAL',
        notes: 'Patient was off the ward for a scan',
        barcodeVerified: false,
        scannedCode: null,
        administeredByUserId: 'nurse_1',
        nurseSignature: 'A. Verma',
        createdByUserId: 'nurse_1',
        createdAt: new Date(),
        updatedAt: new Date(),
        prescriptionItem: buildItem(),
      })

      const result = await service.recordException(
        'org_1',
        'adm_1',
        'dose_1',
        'MISSED' as never,
        { notes: 'Patient was off the ward for a scan', nurseSignature: 'A. Verma' } as never,
        'nurse_1',
      )

      expect(result.status).toBe('MISSED')
    })
  })
})
