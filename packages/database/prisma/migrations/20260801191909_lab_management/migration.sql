-- AlterTable
ALTER TABLE "lab_test_items" ADD COLUMN     "catalogItemId" TEXT,
ADD COLUMN     "criticalHigh" DOUBLE PRECISION,
ADD COLUMN     "criticalLow" DOUBLE PRECISION,
ADD COLUMN     "referenceRangeHigh" DOUBLE PRECISION,
ADD COLUMN     "referenceRangeLow" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "lab_tests" ADD COLUMN     "encounterId" TEXT;

-- CreateTable
CREATE TABLE "lab_test_catalog_items" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "testCode" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT,
    "referenceRangeLow" DOUBLE PRECISION,
    "referenceRangeHigh" DOUBLE PRECISION,
    "referenceRangeText" TEXT,
    "criticalLow" DOUBLE PRECISION,
    "criticalHigh" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_test_catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lab_test_catalog_items_organizationId_idx" ON "lab_test_catalog_items"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "lab_test_catalog_items_organizationId_testCode_key" ON "lab_test_catalog_items"("organizationId", "testCode");

-- CreateIndex
CREATE INDEX "lab_test_items_catalogItemId_idx" ON "lab_test_items"("catalogItemId");

-- CreateIndex
CREATE INDEX "lab_tests_encounterId_idx" ON "lab_tests"("encounterId");

-- AddForeignKey
ALTER TABLE "lab_test_catalog_items" ADD CONSTRAINT "lab_test_catalog_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_tests" ADD CONSTRAINT "lab_tests_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test_items" ADD CONSTRAINT "lab_test_items_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "lab_test_catalog_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
