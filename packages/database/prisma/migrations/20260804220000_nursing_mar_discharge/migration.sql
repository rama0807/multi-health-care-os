-- CreateEnum
CREATE TYPE "NursingNoteType" AS ENUM ('GENERAL', 'SHIFT_HANDOVER', 'ASSESSMENT', 'INCIDENT');

-- CreateEnum
CREATE TYPE "FallRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "PressureUlcerRiskLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'SEVERE');

-- CreateEnum
CREATE TYPE "IpdOrderCategory" AS ENUM ('DIET', 'FLUID', 'ACTIVITY', 'OXYGEN', 'ISOLATION');

-- CreateEnum
CREATE TYPE "IpdOrderStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "NursingTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'MISSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NursingTaskPriority" AS ENUM ('ROUTINE', 'URGENT', 'STAT');

-- CreateEnum
CREATE TYPE "MedicationAdministrationType" AS ENUM ('SCHEDULED', 'PRN', 'STAT');

-- CreateEnum
CREATE TYPE "MedicationAdministrationStatus" AS ENUM ('PENDING', 'ADMINISTERED', 'MISSED', 'REFUSED', 'HELD', 'DELAYED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DischargeChecklistItemKey" AS ENUM ('VITALS_STABLE', 'MEDICATION_RECONCILIATION_DONE', 'PATIENT_EDUCATION_GIVEN', 'BELONGINGS_RETURNED', 'WOUND_CARE_INSTRUCTIONS_GIVEN', 'EQUIPMENT_RETURNED', 'FOLLOWUP_EXPLAINED', 'TRANSPORT_ARRANGED');

-- AlterTable
ALTER TABLE "admissions" ADD COLUMN     "dischargeApprovedAt" TIMESTAMP(3),
ADD COLUMN     "dischargeApprovedByUserId" TEXT;

-- CreateTable
CREATE TABLE "nursing_notes" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "NursingNoteType" NOT NULL DEFAULT 'GENERAL',
    "shift" "ShiftType",
    "content" TEXT NOT NULL,
    "isEscalated" BOOLEAN NOT NULL DEFAULT false,
    "escalationReason" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nursing_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nursing_assessments" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "painScore" INTEGER,
    "fallRiskScore" INTEGER,
    "fallRiskLevel" "FallRiskLevel",
    "bradenScore" INTEGER,
    "bradenRiskLevel" "PressureUlcerRiskLevel",
    "gcsEye" INTEGER,
    "gcsVerbal" INTEGER,
    "gcsMotor" INTEGER,
    "gcsTotal" INTEGER,
    "generalNotes" TEXT,
    "assessedByUserId" TEXT NOT NULL,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nursing_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_output_records" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "oralIntakeMl" INTEGER,
    "ivFluidIntakeMl" INTEGER,
    "otherIntakeMl" INTEGER,
    "urineOutputMl" INTEGER,
    "stoolOutputCount" INTEGER,
    "vomitusMl" INTEGER,
    "drainOutputMl" INTEGER,
    "otherOutputMl" INTEGER,
    "notes" TEXT,
    "recordedByUserId" TEXT NOT NULL,

    CONSTRAINT "intake_output_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipd_orders" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" "IpdOrderCategory" NOT NULL,
    "instructions" TEXT NOT NULL,
    "status" "IpdOrderStatus" NOT NULL DEFAULT 'ACTIVE',
    "orderedByUserId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discontinuedAt" TIMESTAMP(3),
    "discontinuedReason" TEXT,
    "discontinuedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ipd_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nursing_tasks" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceOrderId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "NursingTaskPriority" NOT NULL DEFAULT 'ROUTINE',
    "dueAt" TIMESTAMP(3),
    "status" "NursingTaskStatus" NOT NULL DEFAULT 'PENDING',
    "assignedToUserId" TEXT,
    "completedByUserId" TEXT,
    "completedAt" TIMESTAMP(3),
    "completionNotes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nursing_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_administrations" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "prescriptionItemId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "MedicationAdministrationType" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "administeredAt" TIMESTAMP(3),
    "status" "MedicationAdministrationStatus" NOT NULL DEFAULT 'PENDING',
    "doseGiven" TEXT,
    "route" TEXT,
    "notes" TEXT,
    "barcodeVerified" BOOLEAN NOT NULL DEFAULT false,
    "scannedCode" TEXT,
    "administeredByUserId" TEXT,
    "nurseSignature" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medication_administrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discharge_checklist_items" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "itemKey" "DischargeChecklistItemKey" NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedByUserId" TEXT,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discharge_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discharge_summaries" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "finalDiagnosis" TEXT NOT NULL,
    "courseInHospital" TEXT,
    "proceduresPerformed" TEXT,
    "conditionAtDischarge" TEXT,
    "medicationReconciliation" TEXT,
    "followUpInstructions" TEXT,
    "followUpAppointmentAt" TIMESTAMP(3),
    "followUpDoctorId" TEXT,
    "dischargePrescriptionId" TEXT,
    "preparedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discharge_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "nursing_notes_admissionId_idx" ON "nursing_notes"("admissionId");

-- CreateIndex
CREATE INDEX "nursing_notes_organizationId_idx" ON "nursing_notes"("organizationId");

-- CreateIndex
CREATE INDEX "nursing_assessments_admissionId_idx" ON "nursing_assessments"("admissionId");

-- CreateIndex
CREATE INDEX "nursing_assessments_organizationId_idx" ON "nursing_assessments"("organizationId");

-- CreateIndex
CREATE INDEX "intake_output_records_admissionId_idx" ON "intake_output_records"("admissionId");

-- CreateIndex
CREATE INDEX "intake_output_records_organizationId_idx" ON "intake_output_records"("organizationId");

-- CreateIndex
CREATE INDEX "ipd_orders_admissionId_idx" ON "ipd_orders"("admissionId");

-- CreateIndex
CREATE INDEX "ipd_orders_organizationId_idx" ON "ipd_orders"("organizationId");

-- CreateIndex
CREATE INDEX "nursing_tasks_admissionId_idx" ON "nursing_tasks"("admissionId");

-- CreateIndex
CREATE INDEX "nursing_tasks_organizationId_status_idx" ON "nursing_tasks"("organizationId", "status");

-- CreateIndex
CREATE INDEX "medication_administrations_admissionId_idx" ON "medication_administrations"("admissionId");

-- CreateIndex
CREATE INDEX "medication_administrations_prescriptionItemId_idx" ON "medication_administrations"("prescriptionItemId");

-- CreateIndex
CREATE INDEX "medication_administrations_organizationId_status_idx" ON "medication_administrations"("organizationId", "status");

-- CreateIndex
CREATE INDEX "discharge_checklist_items_admissionId_idx" ON "discharge_checklist_items"("admissionId");

-- CreateIndex
CREATE UNIQUE INDEX "discharge_checklist_items_admissionId_itemKey_key" ON "discharge_checklist_items"("admissionId", "itemKey");

-- CreateIndex
CREATE UNIQUE INDEX "discharge_summaries_admissionId_key" ON "discharge_summaries"("admissionId");

-- CreateIndex
CREATE UNIQUE INDEX "discharge_summaries_dischargePrescriptionId_key" ON "discharge_summaries"("dischargePrescriptionId");

-- CreateIndex
CREATE INDEX "discharge_summaries_organizationId_idx" ON "discharge_summaries"("organizationId");

-- AddForeignKey
ALTER TABLE "nursing_notes" ADD CONSTRAINT "nursing_notes_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nursing_notes" ADD CONSTRAINT "nursing_notes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nursing_assessments" ADD CONSTRAINT "nursing_assessments_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nursing_assessments" ADD CONSTRAINT "nursing_assessments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_output_records" ADD CONSTRAINT "intake_output_records_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_output_records" ADD CONSTRAINT "intake_output_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipd_orders" ADD CONSTRAINT "ipd_orders_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipd_orders" ADD CONSTRAINT "ipd_orders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nursing_tasks" ADD CONSTRAINT "nursing_tasks_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nursing_tasks" ADD CONSTRAINT "nursing_tasks_sourceOrderId_fkey" FOREIGN KEY ("sourceOrderId") REFERENCES "ipd_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nursing_tasks" ADD CONSTRAINT "nursing_tasks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_administrations" ADD CONSTRAINT "medication_administrations_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_administrations" ADD CONSTRAINT "medication_administrations_prescriptionItemId_fkey" FOREIGN KEY ("prescriptionItemId") REFERENCES "prescription_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_administrations" ADD CONSTRAINT "medication_administrations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discharge_checklist_items" ADD CONSTRAINT "discharge_checklist_items_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discharge_checklist_items" ADD CONSTRAINT "discharge_checklist_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discharge_summaries" ADD CONSTRAINT "discharge_summaries_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discharge_summaries" ADD CONSTRAINT "discharge_summaries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discharge_summaries" ADD CONSTRAINT "discharge_summaries_followUpDoctorId_fkey" FOREIGN KEY ("followUpDoctorId") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discharge_summaries" ADD CONSTRAINT "discharge_summaries_dischargePrescriptionId_fkey" FOREIGN KEY ("dischargePrescriptionId") REFERENCES "prescriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

