import { BadRequestException, NotFoundException } from '@nestjs/common'

import { DrugCatalogService } from './drug-catalog.service'

function buildDrugRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'drug_1',
    organizationId: 'org_1',
    genericName: 'Paracetamol',
    brandName: 'Crocin',
    strength: '500mg',
    dosageForm: 'Tablet',
    manufacturer: 'GSK',
    batchNumber: 'BATCH-001',
    expiryDate: new Date('2027-01-01'),
    price: { toString: () => '2.50' },
    taxPercent: { toString: () => '5' },
    isActive: true,
    currentStock: 100,
    reservedStock: 0,
    minStockLevel: 10,
    reorderLevel: 20,
    createdAt: new Date('2026-08-03'),
    updatedAt: new Date('2026-08-03'),
    ...overrides,
  }
}

describe('DrugCatalogService', () => {
  let prisma: { drug: Record<string, jest.Mock> }
  let service: DrugCatalogService

  beforeEach(() => {
    prisma = {
      drug: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
    }
    service = new DrugCatalogService(prisma as never)
  })

  afterEach(() => jest.clearAllMocks())

  describe('create', () => {
    it('creates a drug batch row', async () => {
      prisma.drug.create.mockResolvedValue(buildDrugRow())

      const result = await service.create('org_1', {
        genericName: 'Paracetamol',
        dosageForm: 'Tablet',
        batchNumber: 'BATCH-001',
        expiryDate: new Date('2027-01-01'),
        price: 2.5,
        taxPercent: 5,
        currentStock: 100,
        minStockLevel: 10,
        reorderLevel: 20,
      } as never)

      expect(result.genericName).toBe('Paracetamol')
      expect(result.availableStock).toBe(100)
    })
  })

  describe('update', () => {
    it('throws NotFoundException for an unknown drug', async () => {
      prisma.drug.findFirst.mockResolvedValue(null)

      await expect(service.update('org_1', 'missing', { isActive: false } as never)).rejects.toThrow(NotFoundException)
    })

    it('deactivates an existing drug', async () => {
      prisma.drug.findFirst.mockResolvedValue(buildDrugRow())
      prisma.drug.update.mockResolvedValue(buildDrugRow({ isActive: false }))

      const result = await service.update('org_1', 'drug_1', { isActive: false } as never)

      expect(result.isActive).toBe(false)
    })
  })

  describe('adjustStock', () => {
    it('increases stock for a restock delivery', async () => {
      prisma.drug.findFirst.mockResolvedValue(buildDrugRow({ currentStock: 100, reservedStock: 10 }))
      prisma.drug.update.mockResolvedValue(buildDrugRow({ currentStock: 150, reservedStock: 10 }))

      const result = await service.adjustStock('org_1', 'drug_1', { quantity: 50 } as never)

      expect(prisma.drug.update).toHaveBeenCalledWith({ where: { id: 'drug_1' }, data: { currentStock: 150 } })
      expect(result.currentStock).toBe(150)
    })

    it('rejects an adjustment that would leave stock below what is already reserved', async () => {
      prisma.drug.findFirst.mockResolvedValue(buildDrugRow({ currentStock: 20, reservedStock: 15 }))

      await expect(service.adjustStock('org_1', 'drug_1', { quantity: -10 } as never)).rejects.toThrow(BadRequestException)
    })
  })

  describe('requireDrug', () => {
    it('throws NotFoundException when the drug does not exist for the org', async () => {
      prisma.drug.findFirst.mockResolvedValue(null)

      await expect(service.requireDrug('org_1', 'missing')).rejects.toThrow(NotFoundException)
    })
  })

  describe('countLowStock / countExpiringSoon', () => {
    it('counts active drugs at or below their reorder level', async () => {
      prisma.drug.findMany.mockResolvedValue([
        { currentStock: 5, reorderLevel: 20 },
        { currentStock: 50, reorderLevel: 20 },
      ])

      await expect(service.countLowStock('org_1')).resolves.toBe(1)
    })

    it('counts active drugs expiring within the given window', async () => {
      prisma.drug.count.mockResolvedValue(3)

      await expect(service.countExpiringSoon('org_1', 30)).resolves.toBe(3)
    })
  })
})
