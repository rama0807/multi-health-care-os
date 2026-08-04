-- CreateEnum
CREATE TYPE "WardType" AS ENUM ('GENERAL', 'SEMI_PRIVATE', 'PRIVATE', 'ICU', 'NICU', 'PICU', 'HDU');

-- CreateEnum
CREATE TYPE "WardStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'UNDER_RENOVATION');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "AdmissionType" AS ENUM ('EMERGENCY', 'SCHEDULED', 'INSURANCE', 'TRANSFER_FROM_OPD');

-- CreateEnum
CREATE TYPE "BedAllocationAction" AS ENUM ('ALLOCATED', 'VACATED', 'RESERVED', 'RESERVATION_CANCELLED');

-- AlterEnum
BEGIN;
CREATE TYPE "AdmissionStatus_new" AS ENUM ('ADMITTED', 'DISCHARGED', 'ABSCONDED', 'CANCELLED');
ALTER TABLE "admissions" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "admissions" ALTER COLUMN "status" TYPE "AdmissionStatus_new" USING ("status"::text::"AdmissionStatus_new");
ALTER TYPE "AdmissionStatus" RENAME TO "AdmissionStatus_old";
ALTER TYPE "AdmissionStatus_new" RENAME TO "AdmissionStatus";
DROP TYPE "AdmissionStatus_old";
ALTER TABLE "admissions" ALTER COLUMN "status" SET DEFAULT 'ADMITTED';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "BedStatus_new" AS ENUM ('AVAILABLE', 'RESERVED', 'OCCUPIED', 'CLEANING', 'MAINTENANCE', 'BLOCKED');
ALTER TABLE "beds" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "beds" ALTER COLUMN "status" TYPE "BedStatus_new" USING ("status"::text::"BedStatus_new");
ALTER TYPE "BedStatus" RENAME TO "BedStatus_old";
ALTER TYPE "BedStatus_new" RENAME TO "BedStatus";
DROP TYPE "BedStatus_old";
ALTER TABLE "beds" ALTER COLUMN "status" SET DEFAULT 'AVAILABLE';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "BedType_new" AS ENUM ('GENERAL', 'SEMI_PRIVATE', 'PRIVATE', 'ICU', 'NICU', 'PICU', 'HDU');
ALTER TABLE "beds" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "beds" ALTER COLUMN "type" TYPE "BedType_new" USING ("type"::text::"BedType_new");
ALTER TYPE "BedType" RENAME TO "BedType_old";
ALTER TYPE "BedType_new" RENAME TO "BedType";
DROP TYPE "BedType_old";
ALTER TABLE "beds" ALTER COLUMN "type" SET DEFAULT 'GENERAL';
COMMIT;

-- AlterEnum
ALTER TYPE "EncounterType" ADD VALUE 'IPD';

-- DropForeignKey
ALTER TABLE "admissions" DROP CONSTRAINT "admissions_wardId_fkey";

-- DropIndex
DROP INDEX "admissions_organizationId_idx";

-- DropIndex
DROP INDEX "beds_bedNumber_wardId_key";

-- AlterTable
ALTER TABLE "admissions" DROP COLUMN "doctorId",
ADD COLUMN     "attendingDoctorId" TEXT NOT NULL,
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "encounterId" TEXT,
ADD COLUMN     "expectedDischargeAt" TIMESTAMP(3),
ADD COLUMN     "patientInsuranceId" TEXT,
ADD COLUMN     "roomId" TEXT,
ADD COLUMN     "type" "AdmissionType" NOT NULL DEFAULT 'SCHEDULED',
ALTER COLUMN "wardId" SET NOT NULL;

-- AlterTable
ALTER TABLE "beds" ADD COLUMN     "roomId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "wards" DROP COLUMN "isActive",
DROP COLUMN "totalBeds",
ADD COLUMN     "block" TEXT,
ADD COLUMN     "floor" TEXT,
ADD COLUMN     "status" "WardStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "type" "WardType" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "floor" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "chargesPerDay" DECIMAL(10,2) NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bed_allocations" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "bedId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "action" "BedAllocationAction" NOT NULL,
    "performedByUserId" TEXT,
    "reason" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bed_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bed_transfers" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fromBedId" TEXT,
    "toBedId" TEXT NOT NULL,
    "fromRoomId" TEXT,
    "toRoomId" TEXT,
    "fromWardId" TEXT,
    "toWardId" TEXT NOT NULL,
    "reason" TEXT,
    "transferredByUserId" TEXT,
    "transferredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bed_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rooms_organizationId_idx" ON "rooms"("organizationId");

-- CreateIndex
CREATE INDEX "rooms_wardId_idx" ON "rooms"("wardId");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_roomNumber_wardId_key" ON "rooms"("roomNumber", "wardId");

-- CreateIndex
CREATE INDEX "bed_allocations_admissionId_idx" ON "bed_allocations"("admissionId");

-- CreateIndex
CREATE INDEX "bed_allocations_bedId_idx" ON "bed_allocations"("bedId");

-- CreateIndex
CREATE INDEX "bed_allocations_organizationId_idx" ON "bed_allocations"("organizationId");

-- CreateIndex
CREATE INDEX "bed_transfers_admissionId_idx" ON "bed_transfers"("admissionId");

-- CreateIndex
CREATE INDEX "bed_transfers_organizationId_idx" ON "bed_transfers"("organizationId");

-- CreateIndex
CREATE INDEX "admissions_organizationId_status_idx" ON "admissions"("organizationId", "status");

-- CreateIndex
CREATE INDEX "admissions_bedId_idx" ON "admissions"("bedId");

-- CreateIndex
CREATE INDEX "admissions_wardId_idx" ON "admissions"("wardId");

-- CreateIndex
CREATE INDEX "beds_roomId_idx" ON "beds"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "beds_bedNumber_roomId_key" ON "beds"("bedNumber", "roomId");

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beds" ADD CONSTRAINT "beds_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_attendingDoctorId_fkey" FOREIGN KEY ("attendingDoctorId") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_patientInsuranceId_fkey" FOREIGN KEY ("patientInsuranceId") REFERENCES "patient_insurances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_allocations" ADD CONSTRAINT "bed_allocations_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_allocations" ADD CONSTRAINT "bed_allocations_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "beds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_allocations" ADD CONSTRAINT "bed_allocations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_transfers" ADD CONSTRAINT "bed_transfers_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_transfers" ADD CONSTRAINT "bed_transfers_fromBedId_fkey" FOREIGN KEY ("fromBedId") REFERENCES "beds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_transfers" ADD CONSTRAINT "bed_transfers_toBedId_fkey" FOREIGN KEY ("toBedId") REFERENCES "beds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_transfers" ADD CONSTRAINT "bed_transfers_fromRoomId_fkey" FOREIGN KEY ("fromRoomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_transfers" ADD CONSTRAINT "bed_transfers_toRoomId_fkey" FOREIGN KEY ("toRoomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_transfers" ADD CONSTRAINT "bed_transfers_fromWardId_fkey" FOREIGN KEY ("fromWardId") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_transfers" ADD CONSTRAINT "bed_transfers_toWardId_fkey" FOREIGN KEY ("toWardId") REFERENCES "wards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_transfers" ADD CONSTRAINT "bed_transfers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

