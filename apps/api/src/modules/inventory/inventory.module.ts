import { Module } from '@nestjs/common'

import { AssetsController } from './assets.controller'
import { AssetsService } from './assets.service'
import { GoodsReceiptController } from './goods-receipt.controller'
import { GoodsReceiptService } from './goods-receipt.service'
import { InventoryDashboardController } from './inventory-dashboard.controller'
import { InventoryDashboardService } from './inventory-dashboard.service'
import { InventoryItemsController } from './inventory-items.controller'
import { InventoryItemsService } from './inventory-items.service'
import { ItemMasterController } from './item-master.controller'
import { ItemMasterService } from './item-master.service'
import { PurchaseOrdersController } from './purchase-orders.controller'
import { PurchaseOrdersService } from './purchase-orders.service'
import { PurchaseRequestsController } from './purchase-requests.controller'
import { PurchaseRequestsService } from './purchase-requests.service'
import { RequisitionsController } from './requisitions.controller'
import { RequisitionsService } from './requisitions.service'
import { StockAuditController } from './stock-audit.controller'
import { StockAuditService } from './stock-audit.service'
import { StockController } from './stock.controller'
import { StockService } from './stock.service'
import { StoresController } from './stores.controller'
import { StoresService } from './stores.service'
import { TransfersController } from './transfers.controller'
import { TransfersService } from './transfers.service'
import { VendorInvoicesController } from './vendor-invoices.controller'
import { VendorInvoicesService } from './vendor-invoices.service'
import { VendorsController } from './vendors.controller'
import { VendorsService } from './vendors.service'

/**
 * General Hospital Inventory & Procurement (Milestone 13 / ADR-0020) —
 * item master, stores, stock ledger, procurement (PR -> PO -> GRN ->
 * vendor invoice), vendor management, internal requisitions, asset
 * management, and stock audit. Replaces the 3-line no-op scaffold and the
 * unused `InventoryItem` model from the original scaffolding commit.
 */
@Module({
  controllers: [
    ItemMasterController,
    InventoryItemsController,
    StoresController,
    StockController,
    TransfersController,
    VendorsController,
    PurchaseRequestsController,
    PurchaseOrdersController,
    GoodsReceiptController,
    VendorInvoicesController,
    RequisitionsController,
    AssetsController,
    StockAuditController,
    InventoryDashboardController,
  ],
  providers: [
    ItemMasterService,
    InventoryItemsService,
    StoresService,
    StockService,
    TransfersService,
    VendorsService,
    PurchaseRequestsService,
    PurchaseOrdersService,
    GoodsReceiptService,
    VendorInvoicesService,
    RequisitionsService,
    AssetsService,
    StockAuditService,
    InventoryDashboardService,
  ],
  exports: [InventoryItemsService, StoresService, StockService, VendorsService],
})
export class InventoryModule {}
