/*
  Warnings:

  - You are about to drop the column `medicalRecordId` on the `prescriptions` table. All the data in the column will be lost.
  - You are about to drop the `medical_records` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "EncounterType" AS ENUM ('OPD', 'TELECONSULTATION', 'FOLLOW_UP', 'EMERGENCY', 'WALK_IN');

-- CreateEnum
CREATE TYPE "EncounterStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'AMENDED');

-- CreateEnum
CREATE TYPE "DiagnosisType" AS ENUM ('PRIMARY', 'SECONDARY', 'DIFFERENTIAL');

-- CreateEnum
CREATE TYPE "EncounterAttachmentType" AS ENUM ('CLINICAL_DOCUMENT', 'IMAGE', 'EXTERNAL_REPORT', 'OTHER');

-- DropForeignKey
ALTER TABLE "medical_records" DROP CONSTRAINT "medical_records_appointmentId_fkey";

-- DropForeignKey
ALTER TABLE "medical_records" DROP CONSTRAINT "medical_records_doctorId_fkey";

-- DropForeignKey
ALTER TABLE "medical_records" DROP CONSTRAINT "medical_records_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "medical_records" DROP CONSTRAINT "medical_records_patientId_fkey";

-- DropForeignKey
ALTER TABLE "prescriptions" DROP CONSTRAINT "prescriptions_medicalRecordId_fkey";

-- AlterTable
ALTER TABLE "prescriptions" DROP COLUMN "medicalRecordId",
ADD COLUMN     "encounterId" TEXT;

-- DropTable
DROP TABLE "medical_records";

-- CreateTable
CREATE TABLE "encounters" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "organizationId" TEXT NOT NULL,
    "type" "EncounterType" NOT NULL DEFAULT 'OPD',
    "status" "EncounterStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "notes" TEXT,
    "encounterDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "encounters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_notes" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "chiefComplaint" TEXT,
    "historyOfPresentIllness" TEXT,
    "pastMedicalHistory" TEXT,
    "familyHistory" TEXT,
    "surgicalHistory" TEXT,
    "socialHistory" TEXT,
    "allergies" TEXT,
    "currentMedications" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vitals" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "heightCm" DOUBLE PRECISION,
    "weightKg" DOUBLE PRECISION,
    "bmi" DOUBLE PRECISION,
    "bloodPressureSystolic" INTEGER,
    "bloodPressureDiastolic" INTEGER,
    "pulse" INTEGER,
    "temperatureCelsius" DOUBLE PRECISION,
    "respiratoryRate" INTEGER,
    "spo2" INTEGER,
    "recordedByUserId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnoses" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "type" "DiagnosisType" NOT NULL DEFAULT 'PRIMARY',
    "description" TEXT NOT NULL,
    "icdCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnoses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procedures" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procedures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounter_attachments" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "documentType" "EncounterAttachmentType" NOT NULL DEFAULT 'OTHER',
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "encounter_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "encounters_appointmentId_key" ON "encounters"("appointmentId");

-- CreateIndex
CREATE INDEX "encounters_patientId_organizationId_idx" ON "encounters"("patientId", "organizationId");

-- CreateIndex
CREATE INDEX "encounters_doctorId_organizationId_idx" ON "encounters"("doctorId", "organizationId");

-- CreateIndex
CREATE INDEX "encounters_organizationId_idx" ON "encounters"("organizationId");

-- CreateIndex
CREATE INDEX "clinical_notes_encounterId_idx" ON "clinical_notes"("encounterId");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_notes_encounterId_version_key" ON "clinical_notes"("encounterId", "version");

-- CreateIndex
CREATE INDEX "vitals_encounterId_idx" ON "vitals"("encounterId");

-- CreateIndex
CREATE INDEX "diagnoses_encounterId_idx" ON "diagnoses"("encounterId");

-- CreateIndex
CREATE INDEX "procedures_encounterId_idx" ON "procedures"("encounterId");

-- CreateIndex
CREATE INDEX "encounter_attachments_encounterId_idx" ON "encounter_attachments"("encounterId");

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vitals" ADD CONSTRAINT "vitals_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter_attachments" ADD CONSTRAINT "encounter_attachments_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
