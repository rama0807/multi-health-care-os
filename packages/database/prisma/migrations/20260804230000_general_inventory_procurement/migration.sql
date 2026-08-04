-- CreateEnum
CREATE TYPE "InventoryItemType" AS ENUM ('ASSET', 'CONSUMABLE');

-- CreateEnum
CREATE TYPE "InventoryStoreType" AS ENUM ('CENTRAL', 'WARD', 'ICU', 'EMERGENCY', 'OT', 'LABORATORY', 'RADIOLOGY', 'PHARMACY', 'HOUSEKEEPING', 'BIOMEDICAL', 'GENERAL');

-- CreateEnum
CREATE TYPE "StoreManagerRole" AS ENUM ('MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "InventoryBatchStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'DAMAGED', 'EXPIRED', 'LOST', 'CONSUMED');

-- CreateEnum
CREATE TYPE "InventoryAdjustmentType" AS ENUM ('OPENING', 'DAMAGE', 'LOSS', 'EXPIRY', 'CORRECTION', 'AUDIT', 'ISSUE', 'RECEIPT', 'TRANSFER');

-- CreateEnum
CREATE TYPE "StockTransferStatus" AS ENUM ('DRAFT', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CONVERTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GrnStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VendorInvoiceStatus" AS ENUM ('PENDING', 'VERIFIED', 'PAID', 'DISPUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VendorReturnStatus" AS ENUM ('DRAFT', 'SENT', 'ACKNOWLEDGED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RequisitionStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'ISSUED', 'PARTIALLY_ISSUED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('IN_USE', 'IN_STORE', 'UNDER_MAINTENANCE', 'BREAKDOWN', 'DECOMMISSIONED');

-- CreateEnum
CREATE TYPE "AssetMaintenanceType" AS ENUM ('PREVENTIVE', 'CALIBRATION', 'AMC', 'BREAKDOWN', 'REPAIR');

-- CreateEnum
CREATE TYPE "AssetMaintenanceStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockAuditStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- DropIndex
DROP INDEX "inventory_items_sku_organizationId_key";

-- AlterTable
ALTER TABLE "inventory_items" DROP COLUMN "category",
DROP COLUMN "quantityInStock",
DROP COLUMN "reorderLevel",
DROP COLUMN "reorderQuantity",
DROP COLUMN "sku",
DROP COLUMN "storageLocation",
ADD COLUMN     "barcodeValue" TEXT,
ADD COLUMN     "brandId" TEXT,
ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "gstPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "hsnCode" TEXT,
ADD COLUMN     "itemGroupId" TEXT,
ADD COLUMN     "itemType" "InventoryItemType" NOT NULL DEFAULT 'CONSUMABLE',
ADD COLUMN     "manufacturerId" TEXT,
ADD COLUMN     "qrCodeValue" TEXT,
ADD COLUMN     "subcategoryId" TEXT,
ADD COLUMN     "trackBatch" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trackExpiry" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trackSerial" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unitId" TEXT;

-- CreateTable
CREATE TABLE "inventory_categories" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_item_groups" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_item_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_units" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_manufacturers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_manufacturers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_brands" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "manufacturerId" TEXT,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_stores" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "InventoryStoreType" NOT NULL DEFAULT 'GENERAL',
    "location" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_store_managers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "StoreManagerRole" NOT NULL DEFAULT 'STAFF',
    "assignedByUserId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_store_managers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "bankIfsc" TEXT,
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_ratings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comments" TEXT,
    "ratedByUserId" TEXT NOT NULL,
    "ratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_stocks" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "currentStock" INTEGER NOT NULL DEFAULT 0,
    "reservedStock" INTEGER NOT NULL DEFAULT 0,
    "damagedStock" INTEGER NOT NULL DEFAULT 0,
    "expiredStock" INTEGER NOT NULL DEFAULT 0,
    "lostStock" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "maxStock" INTEGER NOT NULL DEFAULT 0,
    "openingStock" INTEGER NOT NULL DEFAULT 0,
    "openingStockDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_batches" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "inventoryStockId" TEXT NOT NULL,
    "batchNumber" TEXT,
    "serialNumber" TEXT,
    "manufactureDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "status" "InventoryBatchStatus" NOT NULL DEFAULT 'AVAILABLE',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_stock_adjustments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "batchId" TEXT,
    "type" "InventoryAdjustmentType" NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "reason" TEXT,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "adjustedByUserId" TEXT NOT NULL,
    "adjustedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_stock_transfers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "fromStoreId" TEXT NOT NULL,
    "toStoreId" TEXT NOT NULL,
    "status" "StockTransferStatus" NOT NULL DEFAULT 'DRAFT',
    "requestedByUserId" TEXT NOT NULL,
    "dispatchedByUserId" TEXT,
    "dispatchedAt" TIMESTAMP(3),
    "receivedByUserId" TEXT,
    "receivedAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_stock_transfer_items" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchId" TEXT,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "inventory_stock_transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_requests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "status" "PurchaseRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_request_items" (
    "id" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "purchase_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "purchaseRequestId" TEXT,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "expectedDeliveryDate" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantityOrdered" INTEGER NOT NULL,
    "quantityReceived" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "taxPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_notes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "grnNumber" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "receivedByUserId" TEXT NOT NULL,
    "status" "GrnStatus" NOT NULL DEFAULT 'DRAFT',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vendorId" TEXT,

    CONSTRAINT "goods_receipt_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_items" (
    "id" TEXT NOT NULL,
    "goodsReceiptNoteId" TEXT NOT NULL,
    "purchaseOrderItemId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantityReceived" INTEGER NOT NULL,
    "batchNumber" TEXT,
    "serialNumber" TEXT,
    "manufactureDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "unitPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "inventoryBatchId" TEXT,

    CONSTRAINT "goods_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_invoices" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "goodsReceiptNoteId" TEXT,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "VendorInvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_returns" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "goodsReceiptNoteId" TEXT,
    "storeId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "VendorReturnStatus" NOT NULL DEFAULT 'DRAFT',
    "returnedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_return_items" (
    "id" TEXT NOT NULL,
    "vendorReturnId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "vendor_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_requisitions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requisitionNumber" TEXT NOT NULL,
    "fromStoreId" TEXT NOT NULL,
    "toStoreId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "status" "RequisitionStatus" NOT NULL DEFAULT 'REQUESTED',
    "priority" "Priority" NOT NULL DEFAULT 'ROUTINE',
    "notes" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "issuedByUserId" TEXT,
    "issuedAt" TIMESTAMP(3),
    "receivedByUserId" TEXT,
    "receivedAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_requisition_items" (
    "id" TEXT NOT NULL,
    "storeRequisitionId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchId" TEXT,
    "quantityRequested" INTEGER NOT NULL,
    "quantityIssued" INTEGER NOT NULL DEFAULT 0,
    "quantityReceived" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "store_requisition_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "assetTag" TEXT NOT NULL,
    "serialNumber" TEXT,
    "status" "AssetStatus" NOT NULL DEFAULT 'IN_STORE',
    "purchaseDate" TIMESTAMP(3),
    "purchasePrice" DECIMAL(12,2),
    "warrantyExpiryDate" TIMESTAMP(3),
    "amcVendorId" TEXT,
    "amcStartDate" TIMESTAMP(3),
    "amcEndDate" TIMESTAMP(3),
    "lastCalibrationDate" TIMESTAMP(3),
    "nextCalibrationDate" TIMESTAMP(3),
    "assignedToUserId" TEXT,
    "assignedToDepartmentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_maintenance_records" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "type" "AssetMaintenanceType" NOT NULL,
    "status" "AssetMaintenanceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "description" TEXT NOT NULL,
    "cost" DECIMAL(12,2),
    "performedBy" TEXT,
    "vendorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_assignments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "assignedToUserId" TEXT,
    "assignedToDepartmentId" TEXT,
    "storeId" TEXT,
    "assignedByUserId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "asset_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_audits" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "auditNumber" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "status" "StockAuditStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledDate" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "conductedByUserId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_audit_items" (
    "id" TEXT NOT NULL,
    "stockAuditId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchId" TEXT,
    "systemQuantity" INTEGER NOT NULL,
    "countedQuantity" INTEGER,
    "varianceQuantity" INTEGER,
    "remarks" TEXT,

    CONSTRAINT "stock_audit_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_categories_organizationId_idx" ON "inventory_categories"("organizationId");

-- CreateIndex
CREATE INDEX "inventory_categories_parentId_idx" ON "inventory_categories"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_categories_code_organizationId_key" ON "inventory_categories"("code", "organizationId");

-- CreateIndex
CREATE INDEX "inventory_item_groups_organizationId_idx" ON "inventory_item_groups"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_item_groups_code_organizationId_key" ON "inventory_item_groups"("code", "organizationId");

-- CreateIndex
CREATE INDEX "inventory_units_organizationId_idx" ON "inventory_units"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_units_symbol_organizationId_key" ON "inventory_units"("symbol", "organizationId");

-- CreateIndex
CREATE INDEX "inventory_manufacturers_organizationId_idx" ON "inventory_manufacturers"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_manufacturers_name_organizationId_key" ON "inventory_manufacturers"("name", "organizationId");

-- CreateIndex
CREATE INDEX "inventory_brands_organizationId_idx" ON "inventory_brands"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_brands_name_organizationId_key" ON "inventory_brands"("name", "organizationId");

-- CreateIndex
CREATE INDEX "inventory_stores_organizationId_idx" ON "inventory_stores"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_stores_code_organizationId_key" ON "inventory_stores"("code", "organizationId");

-- CreateIndex
CREATE INDEX "inventory_store_managers_organizationId_idx" ON "inventory_store_managers"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_store_managers_storeId_userId_key" ON "inventory_store_managers"("storeId", "userId");

-- CreateIndex
CREATE INDEX "vendors_organizationId_idx" ON "vendors"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_code_organizationId_key" ON "vendors"("code", "organizationId");

-- CreateIndex
CREATE INDEX "vendor_ratings_vendorId_idx" ON "vendor_ratings"("vendorId");

-- CreateIndex
CREATE INDEX "vendor_ratings_organizationId_idx" ON "vendor_ratings"("organizationId");

-- CreateIndex
CREATE INDEX "inventory_stocks_organizationId_idx" ON "inventory_stocks"("organizationId");

-- CreateIndex
CREATE INDEX "inventory_stocks_organizationId_storeId_idx" ON "inventory_stocks"("organizationId", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_stocks_itemId_storeId_key" ON "inventory_stocks"("itemId", "storeId");

-- CreateIndex
CREATE INDEX "inventory_batches_organizationId_idx" ON "inventory_batches"("organizationId");

-- CreateIndex
CREATE INDEX "inventory_batches_itemId_storeId_idx" ON "inventory_batches"("itemId", "storeId");

-- CreateIndex
CREATE INDEX "inventory_batches_organizationId_expiryDate_idx" ON "inventory_batches"("organizationId", "expiryDate");

-- CreateIndex
CREATE INDEX "inventory_stock_adjustments_organizationId_storeId_idx" ON "inventory_stock_adjustments"("organizationId", "storeId");

-- CreateIndex
CREATE INDEX "inventory_stock_adjustments_itemId_idx" ON "inventory_stock_adjustments"("itemId");

-- CreateIndex
CREATE INDEX "inventory_stock_transfers_organizationId_status_idx" ON "inventory_stock_transfers"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_stock_transfers_transferNumber_organizationId_key" ON "inventory_stock_transfers"("transferNumber", "organizationId");

-- CreateIndex
CREATE INDEX "inventory_stock_transfer_items_transferId_idx" ON "inventory_stock_transfer_items"("transferId");

-- CreateIndex
CREATE INDEX "purchase_requests_organizationId_status_idx" ON "purchase_requests"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_requests_requestNumber_organizationId_key" ON "purchase_requests"("requestNumber", "organizationId");

-- CreateIndex
CREATE INDEX "purchase_request_items_purchaseRequestId_idx" ON "purchase_request_items"("purchaseRequestId");

-- CreateIndex
CREATE INDEX "purchase_orders_organizationId_status_idx" ON "purchase_orders"("organizationId", "status");

-- CreateIndex
CREATE INDEX "purchase_orders_vendorId_idx" ON "purchase_orders"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_poNumber_organizationId_key" ON "purchase_orders"("poNumber", "organizationId");

-- CreateIndex
CREATE INDEX "purchase_order_items_purchaseOrderId_idx" ON "purchase_order_items"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "goods_receipt_notes_organizationId_idx" ON "goods_receipt_notes"("organizationId");

-- CreateIndex
CREATE INDEX "goods_receipt_notes_purchaseOrderId_idx" ON "goods_receipt_notes"("purchaseOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipt_notes_grnNumber_organizationId_key" ON "goods_receipt_notes"("grnNumber", "organizationId");

-- CreateIndex
CREATE INDEX "goods_receipt_items_goodsReceiptNoteId_idx" ON "goods_receipt_items"("goodsReceiptNoteId");

-- CreateIndex
CREATE INDEX "vendor_invoices_organizationId_status_idx" ON "vendor_invoices"("organizationId", "status");

-- CreateIndex
CREATE INDEX "vendor_invoices_vendorId_idx" ON "vendor_invoices"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_invoices_invoiceNumber_organizationId_key" ON "vendor_invoices"("invoiceNumber", "organizationId");

-- CreateIndex
CREATE INDEX "vendor_returns_organizationId_status_idx" ON "vendor_returns"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_returns_returnNumber_organizationId_key" ON "vendor_returns"("returnNumber", "organizationId");

-- CreateIndex
CREATE INDEX "vendor_return_items_vendorReturnId_idx" ON "vendor_return_items"("vendorReturnId");

-- CreateIndex
CREATE INDEX "store_requisitions_organizationId_status_idx" ON "store_requisitions"("organizationId", "status");

-- CreateIndex
CREATE INDEX "store_requisitions_toStoreId_idx" ON "store_requisitions"("toStoreId");

-- CreateIndex
CREATE UNIQUE INDEX "store_requisitions_requisitionNumber_organizationId_key" ON "store_requisitions"("requisitionNumber", "organizationId");

-- CreateIndex
CREATE INDEX "store_requisition_items_storeRequisitionId_idx" ON "store_requisition_items"("storeRequisitionId");

-- CreateIndex
CREATE INDEX "assets_organizationId_status_idx" ON "assets"("organizationId", "status");

-- CreateIndex
CREATE INDEX "assets_storeId_idx" ON "assets"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "assets_assetTag_organizationId_key" ON "assets"("assetTag", "organizationId");

-- CreateIndex
CREATE INDEX "asset_maintenance_records_organizationId_idx" ON "asset_maintenance_records"("organizationId");

-- CreateIndex
CREATE INDEX "asset_maintenance_records_assetId_idx" ON "asset_maintenance_records"("assetId");

-- CreateIndex
CREATE INDEX "asset_assignments_organizationId_idx" ON "asset_assignments"("organizationId");

-- CreateIndex
CREATE INDEX "asset_assignments_assetId_idx" ON "asset_assignments"("assetId");

-- CreateIndex
CREATE INDEX "stock_audits_organizationId_status_idx" ON "stock_audits"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "stock_audits_auditNumber_organizationId_key" ON "stock_audits"("auditNumber", "organizationId");

-- CreateIndex
CREATE INDEX "stock_audit_items_stockAuditId_idx" ON "stock_audit_items"("stockAuditId");

-- CreateIndex
CREATE INDEX "inventory_items_organizationId_itemType_idx" ON "inventory_items"("organizationId", "itemType");

-- CreateIndex
CREATE INDEX "inventory_items_organizationId_isActive_idx" ON "inventory_items"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_code_organizationId_key" ON "inventory_items"("code", "organizationId");

-- AddForeignKey
ALTER TABLE "inventory_categories" ADD CONSTRAINT "inventory_categories_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_categories" ADD CONSTRAINT "inventory_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "inventory_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_item_groups" ADD CONSTRAINT "inventory_item_groups_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_units" ADD CONSTRAINT "inventory_units_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_manufacturers" ADD CONSTRAINT "inventory_manufacturers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_brands" ADD CONSTRAINT "inventory_brands_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_brands" ADD CONSTRAINT "inventory_brands_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "inventory_manufacturers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "inventory_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_itemGroupId_fkey" FOREIGN KEY ("itemGroupId") REFERENCES "inventory_item_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "inventory_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "inventory_manufacturers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "inventory_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stores" ADD CONSTRAINT "inventory_stores_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_store_managers" ADD CONSTRAINT "inventory_store_managers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_store_managers" ADD CONSTRAINT "inventory_store_managers_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "inventory_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_ratings" ADD CONSTRAINT "vendor_ratings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_ratings" ADD CONSTRAINT "vendor_ratings_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stocks" ADD CONSTRAINT "inventory_stocks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stocks" ADD CONSTRAINT "inventory_stocks_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stocks" ADD CONSTRAINT "inventory_stocks_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "inventory_stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_inventoryStockId_fkey" FOREIGN KEY ("inventoryStockId") REFERENCES "inventory_stocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock_adjustments" ADD CONSTRAINT "inventory_stock_adjustments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock_adjustments" ADD CONSTRAINT "inventory_stock_adjustments_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock_adjustments" ADD CONSTRAINT "inventory_stock_adjustments_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock_transfers" ADD CONSTRAINT "inventory_stock_transfers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock_transfers" ADD CONSTRAINT "inventory_stock_transfers_fromStoreId_fkey" FOREIGN KEY ("fromStoreId") REFERENCES "inventory_stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock_transfers" ADD CONSTRAINT "inventory_stock_transfers_toStoreId_fkey" FOREIGN KEY ("toStoreId") REFERENCES "inventory_stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock_transfer_items" ADD CONSTRAINT "inventory_stock_transfer_items_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "inventory_stock_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock_transfer_items" ADD CONSTRAINT "inventory_stock_transfer_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock_transfer_items" ADD CONSTRAINT "inventory_stock_transfer_items_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "inventory_stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "inventory_stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "purchase_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_notes" ADD CONSTRAINT "goods_receipt_notes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_notes" ADD CONSTRAINT "goods_receipt_notes_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_notes" ADD CONSTRAINT "goods_receipt_notes_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "inventory_stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_notes" ADD CONSTRAINT "goods_receipt_notes_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_goodsReceiptNoteId_fkey" FOREIGN KEY ("goodsReceiptNoteId") REFERENCES "goods_receipt_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "purchase_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_inventoryBatchId_fkey" FOREIGN KEY ("inventoryBatchId") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invoices" ADD CONSTRAINT "vendor_invoices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invoices" ADD CONSTRAINT "vendor_invoices_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invoices" ADD CONSTRAINT "vendor_invoices_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invoices" ADD CONSTRAINT "vendor_invoices_goodsReceiptNoteId_fkey" FOREIGN KEY ("goodsReceiptNoteId") REFERENCES "goods_receipt_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_returns" ADD CONSTRAINT "vendor_returns_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_returns" ADD CONSTRAINT "vendor_returns_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_returns" ADD CONSTRAINT "vendor_returns_goodsReceiptNoteId_fkey" FOREIGN KEY ("goodsReceiptNoteId") REFERENCES "goods_receipt_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_returns" ADD CONSTRAINT "vendor_returns_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "inventory_stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_return_items" ADD CONSTRAINT "vendor_return_items_vendorReturnId_fkey" FOREIGN KEY ("vendorReturnId") REFERENCES "vendor_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_return_items" ADD CONSTRAINT "vendor_return_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_return_items" ADD CONSTRAINT "vendor_return_items_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_requisitions" ADD CONSTRAINT "store_requisitions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_requisitions" ADD CONSTRAINT "store_requisitions_fromStoreId_fkey" FOREIGN KEY ("fromStoreId") REFERENCES "inventory_stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_requisitions" ADD CONSTRAINT "store_requisitions_toStoreId_fkey" FOREIGN KEY ("toStoreId") REFERENCES "inventory_stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_requisition_items" ADD CONSTRAINT "store_requisition_items_storeRequisitionId_fkey" FOREIGN KEY ("storeRequisitionId") REFERENCES "store_requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_requisition_items" ADD CONSTRAINT "store_requisition_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_requisition_items" ADD CONSTRAINT "store_requisition_items_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "inventory_stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_amcVendorId_fkey" FOREIGN KEY ("amcVendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_assignedToDepartmentId_fkey" FOREIGN KEY ("assignedToDepartmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_maintenance_records" ADD CONSTRAINT "asset_maintenance_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_maintenance_records" ADD CONSTRAINT "asset_maintenance_records_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_maintenance_records" ADD CONSTRAINT "asset_maintenance_records_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "inventory_stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_audits" ADD CONSTRAINT "stock_audits_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_audits" ADD CONSTRAINT "stock_audits_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "inventory_stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_audit_items" ADD CONSTRAINT "stock_audit_items_stockAuditId_fkey" FOREIGN KEY ("stockAuditId") REFERENCES "stock_audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_audit_items" ADD CONSTRAINT "stock_audit_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_audit_items" ADD CONSTRAINT "stock_audit_items_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

