import { ProceduresService } from './procedures.service'

describe('ProceduresService', () => {
  let prisma: { procedure: Record<string, jest.Mock> }
  let encountersService: { requireEncounter: jest.Mock }
  let service: ProceduresService

  beforeEach(() => {
    prisma = { procedure: { findMany: jest.fn(), create: jest.fn() } }
    encountersService = { requireEncounter: jest.fn().mockResolvedValue({ id: 'enc_1' }) }
    service = new ProceduresService(prisma as never, encountersService as never)
  })

  it('creates a procedure for the encounter', async () => {
    prisma.procedure.create.mockResolvedValue({
      id: 'proc_1',
      encounterId: 'enc_1',
      name: 'Wound dressing',
      notes: null,
      performedAt: new Date(),
      createdAt: new Date(),
    })

    const result = await service.create('org_1', 'enc_1', { name: 'Wound dressing' } as never)

    expect(encountersService.requireEncounter).toHaveBeenCalledWith('org_1', 'enc_1')
    expect(result.name).toBe('Wound dressing')
  })

  it('lists procedures for an encounter', async () => {
    prisma.procedure.findMany.mockResolvedValue([
      { id: 'proc_1', encounterId: 'enc_1', name: 'X', notes: null, performedAt: new Date(), createdAt: new Date() },
    ])

    const result = await service.list('org_1', 'enc_1')

    expect(result).toHaveLength(1)
  })
})
