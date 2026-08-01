import { DiagnosesService } from './diagnoses.service'

describe('DiagnosesService', () => {
  let prisma: { diagnosis: Record<string, jest.Mock> }
  let encountersService: { requireEncounter: jest.Mock }
  let service: DiagnosesService

  beforeEach(() => {
    prisma = { diagnosis: { findMany: jest.fn(), create: jest.fn() } }
    encountersService = { requireEncounter: jest.fn().mockResolvedValue({ id: 'enc_1' }) }
    service = new DiagnosesService(prisma as never, encountersService as never)
  })

  it('creates a diagnosis with the given type and ICD code', async () => {
    prisma.diagnosis.create.mockResolvedValue({
      id: 'dx_1',
      encounterId: 'enc_1',
      type: 'SECONDARY',
      description: 'Hypertension',
      icdCode: 'I10',
      createdAt: new Date(),
    })

    const result = await service.create(
      'org_1',
      'enc_1',
      { type: 'SECONDARY', description: 'Hypertension', icdCode: 'I10' } as never,
    )

    expect(encountersService.requireEncounter).toHaveBeenCalledWith('org_1', 'enc_1')
    expect(result.type).toBe('SECONDARY')
    expect(result.icdCode).toBe('I10')
  })

  it('lists diagnoses for an encounter in creation order', async () => {
    prisma.diagnosis.findMany.mockResolvedValue([
      { id: 'dx_1', encounterId: 'enc_1', type: 'PRIMARY', description: 'A', icdCode: null, createdAt: new Date() },
    ])

    const result = await service.list('org_1', 'enc_1')

    expect(result).toHaveLength(1)
  })
})
