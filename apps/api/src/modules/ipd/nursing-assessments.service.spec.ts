import { NursingAssessmentsService } from './nursing-assessments.service'

describe('NursingAssessmentsService', () => {
  let prisma: { nursingAssessment: Record<string, jest.Mock> }
  let admissionsService: { requireAdmission: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let service: NursingAssessmentsService

  beforeEach(() => {
    prisma = {
      nursingAssessment: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn() },
    }
    admissionsService = { requireAdmission: jest.fn().mockResolvedValue({ id: 'adm_1', patientId: 'patient_1' }) }
    eventEmitter = { emit: jest.fn() }
    service = new NursingAssessmentsService(prisma as never, admissionsService as never, eventEmitter as never)
  })

  it('derives HIGH fall risk from a Morse-style score >= 45', async () => {
    prisma.nursingAssessment.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'a_1', assessedAt: new Date(), ...data }),
    )

    const result = await service.create('org_1', 'adm_1', { fallRiskScore: 50 } as never, 'nurse_1')

    expect(prisma.nursingAssessment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ fallRiskLevel: 'HIGH' }) }),
    )
    expect(result.fallRiskLevel).toBe('HIGH')
  })

  it('derives SEVERE Braden risk from a score <= 9', async () => {
    prisma.nursingAssessment.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'a_2', assessedAt: new Date(), ...data }),
    )

    const result = await service.create('org_1', 'adm_1', { bradenScore: 8 } as never, 'nurse_1')

    expect(result.bradenRiskLevel).toBe('SEVERE')
  })

  it('computes GCS total from eye/verbal/motor when all three are provided', async () => {
    prisma.nursingAssessment.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'a_3', assessedAt: new Date(), ...data }),
    )

    const result = await service.create('org_1', 'adm_1', { gcsEye: 4, gcsVerbal: 5, gcsMotor: 6 } as never, 'nurse_1')

    expect(result.gcsTotal).toBe(15)
  })

  it('leaves GCS total undefined when any component is missing', async () => {
    prisma.nursingAssessment.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'a_4', assessedAt: new Date(), ...data }),
    )

    const result = await service.create('org_1', 'adm_1', { gcsEye: 4, gcsVerbal: 5 } as never, 'nurse_1')

    expect(result.gcsTotal).toBeUndefined()
  })
})
