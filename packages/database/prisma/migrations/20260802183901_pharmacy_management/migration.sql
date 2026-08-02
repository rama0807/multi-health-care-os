/*
  Warnings:

  - You are about to drop the `medications` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "DispenseStatus" AS ENUM ('PENDING', 'PREPARING', 'READY', 'DISPENSED', 'CANCELLED', 'RETURNED');

-- DropForeignKey
ALTER TABLE "medications" DROP CONSTRAINT "medications_organizationId_fkey";

-- DropTable
DROP TABLE "medications";

-- CreateTable
CREATE TABLE "drugs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "genericName" TEXT NOT NULL,
    "brandName" TEXT,
    "strength" TEXT,
    "dosageForm" TEXT NOT NULL,
    "manufacturer" TEXT,
    "batchNumber" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "taxPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "currentStock" INTEGER NOT NULL DEFAULT 0,
    "reservedStock" INTEGER NOT NULL DEFAULT 0,
    "minStockLevel" INTEGER NOT NULL DEFAULT 10,
    "reorderLevel" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drugs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispense_orders" (
    "id" TEXT NOT NULL,
    "dispenseNumber" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "DispenseStatus" NOT NULL DEFAULT 'PENDING',
    "preparedByUserId" TEXT,
    "dispensedByUserId" TEXT,
    "dispensedAt" TIMESTAMP(3),
    "rejected" BOOLEAN NOT NULL DEFAULT false,
    "cancelReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispense_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispense_items" (
    "id" TEXT NOT NULL,
    "dispenseOrderId" TEXT NOT NULL,
    "prescriptionItemId" TEXT NOT NULL,
    "drugId" TEXT,
    "medicationName" TEXT NOT NULL,
    "quantityRequested" INTEGER NOT NULL,
    "quantityDispensed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispense_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drug_returns" (
    "id" TEXT NOT NULL,
    "dispenseOrderId" TEXT NOT NULL,
    "dispenseItemId" TEXT NOT NULL,
    "drugId" TEXT,
    "organizationId" TEXT NOT NULL,
    "quantityReturned" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "returnedByUserId" TEXT NOT NULL,
    "returnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drug_returns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "drugs_organizationId_idx" ON "drugs"("organizationId");

-- CreateIndex
CREATE INDEX "drugs_organizationId_expiryDate_idx" ON "drugs"("organizationId", "expiryDate");

-- CreateIndex
CREATE INDEX "drugs_organizationId_isActive_idx" ON "drugs"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "dispense_orders_prescriptionId_key" ON "dispense_orders"("prescriptionId");

-- CreateIndex
CREATE INDEX "dispense_orders_organizationId_status_idx" ON "dispense_orders"("organizationId", "status");

-- CreateIndex
CREATE INDEX "dispense_orders_patientId_organizationId_idx" ON "dispense_orders"("patientId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "dispense_orders_dispenseNumber_organizationId_key" ON "dispense_orders"("dispenseNumber", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "dispense_items_prescriptionItemId_key" ON "dispense_items"("prescriptionItemId");

-- CreateIndex
CREATE INDEX "dispense_items_dispenseOrderId_idx" ON "dispense_items"("dispenseOrderId");

-- CreateIndex
CREATE INDEX "dispense_items_drugId_idx" ON "dispense_items"("drugId");

-- CreateIndex
CREATE INDEX "drug_returns_dispenseOrderId_idx" ON "drug_returns"("dispenseOrderId");

-- CreateIndex
CREATE INDEX "drug_returns_organizationId_idx" ON "drug_returns"("organizationId");

-- AddForeignKey
ALTER TABLE "drugs" ADD CONSTRAINT "drugs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispense_orders" ADD CONSTRAINT "dispense_orders_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "prescriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispense_orders" ADD CONSTRAINT "dispense_orders_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispense_orders" ADD CONSTRAINT "dispense_orders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispense_items" ADD CONSTRAINT "dispense_items_dispenseOrderId_fkey" FOREIGN KEY ("dispenseOrderId") REFERENCES "dispense_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispense_items" ADD CONSTRAINT "dispense_items_prescriptionItemId_fkey" FOREIGN KEY ("prescriptionItemId") REFERENCES "prescription_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispense_items" ADD CONSTRAINT "dispense_items_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "drugs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drug_returns" ADD CONSTRAINT "drug_returns_dispenseOrderId_fkey" FOREIGN KEY ("dispenseOrderId") REFERENCES "dispense_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drug_returns" ADD CONSTRAINT "drug_returns_dispenseItemId_fkey" FOREIGN KEY ("dispenseItemId") REFERENCES "dispense_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drug_returns" ADD CONSTRAINT "drug_returns_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "drugs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drug_returns" ADD CONSTRAINT "drug_returns_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
