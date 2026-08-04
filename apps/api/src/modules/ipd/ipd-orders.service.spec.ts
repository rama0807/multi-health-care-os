import { ConflictException, NotFoundException } from '@nestjs/common'

import { IpdOrdersService } from './ipd-orders.service'

describe('IpdOrdersService', () => {
  let prisma: { ipdOrder: Record<string, jest.Mock> }
  let admissionsService: { requireAdmission: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let service: IpdOrdersService

  beforeEach(() => {
    prisma = {
      ipdOrder: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    }
    admissionsService = { requireAdmission: jest.fn().mockResolvedValue({ id: 'adm_1', patientId: 'patient_1', status: 'ADMITTED' }) }
    eventEmitter = { emit: jest.fn() }
    service = new IpdOrdersService(prisma as never, admissionsService as never, eventEmitter as never)
  })

  it('creates an order against an active admission', async () => {
    prisma.ipdOrder.create.mockResolvedValue({
      id: 'ord_1',
      admissionId: 'adm_1',
      organizationId: 'org_1',
      category: 'DIET',
      instructions: 'NBM until further notice',
      status: 'ACTIVE',
      orderedByUserId: 'doc_1',
      startedAt: new Date(),
      discontinuedAt: null,
      discontinuedReason: null,
      discontinuedByUserId: null,
      createdAt: new Date(),
    })

    const result = await service.create('org_1', 'adm_1', { category: 'DIET', instructions: 'NBM until further notice' } as never, 'doc_1')

    expect(result.status).toBe('ACTIVE')
    expect(eventEmitter.emit).toHaveBeenCalledWith('ipd.order_created', expect.objectContaining({ category: 'DIET' }))
  })

  it('rejects placing an order against a discharged admission', async () => {
    admissionsService.requireAdmission.mockResolvedValue({ id: 'adm_1', patientId: 'patient_1', status: 'DISCHARGED' })

    await expect(
      service.create('org_1', 'adm_1', { category: 'OXYGEN', instructions: '2L via nasal cannula' } as never, 'doc_1'),
    ).rejects.toThrow(ConflictException)
  })

  it('discontinues an active order', async () => {
    prisma.ipdOrder.findFirst.mockResolvedValue({ id: 'ord_1', status: 'ACTIVE', category: 'ISOLATION' })
    prisma.ipdOrder.update.mockResolvedValue({
      id: 'ord_1',
      admissionId: 'adm_1',
      organizationId: 'org_1',
      category: 'ISOLATION',
      instructions: 'Contact precautions',
      status: 'DISCONTINUED',
      orderedByUserId: 'doc_1',
      startedAt: new Date(),
      discontinuedAt: new Date(),
      discontinuedReason: 'No longer needed',
      discontinuedByUserId: 'doc_1',
      createdAt: new Date(),
    })

    const result = await service.discontinue('org_1', 'adm_1', 'ord_1', { reason: 'No longer needed' } as never, 'doc_1')

    expect(result.status).toBe('DISCONTINUED')
  })

  it('rejects discontinuing an order that is already discontinued', async () => {
    prisma.ipdOrder.findFirst.mockResolvedValue({ id: 'ord_1', status: 'DISCONTINUED', category: 'DIET' })

    await expect(service.discontinue('org_1', 'adm_1', 'ord_1', {} as never, 'doc_1')).rejects.toThrow(ConflictException)
  })

  it('throws NotFoundException for an unknown order', async () => {
    prisma.ipdOrder.findFirst.mockResolvedValue(null)

    await expect(service.discontinue('org_1', 'adm_1', 'missing', {} as never, 'doc_1')).rejects.toThrow(NotFoundException)
  })
})
