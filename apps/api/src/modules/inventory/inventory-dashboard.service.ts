import { InventoryDashboardStats } from '@medicore/types'
import { Injectable } from '@nestjs/common'
import { GrnStatus, PurchaseOrderStatus, PurchaseRequestStatus, RequisitionStatus } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { AssetsService } from './assets.service'
import { StockService } from './stock.service'

@Injectable()
export class InventoryDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
    private readonly assetsService: AssetsService,
  ) {}

  async getStats(organizationId: string): Promise<InventoryDashboardStats> {
    const [
      totalItems,
      totalStores,
      inventoryValue,
      lowStockCount,
      expiringSoonCount,
      expiredCount,
      pendingPurchaseRequests,
      pendingPurchaseOrders,
      pendingGrns,
      pendingRequisitions,
      maintenanceDueCount,
      assetsInBreakdown,
    ] = await Promise.all([
      this.prisma.inventoryItem.count({ where: { organizationId, isActive: true } }),
      this.prisma.inventoryStore.count({ where: { organizationId, isActive: true } }),
      this.stockService.totalInventoryValue(organizationId),
      this.stockService.countLowStock(organizationId),
      this.stockService.countExpiringSoon(organizationId),
      this.stockService.countExpired(organizationId),
      this.prisma.purchaseRequest.count({ where: { organizationId, status: PurchaseRequestStatus.SUBMITTED } }),
      this.prisma.purchaseOrder.count({
        where: { organizationId, status: { in: [PurchaseOrderStatus.SUBMITTED, PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.SENT] } },
      }),
      this.prisma.goodsReceiptNote.count({ where: { organizationId, status: GrnStatus.DRAFT } }),
      this.prisma.storeRequisition.count({
        where: { organizationId, status: { in: [RequisitionStatus.REQUESTED, RequisitionStatus.APPROVED, RequisitionStatus.PARTIALLY_ISSUED] } },
      }),
      this.assetsService.countDueForMaintenance(organizationId),
      this.assetsService.countInBreakdown(organizationId),
    ])

    return {
      totalItems,
      totalStores,
      inventoryValue,
      lowStockCount,
      expiringSoonCount,
      expiredCount,
      pendingPurchaseRequests,
      pendingPurchaseOrders,
      pendingGrns,
      pendingRequisitions,
      maintenanceDueCount,
      assetsInBreakdown,
    }
  }
}
