-- CreateEnum
CREATE TYPE "RadiologyAttachmentType" AS ENUM ('IMAGE', 'EXTERNAL_IMAGING', 'DICOM_PLACEHOLDER', 'PDF', 'OTHER');

-- AlterEnum
ALTER TYPE "RadiologyStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "radiology_orders" ADD COLUMN     "catalogItemId" TEXT,
ADD COLUMN     "durationMinutes" INTEGER,
ADD COLUMN     "encounterId" TEXT,
ADD COLUMN     "machine" TEXT,
ADD COLUMN     "radiologistDoctorId" TEXT,
ADD COLUMN     "recommendations" TEXT,
ADD COLUMN     "releasedAt" TIMESTAMP(3),
ADD COLUMN     "releasedByUserId" TEXT,
ADD COLUMN     "room" TEXT,
ADD COLUMN     "scheduledAt" TIMESTAMP(3),
ADD COLUMN     "technicianUserId" TEXT,
ADD COLUMN     "technique" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedByUserId" TEXT;

-- CreateTable
CREATE TABLE "radiology_catalog_items" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "modality" TEXT NOT NULL,
    "bodyPart" TEXT NOT NULL,
    "contrastRequired" BOOLEAN NOT NULL DEFAULT false,
    "price" DECIMAL(10,2) NOT NULL,
    "estimatedDurationMinutes" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "radiology_catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radiology_reports" (
    "id" TEXT NOT NULL,
    "radiologyOrderId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "clinicalIndication" TEXT,
    "technique" TEXT,
    "findings" TEXT,
    "impression" TEXT,
    "recommendations" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "radiology_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radiology_attachments" (
    "id" TEXT NOT NULL,
    "radiologyOrderId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "RadiologyAttachmentType" NOT NULL DEFAULT 'OTHER',
    "fileName" TEXT,
    "fileUrl" TEXT,
    "mimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "metadata" JSONB,
    "uploadedByUserId" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "radiology_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "radiology_catalog_items_organizationId_idx" ON "radiology_catalog_items"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "radiology_catalog_items_organizationId_code_key" ON "radiology_catalog_items"("organizationId", "code");

-- CreateIndex
CREATE INDEX "radiology_reports_radiologyOrderId_idx" ON "radiology_reports"("radiologyOrderId");

-- CreateIndex
CREATE INDEX "radiology_attachments_radiologyOrderId_idx" ON "radiology_attachments"("radiologyOrderId");

-- CreateIndex
CREATE INDEX "radiology_orders_status_organizationId_idx" ON "radiology_orders"("status", "organizationId");

-- CreateIndex
CREATE INDEX "radiology_orders_encounterId_idx" ON "radiology_orders"("encounterId");

-- AddForeignKey
ALTER TABLE "radiology_catalog_items" ADD CONSTRAINT "radiology_catalog_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiology_orders" ADD CONSTRAINT "radiology_orders_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiology_orders" ADD CONSTRAINT "radiology_orders_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "radiology_catalog_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiology_reports" ADD CONSTRAINT "radiology_reports_radiologyOrderId_fkey" FOREIGN KEY ("radiologyOrderId") REFERENCES "radiology_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiology_attachments" ADD CONSTRAINT "radiology_attachments_radiologyOrderId_fkey" FOREIGN KEY ("radiologyOrderId") REFERENCES "radiology_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
