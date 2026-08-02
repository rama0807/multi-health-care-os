import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'

import { DispenseService } from './dispense.service'

function buildItemRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'item_1',
    dispenseOrderId: 'disp_1',
    prescriptionItemId: 'rxi_1',
    drugId: null,
    medicationName: 'Paracetamol',
    quantityRequested: 10,
    quantityDispensed: 0,
    createdAt: new Date('2026-08-03'),
    updatedAt: new Date('2026-08-03'),
    drug: null,
    ...overrides,
  }
}

function buildOrderRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'disp_1',
    dispenseNumber: 'DSP-MED-2026-000001',
    prescriptionId: 'rx_1',
    patientId: 'patient_1',
    organizationId: 'org_1',
    status: 'PENDING',
    preparedByUserId: null,
    dispensedByUserId: null,
    dispensedAt: null,
    rejected: false,
    cancelReason: null,
    notes: null,
    createdAt: new Date('2026-08-03'),
    updatedAt: new Date('2026-08-03'),
    patient: { id: 'patient_1', firstName: 'Vikram', lastName: 'Nair', uhid: 'MED-2026-000001' },
    prescription: { id: 'rx_1', prescriptionNumber: 'RX-MED-2026-000001', doctorId: 'doctor_1', doctor: { user: { firstName: 'Priya', lastName: 'Sharma' } } },
    items: [buildItemRow()],
    returns: [],
    ...overrides,
  }
}

function buildDrugRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'drug_1',
    organizationId: 'org_1',
    genericName: 'Paracetamol',
    batchNumber: 'BATCH-001',
    isActive: true,
    currentStock: 100,
    reservedStock: 0,
    ...overrides,
  }
}

describe('DispenseService', () => {
  let prisma: {
    dispenseOrder: Record<string, jest.Mock>
    drug: Record<string, jest.Mock>
    drugReturn: Record<string, jest.Mock>
    organization: Record<string, jest.Mock>
    $transaction: jest.Mock
  }
  let catalogService: Record<string, jest.Mock>
  let prescriptionsService: { getById: jest.Mock; updateStatus: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let service: DispenseService

  function makeTx(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      $executeRaw: jest.fn(),
      dispenseOrder: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue(buildOrderRow()),
        update: jest.fn().mockResolvedValue(buildOrderRow()),
      },
      dispenseItem: { update: jest.fn().mockResolvedValue(buildItemRow()) },
      drug: { findFirst: jest.fn(), update: jest.fn() },
      drugReturn: { create: jest.fn() },
      ...overrides,
    }
  }

  beforeEach(() => {
    prisma = {
      dispenseOrder: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
      },
      drug: { findFirst: jest.fn() },
      drugReturn: { findMany: jest.fn().mockResolvedValue([]) },
      organization: { findUniqueOrThrow: jest.fn().mockResolvedValue({ settings: {} }) },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(makeTx())),
    }
    catalogService = { countLowStock: jest.fn().mockResolvedValue(0), countExpiringSoon: jest.fn().mockResolvedValue(0) }
    prescriptionsService = {
      getById: jest.fn().mockResolvedValue({
        id: 'rx_1',
        status: 'ACTIVE',
        patientId: 'patient_1',
        items: [{ id: 'rxi_1', medicationName: 'Paracetamol', quantity: 10 }],
      }),
      updateStatus: jest.fn().mockResolvedValue({}),
    }
    eventEmitter = { emit: jest.fn() }

    service = new DispenseService(prisma as never, catalogService as never, prescriptionsService as never, eventEmitter as never)
  })

  afterEach(() => jest.clearAllMocks())

  describe('createFromPrescription', () => {
    it('creates a dispense order mirroring the prescription items and emits dispense_order.created', async () => {
      prisma.dispenseOrder.findUnique.mockResolvedValue(null)

      const result = await service.createFromPrescription('org_1', { prescriptionId: 'rx_1' } as never, 'actor_1')

      expect(result.id).toBe('disp_1')
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'dispense_order.created',
        expect.objectContaining({ dispenseOrderId: 'disp_1', patientId: 'patient_1', userId: 'actor_1' }),
      )
    })

    it('rejects dispensing a prescription that is not ACTIVE', async () => {
      prescriptionsService.getById.mockResolvedValue({ id: 'rx_1', status: 'COMPLETED', patientId: 'patient_1', items: [] })

      await expect(
        service.createFromPrescription('org_1', { prescriptionId: 'rx_1' } as never, 'actor_1'),
      ).rejects.toThrow(BadRequestException)
    })

    it('rejects a prescription that already has a dispense order', async () => {
      prisma.dispenseOrder.findUnique.mockResolvedValue(buildOrderRow())

      await expect(
        service.createFromPrescription('org_1', { prescriptionId: 'rx_1' } as never, 'actor_1'),
      ).rejects.toThrow(ConflictException)
    })
  })

  describe('prepareItems', () => {
    it('reserves stock and moves PENDING to PREPARING', async () => {
      prisma.dispenseOrder.findFirst.mockResolvedValue(buildOrderRow())
      const tx = makeTx({ drug: { findFirst: jest.fn().mockResolvedValue(buildDrugRow()), update: jest.fn() } })
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(tx))

      await service.prepareItems('org_1', 'disp_1', { items: [{ dispenseItemId: 'item_1', drugId: 'drug_1' }] } as never, 'actor_1')

      expect(tx.drug.update).toHaveBeenCalledWith({ where: { id: 'drug_1' }, data: { reservedStock: { increment: 10 } } })
      expect(tx.dispenseOrder.update).toHaveBeenCalledWith({
        where: { id: 'disp_1' },
        data: { status: 'PREPARING', preparedByUserId: 'actor_1' },
      })
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'dispense_order.status_changed',
        expect.objectContaining({ fromStatus: 'PENDING', toStatus: 'PREPARING' }),
      )
    })

    it('rejects a batch with insufficient available stock', async () => {
      prisma.dispenseOrder.findFirst.mockResolvedValue(buildOrderRow())
      const tx = makeTx({ drug: { findFirst: jest.fn().mockResolvedValue(buildDrugRow({ currentStock: 5, reservedStock: 0 })), update: jest.fn() } })
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(tx))

      await expect(
        service.prepareItems('org_1', 'disp_1', { items: [{ dispenseItemId: 'item_1', drugId: 'drug_1' }] } as never, 'actor_1'),
      ).rejects.toThrow(BadRequestException)
    })

    it('rejects when the order is already DISPENSED', async () => {
      prisma.dispenseOrder.findFirst.mockResolvedValue(buildOrderRow({ status: 'DISPENSED' }))

      await expect(
        service.prepareItems('org_1', 'disp_1', { items: [{ dispenseItemId: 'item_1', drugId: 'drug_1' }] } as never, 'actor_1'),
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe('markReady', () => {
    it('rejects when an item has no batch selected', async () => {
      prisma.dispenseOrder.findFirst.mockResolvedValue(buildOrderRow({ status: 'PREPARING' }))

      await expect(service.markReady('org_1', 'disp_1', 'actor_1')).rejects.toThrow(BadRequestException)
    })

    it('moves PREPARING to READY once every item has a batch', async () => {
      prisma.dispenseOrder.findFirst.mockResolvedValue(
        buildOrderRow({ status: 'PREPARING', items: [buildItemRow({ drugId: 'drug_1' })] }),
      )
      prisma.dispenseOrder.update.mockResolvedValue(buildOrderRow({ status: 'READY' }))

      const result = await service.markReady('org_1', 'disp_1', 'actor_1')

      expect(result.status).toBe('READY')
    })
  })

  describe('dispensePartial', () => {
    it('deducts stock for the requested quantity and stays READY', async () => {
      const order = buildOrderRow({ status: 'READY', items: [buildItemRow({ drugId: 'drug_1', quantityRequested: 10 })] })
      prisma.dispenseOrder.findFirst.mockResolvedValue(order)
      const tx = makeTx()
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(tx))

      await service.dispensePartial('org_1', 'disp_1', { items: [{ dispenseItemId: 'item_1', quantity: 4 }] } as never, 'actor_1')

      expect(tx.drug.update).toHaveBeenCalledWith({
        where: { id: 'drug_1' },
        data: { currentStock: { decrement: 4 }, reservedStock: { decrement: 4 } },
      })
      expect(eventEmitter.emit).toHaveBeenCalledWith('dispense_order.partially_dispensed', expect.anything())
    })

    it('rejects dispensing more than the remaining requested quantity', async () => {
      const order = buildOrderRow({ status: 'READY', items: [buildItemRow({ drugId: 'drug_1', quantityRequested: 10, quantityDispensed: 8 })] })
      prisma.dispenseOrder.findFirst.mockResolvedValue(order)

      await expect(
        service.dispensePartial('org_1', 'disp_1', { items: [{ dispenseItemId: 'item_1', quantity: 5 }] } as never, 'actor_1'),
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe('dispenseComplete', () => {
    it('fills every remaining item, moves to DISPENSED, and completes the prescription', async () => {
      const order = buildOrderRow({ status: 'READY', items: [buildItemRow({ drugId: 'drug_1', quantityRequested: 10, quantityDispensed: 4 })] })
      prisma.dispenseOrder.findFirst.mockResolvedValue(order)
      const tx = makeTx()
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(tx))

      await service.dispenseComplete('org_1', 'disp_1', 'actor_1')

      expect(tx.drug.update).toHaveBeenCalledWith({
        where: { id: 'drug_1' },
        data: { currentStock: { decrement: 6 }, reservedStock: { decrement: 6 } },
      })
      expect(tx.dispenseOrder.update).toHaveBeenCalledWith({
        where: { id: 'disp_1' },
        data: expect.objectContaining({ status: 'DISPENSED', dispensedByUserId: 'actor_1' }),
      })
      expect(prescriptionsService.updateStatus).toHaveBeenCalledWith('org_1', 'rx_1', { status: 'COMPLETED' }, 'actor_1')
    })

    it('rejects completing an order that is not READY', async () => {
      prisma.dispenseOrder.findFirst.mockResolvedValue(buildOrderRow({ status: 'PENDING' }))

      await expect(service.dispenseComplete('org_1', 'disp_1', 'actor_1')).rejects.toThrow(BadRequestException)
    })
  })

  describe('reject / cancel', () => {
    it('releases reserved stock and marks the order CANCELLED with rejected = true', async () => {
      const order = buildOrderRow({ status: 'PREPARING', items: [buildItemRow({ drugId: 'drug_1', quantityRequested: 10 })] })
      prisma.dispenseOrder.findFirst.mockResolvedValue(order)
      const tx = makeTx()
      tx.dispenseOrder.update.mockResolvedValue(buildOrderRow({ status: 'CANCELLED', rejected: true, cancelReason: 'Out of stock' }))
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(tx))

      const result = await service.reject('org_1', 'disp_1', { reason: 'Out of stock' } as never, 'actor_1')

      expect(tx.drug.update).toHaveBeenCalledWith({ where: { id: 'drug_1' }, data: { reservedStock: { decrement: 10 } } })
      expect(result.status).toBe('CANCELLED')
      expect(result.rejected).toBe(true)
    })

    it('rejects cancelling an order that is already DISPENSED', async () => {
      prisma.dispenseOrder.findFirst.mockResolvedValue(buildOrderRow({ status: 'DISPENSED' }))

      await expect(service.cancel('org_1', 'disp_1', {} as never, 'actor_1')).rejects.toThrow(BadRequestException)
    })
  })

  describe('createReturn', () => {
    it('restocks the drug and moves the order to RETURNED', async () => {
      const order = buildOrderRow({
        status: 'DISPENSED',
        items: [buildItemRow({ drugId: 'drug_1', quantityRequested: 10, quantityDispensed: 10 })],
      })
      prisma.dispenseOrder.findFirst.mockResolvedValue(order)
      const tx = makeTx({ drugReturn: { create: jest.fn().mockResolvedValue({ id: 'ret_1', dispenseOrderId: 'disp_1', dispenseItemId: 'item_1', drugId: 'drug_1', organizationId: 'org_1', quantityReturned: 3, reason: 'Adverse reaction', returnedByUserId: 'actor_1', returnedAt: new Date() }) } })
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(tx))

      const result = await service.createReturn(
        'org_1',
        'disp_1',
        { dispenseItemId: 'item_1', quantityReturned: 3, reason: 'Adverse reaction' } as never,
        'actor_1',
      )

      expect(tx.drug.update).toHaveBeenCalledWith({ where: { id: 'drug_1' }, data: { currentStock: { increment: 3 } } })
      expect(tx.dispenseOrder.update).toHaveBeenCalledWith({ where: { id: 'disp_1' }, data: { status: 'RETURNED' } })
      expect(result.quantityReturned).toBe(3)
    })

    it('rejects returning more than was dispensed', async () => {
      const order = buildOrderRow({
        status: 'DISPENSED',
        items: [buildItemRow({ drugId: 'drug_1', quantityRequested: 10, quantityDispensed: 2 })],
      })
      prisma.dispenseOrder.findFirst.mockResolvedValue(order)

      await expect(
        service.createReturn('org_1', 'disp_1', { dispenseItemId: 'item_1', quantityReturned: 5, reason: 'x' } as never, 'actor_1'),
      ).rejects.toThrow(BadRequestException)
    })

    it('rejects returning against an item not on the order', async () => {
      prisma.dispenseOrder.findFirst.mockResolvedValue(buildOrderRow({ status: 'DISPENSED' }))

      await expect(
        service.createReturn('org_1', 'disp_1', { dispenseItemId: 'missing', quantityReturned: 1, reason: 'x' } as never, 'actor_1'),
      ).rejects.toThrow(NotFoundException)
    })
  })
})
