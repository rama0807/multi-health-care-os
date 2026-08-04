import { IntakeOutputService } from './intake-output.service'

describe('IntakeOutputService', () => {
  let prisma: { intakeOutputRecord: Record<string, jest.Mock> }
  let admissionsService: { requireAdmission: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let service: IntakeOutputService

  beforeEach(() => {
    prisma = {
      intakeOutputRecord: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn() },
    }
    admissionsService = { requireAdmission: jest.fn().mockResolvedValue({ id: 'adm_1', patientId: 'patient_1' }) }
    eventEmitter = { emit: jest.fn() }
    service = new IntakeOutputService(prisma as never, admissionsService as never, eventEmitter as never)
  })

  it('computes total intake, total output, and balance', async () => {
    prisma.intakeOutputRecord.create.mockResolvedValue({
      id: 'io_1',
      admissionId: 'adm_1',
      organizationId: 'org_1',
      recordedAt: new Date(),
      oralIntakeMl: 500,
      ivFluidIntakeMl: 300,
      otherIntakeMl: null,
      urineOutputMl: 400,
      stoolOutputCount: null,
      vomitusMl: null,
      drainOutputMl: 100,
      otherOutputMl: null,
      notes: null,
      recordedByUserId: 'nurse_1',
    })

    const result = await service.create(
      'org_1',
      'adm_1',
      { oralIntakeMl: 500, ivFluidIntakeMl: 300, urineOutputMl: 400, drainOutputMl: 100 } as never,
      'nurse_1',
    )

    expect(result.totalIntakeMl).toBe(800)
    expect(result.totalOutputMl).toBe(500)
    expect(result.balanceMl).toBe(300)
  })

  it('treats missing fields as zero rather than throwing', async () => {
    prisma.intakeOutputRecord.create.mockResolvedValue({
      id: 'io_2',
      admissionId: 'adm_1',
      organizationId: 'org_1',
      recordedAt: new Date(),
      oralIntakeMl: null,
      ivFluidIntakeMl: null,
      otherIntakeMl: null,
      urineOutputMl: null,
      stoolOutputCount: null,
      vomitusMl: null,
      drainOutputMl: null,
      otherOutputMl: null,
      notes: null,
      recordedByUserId: 'nurse_1',
    })

    const result = await service.create('org_1', 'adm_1', {} as never, 'nurse_1')

    expect(result.totalIntakeMl).toBe(0)
    expect(result.totalOutputMl).toBe(0)
    expect(result.balanceMl).toBe(0)
  })
})
