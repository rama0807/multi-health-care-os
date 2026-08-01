import { VitalsService } from './vitals.service'

function buildVitalRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'vital_1',
    encounterId: 'enc_1',
    heightCm: 170,
    weightKg: 70,
    bmi: 24.2,
    bloodPressureSystolic: 120,
    bloodPressureDiastolic: 80,
    pulse: 72,
    temperatureCelsius: 37,
    respiratoryRate: 16,
    spo2: 98,
    recordedByUserId: 'user_1',
    recordedAt: new Date(),
    ...overrides,
  }
}

describe('VitalsService', () => {
  let prisma: { vital: Record<string, jest.Mock> }
  let encountersService: { requireEncounter: jest.Mock }
  let service: VitalsService

  beforeEach(() => {
    prisma = { vital: { findMany: jest.fn(), create: jest.fn() } }
    encountersService = { requireEncounter: jest.fn().mockResolvedValue({ id: 'enc_1' }) }
    service = new VitalsService(prisma as never, encountersService as never)
  })

  afterEach(() => jest.clearAllMocks())

  describe('record', () => {
    it('computes BMI when both height and weight are provided', async () => {
      prisma.vital.create.mockResolvedValue(buildVitalRow())

      await service.record('org_1', 'enc_1', { heightCm: 170, weightKg: 70 } as never, 'user_1')

      // 70 / (1.70^2) = 24.221... rounded to 1 decimal = 24.2
      expect(prisma.vital.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ bmi: 24.2 }) }),
      )
    })

    it('leaves BMI undefined when height or weight is missing', async () => {
      prisma.vital.create.mockResolvedValue(buildVitalRow({ heightCm: null, weightKg: null, bmi: null }))

      await service.record('org_1', 'enc_1', { pulse: 80 } as never, 'user_1')

      expect(prisma.vital.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ bmi: undefined }) }),
      )
    })

    it('validates the parent encounter exists', async () => {
      prisma.vital.create.mockResolvedValue(buildVitalRow())

      await service.record('org_1', 'enc_1', { pulse: 80 } as never, 'user_1')

      expect(encountersService.requireEncounter).toHaveBeenCalledWith('org_1', 'enc_1')
    })
  })

  describe('listForEncounter', () => {
    it('returns vitals ordered chronologically for one encounter', async () => {
      prisma.vital.findMany.mockResolvedValue([buildVitalRow()])

      const result = await service.listForEncounter('org_1', 'enc_1')

      expect(prisma.vital.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { encounterId: 'enc_1' }, orderBy: { recordedAt: 'asc' } }),
      )
      expect(result).toHaveLength(1)
    })
  })

  describe('listForPatient', () => {
    it('queries across every encounter for the patient via the relation filter', async () => {
      prisma.vital.findMany.mockResolvedValue([buildVitalRow()])

      await service.listForPatient('org_1', 'patient_1')

      expect(prisma.vital.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { encounter: { patientId: 'patient_1', organizationId: 'org_1' } },
        }),
      )
    })
  })
})
