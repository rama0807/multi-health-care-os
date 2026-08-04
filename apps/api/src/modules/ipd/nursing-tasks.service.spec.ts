import { ConflictException, NotFoundException } from '@nestjs/common'

import { NursingTasksService } from './nursing-tasks.service'

describe('NursingTasksService', () => {
  let prisma: { nursingTask: Record<string, jest.Mock>; ipdOrder: Record<string, jest.Mock> }
  let admissionsService: { requireAdmission: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let service: NursingTasksService

  beforeEach(() => {
    prisma = {
      nursingTask: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      ipdOrder: { findFirst: jest.fn() },
    }
    admissionsService = { requireAdmission: jest.fn().mockResolvedValue({ id: 'adm_1', patientId: 'patient_1' }) }
    eventEmitter = { emit: jest.fn() }
    service = new NursingTasksService(prisma as never, admissionsService as never, eventEmitter as never)
  })

  it('creates a standalone nursing task', async () => {
    prisma.nursingTask.create.mockResolvedValue({
      id: 'task_1',
      admissionId: 'adm_1',
      organizationId: 'org_1',
      sourceOrderId: null,
      title: 'Reposition patient',
      description: null,
      priority: 'ROUTINE',
      dueAt: null,
      status: 'PENDING',
      assignedToUserId: null,
      completedByUserId: null,
      completedAt: null,
      completionNotes: null,
      createdByUserId: 'nurse_1',
      createdAt: new Date(),
    })

    const result = await service.create('org_1', 'adm_1', { title: 'Reposition patient' } as never, 'nurse_1')

    expect(result.status).toBe('PENDING')
    expect(eventEmitter.emit).toHaveBeenCalledWith('ipd.nursing_task_created', expect.objectContaining({ admissionId: 'adm_1' }))
  })

  it('rejects a task referencing a source order from a different admission', async () => {
    prisma.ipdOrder.findFirst.mockResolvedValue(null)

    await expect(
      service.create('org_1', 'adm_1', { title: 'Follow up on diet order', sourceOrderId: 'ord_x' } as never, 'nurse_1'),
    ).rejects.toThrow(NotFoundException)
  })

  it('marks a task completed and stamps the actor/time', async () => {
    prisma.nursingTask.findFirst.mockResolvedValue({ id: 'task_1', admissionId: 'adm_1', status: 'PENDING' })
    prisma.nursingTask.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        id: 'task_1',
        admissionId: 'adm_1',
        organizationId: 'org_1',
        sourceOrderId: null,
        title: 'Reposition patient',
        description: null,
        priority: 'ROUTINE',
        dueAt: null,
        assignedToUserId: null,
        createdByUserId: 'nurse_1',
        createdAt: new Date(),
        ...data,
      }),
    )

    const result = await service.updateStatus('org_1', 'task_1', { status: 'COMPLETED' } as never, 'nurse_2')

    expect(result.status).toBe('COMPLETED')
    expect(result.completedByUserId).toBe('nurse_2')
    expect(result.completedAt).toBeInstanceOf(Date)
  })

  it('rejects updating a task that is already completed', async () => {
    prisma.nursingTask.findFirst.mockResolvedValue({ id: 'task_1', status: 'COMPLETED' })

    await expect(service.updateStatus('org_1', 'task_1', { status: 'IN_PROGRESS' } as never, 'nurse_2')).rejects.toThrow(
      ConflictException,
    )
  })
})
