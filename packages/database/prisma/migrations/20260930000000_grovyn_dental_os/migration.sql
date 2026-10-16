-- Migration: Grovyn Dental OS — Phase 3
-- Adds DENTAL to OrganizationType, four dental system roles, DENTAL to billing enums,
-- and all dental-specific tables. All changes are purely additive.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Extend existing enums
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TYPE "OrganizationType" ADD VALUE 'DENTAL';
ALTER TYPE "InvoiceType" ADD VALUE 'DENTAL';
ALTER TYPE "ChargeSourceModule" ADD VALUE 'DENTAL';

ALTER TYPE "SystemRole" ADD VALUE 'DENTIST';
ALTER TYPE "SystemRole" ADD VALUE 'DENTAL_ASSISTANT';
ALTER TYPE "SystemRole" ADD VALUE 'TREATMENT_COORDINATOR';
ALTER TYPE "SystemRole" ADD VALUE 'LAB_COORDINATOR';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. New dental-specific enums
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TYPE "DentalPickupStatus" AS ENUM ('READY_FOR_PICKUP', 'SCHEDULED', 'PICKED_UP', 'IN_TRANSIT', 'RECEIVED_BY_VENDOR');
CREATE TYPE "DentalReceivingOutcome" AS ENUM ('ACCEPTED', 'ISSUE_NOTED', 'REMAKE_REQUESTED');
CREATE TYPE "DentalLabCaseStatus" AS ENUM ('DRAFT', 'MEASUREMENT_PENDING', 'SENT_TO_VENDOR', 'IN_PRODUCTION', 'READY_FOR_PICKUP', 'PICKED_UP', 'RECEIVED', 'TRY_IN', 'CORRECTION_NEEDED', 'APPROVED', 'DELIVERED', 'REMAKE', 'CANCELLED');
CREATE TYPE "ToothConditionType" AS ENUM ('SOUND', 'CARIES', 'RESTORED_COMPOSITE', 'RESTORED_AMALGAM', 'RESTORED_GOLD', 'CROWN', 'BRIDGE_ABUTMENT', 'BRIDGE_PONTIC', 'IMPLANT', 'MISSING', 'MISSING_UNERUPTED', 'IMPACTED', 'EXTRACTED', 'ROOT_CANAL', 'ROOT_STUMP', 'FRACTURE', 'SEALANT', 'VENEER', 'DENTURE_FULL', 'DENTURE_PARTIAL', 'OTHER');
CREATE TYPE "ToothSurfaceType" AS ENUM ('MESIAL', 'DISTAL', 'BUCCAL', 'LINGUAL', 'OCCLUSAL', 'INCISAL', 'PALATAL', 'LABIAL');
CREATE TYPE "TreatmentAcceptanceStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'DEFERRED', 'CALLBACK_REQUESTED');
CREATE TYPE "DentalEncounterStatus" AS ENUM ('OPEN', 'SIGNED', 'AMENDED');
CREATE TYPE "DentalChairStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'INACTIVE');

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Dental tables
-- ═══════════════════════════════════════════════════════════════════════════

-- Patient Foundation
CREATE TABLE "dental_patient_profiles" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "referralSource" TEXT,
    "primaryDentistId" TEXT,
    "isHighRisk" BOOLEAN NOT NULL DEFAULT false,
    "clinicalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dental_patient_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dental_medical_histories" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "currentMedications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "conditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPregnant" BOOLEAN,
    "preMedicationNotes" TEXT,
    "emergencyContact" JSONB,
    "recordedByUserId" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dental_medical_histories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dental_safety_alerts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dental_safety_alerts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dental_histories" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "previousProcedures" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "orthodonticHistory" TEXT,
    "extractionHistory" TEXT,
    "prostheticsHistory" TEXT,
    "lastDentalVisit" TIMESTAMP(3),
    "previousDentist" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dental_histories_pkey" PRIMARY KEY ("id")
);

-- Dental Chair
CREATE TABLE "dental_chairs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" INTEGER,
    "hospitalId" TEXT,
    "status" "DentalChairStatus" NOT NULL DEFAULT 'AVAILABLE',
    "equipment" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dental_chairs_pkey" PRIMARY KEY ("id")
);

-- Dental Encounter
CREATE TABLE "dental_encounters" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "chairId" TEXT,
    "dentistId" TEXT NOT NULL,
    "assistantId" TEXT,
    "status" "DentalEncounterStatus" NOT NULL DEFAULT 'OPEN',
    "chiefComplaint" TEXT,
    "visitDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedAt" TIMESTAMP(3),
    "signedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dental_encounters_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dental_clinical_notes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "templateId" TEXT,
    "subjective" TEXT,
    "objective" TEXT,
    "assessment" TEXT,
    "plan" TEXT,
    "additionalNotes" TEXT,
    "isSigned" BOOLEAN NOT NULL DEFAULT false,
    "signedAt" TIMESTAMP(3),
    "signedByUserId" TEXT,
    "amendments" JSONB NOT NULL DEFAULT '[]',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dental_clinical_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dental_clinical_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subjective" TEXT,
    "objective" TEXT,
    "assessment" TEXT,
    "plan" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dental_clinical_templates_pkey" PRIMARY KEY ("id")
);

-- Odontogram
CREATE TABLE "odontograms" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "recordedByUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "odontograms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "odontogram_teeth" (
    "id" TEXT NOT NULL,
    "odontogramId" TEXT NOT NULL,
    "toothNumber" INTEGER NOT NULL,
    "condition" "ToothConditionType" NOT NULL DEFAULT 'SOUND',
    "surfaces" "ToothSurfaceType"[] DEFAULT ARRAY[]::"ToothSurfaceType"[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "odontogram_teeth_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tooth_histories" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "toothNumber" INTEGER NOT NULL,
    "encounterId" TEXT,
    "condition" "ToothConditionType" NOT NULL,
    "surfaces" "ToothSurfaceType"[] DEFAULT ARRAY[]::"ToothSurfaceType"[],
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tooth_histories_pkey" PRIMARY KEY ("id")
);

-- Treatment Planning
CREATE TABLE "dental_treatment_plans" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "presentedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dental_treatment_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "treatment_plan_options" (
    "id" TEXT NOT NULL,
    "treatmentPlanId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2),
    "netCost" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "treatment_plan_options_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "treatment_plan_items" (
    "id" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "toothNumber" INTEGER,
    "surfaces" "ToothSurfaceType"[] DEFAULT ARRAY[]::"ToothSurfaceType"[],
    "procedureName" TEXT NOT NULL,
    "procedureCode" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" DECIMAL(12,2) NOT NULL,
    "estimatedVisits" INTEGER NOT NULL DEFAULT 1,
    "durationMinutes" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "treatment_plan_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "treatment_acceptances" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "status" "TreatmentAcceptanceStatus" NOT NULL DEFAULT 'PENDING',
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "callbackDate" TIMESTAMP(3),
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "treatment_acceptances_pkey" PRIMARY KEY ("id")
);

-- Procedures
CREATE TABLE "dental_procedures" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "toothNumber" INTEGER,
    "surfaces" "ToothSurfaceType"[] DEFAULT ARRAY[]::"ToothSurfaceType"[],
    "procedureName" TEXT NOT NULL,
    "procedureCode" TEXT,
    "performedByUserId" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cost" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "chargeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dental_procedures_pkey" PRIMARY KEY ("id")
);

-- Imaging & Documents
CREATE TABLE "dental_imaging_records" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "imagingType" TEXT NOT NULL,
    "title" TEXT,
    "storagePath" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "takenByUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dental_imaging_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dental_documents" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "documentType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dental_documents_pkey" PRIMARY KEY ("id")
);

-- Vendors & Lab Cases
CREATE TABLE "dental_vendors" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "vendorType" TEXT NOT NULL DEFAULT 'LAB',
    "services" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultTurnaround" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dental_vendors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dental_lab_cases" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "procedureId" TEXT,
    "vendorId" TEXT,
    "caseNumber" TEXT,
    "restorationName" TEXT NOT NULL,
    "status" "DentalLabCaseStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "expectedReturnAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dental_lab_cases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dental_lab_case_measurements" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "labCaseId" TEXT NOT NULL,
    "toothNumber" INTEGER NOT NULL,
    "restorationMaterial" TEXT,
    "shade" TEXT,
    "shadeSystem" TEXT,
    "measurements" JSONB NOT NULL DEFAULT '{}',
    "impressionType" TEXT,
    "scanInfo" TEXT,
    "notes" TEXT,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "recordedByUserId" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dental_lab_case_measurements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dental_lab_pickups" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "labCaseId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "pickedUpAt" TIMESTAMP(3),
    "status" "DentalPickupStatus" NOT NULL DEFAULT 'READY_FOR_PICKUP',
    "staffId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dental_lab_pickups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dental_lab_receivings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "labCaseId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedById" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "outcome" "DentalReceivingOutcome" NOT NULL,
    "remakeReason" TEXT,
    "notes" TEXT,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dental_lab_receivings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dental_lab_case_timelines" (
    "id" TEXT NOT NULL,
    "labCaseId" TEXT NOT NULL,
    "status" "DentalLabCaseStatus" NOT NULL,
    "notes" TEXT,
    "userId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dental_lab_case_timelines_pkey" PRIMARY KEY ("id")
);

-- Recall
CREATE TABLE "dental_recalls" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "recallType" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "appointmentId" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dental_recalls_pkey" PRIMARY KEY ("id")
);

-- Digital Consent
CREATE TABLE "dental_consent_forms" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "templateName" TEXT NOT NULL,
    "procedureName" TEXT,
    "consentText" TEXT NOT NULL,
    "patientSignature" TEXT,
    "witnessSignature" TEXT,
    "signedAt" TIMESTAMP(3),
    "documentPath" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dental_consent_forms_pkey" PRIMARY KEY ("id")
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Unique constraints
-- ═══════════════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX "dental_patient_profiles_patientId_key" ON "dental_patient_profiles"("patientId");
CREATE UNIQUE INDEX "dental_chairs_organizationId_name_key" ON "dental_chairs"("organizationId", "name");
CREATE UNIQUE INDEX "odontogram_teeth_odontogramId_toothNumber_key" ON "odontogram_teeth"("odontogramId", "toothNumber");
CREATE UNIQUE INDEX "treatment_acceptances_optionId_key" ON "treatment_acceptances"("optionId");
CREATE UNIQUE INDEX "dental_clinical_templates_organizationId_name_key" ON "dental_clinical_templates"("organizationId", "name");

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Indexes
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX "dental_patient_profiles_organizationId_idx" ON "dental_patient_profiles"("organizationId");
CREATE INDEX "dental_medical_histories_organizationId_idx" ON "dental_medical_histories"("organizationId");
CREATE INDEX "dental_medical_histories_patientId_idx" ON "dental_medical_histories"("patientId");
CREATE INDEX "dental_safety_alerts_organizationId_idx" ON "dental_safety_alerts"("organizationId");
CREATE INDEX "dental_safety_alerts_patientId_idx" ON "dental_safety_alerts"("patientId");
CREATE INDEX "dental_histories_organizationId_idx" ON "dental_histories"("organizationId");
CREATE INDEX "dental_histories_patientId_idx" ON "dental_histories"("patientId");
CREATE INDEX "dental_chairs_organizationId_idx" ON "dental_chairs"("organizationId");
CREATE INDEX "dental_encounters_organizationId_idx" ON "dental_encounters"("organizationId");
CREATE INDEX "dental_encounters_patientId_idx" ON "dental_encounters"("patientId");
CREATE INDEX "dental_encounters_appointmentId_idx" ON "dental_encounters"("appointmentId");
CREATE INDEX "dental_clinical_notes_organizationId_idx" ON "dental_clinical_notes"("organizationId");
CREATE INDEX "dental_clinical_notes_encounterId_idx" ON "dental_clinical_notes"("encounterId");
CREATE INDEX "dental_clinical_templates_organizationId_idx" ON "dental_clinical_templates"("organizationId");
CREATE INDEX "odontograms_organizationId_idx" ON "odontograms"("organizationId");
CREATE INDEX "odontograms_patientId_idx" ON "odontograms"("patientId");
CREATE INDEX "tooth_histories_organizationId_idx" ON "tooth_histories"("organizationId");
CREATE INDEX "tooth_histories_patientId_toothNumber_idx" ON "tooth_histories"("patientId", "toothNumber");
CREATE INDEX "dental_treatment_plans_organizationId_idx" ON "dental_treatment_plans"("organizationId");
CREATE INDEX "dental_treatment_plans_patientId_idx" ON "dental_treatment_plans"("patientId");
CREATE INDEX "treatment_plan_options_treatmentPlanId_idx" ON "treatment_plan_options"("treatmentPlanId");
CREATE INDEX "treatment_plan_items_optionId_idx" ON "treatment_plan_items"("optionId");
CREATE INDEX "treatment_acceptances_organizationId_idx" ON "treatment_acceptances"("organizationId");
CREATE INDEX "treatment_acceptances_patientId_idx" ON "treatment_acceptances"("patientId");
CREATE INDEX "dental_procedures_organizationId_idx" ON "dental_procedures"("organizationId");
CREATE INDEX "dental_procedures_patientId_idx" ON "dental_procedures"("patientId");
CREATE INDEX "dental_procedures_encounterId_idx" ON "dental_procedures"("encounterId");
CREATE INDEX "dental_imaging_records_organizationId_idx" ON "dental_imaging_records"("organizationId");
CREATE INDEX "dental_imaging_records_patientId_idx" ON "dental_imaging_records"("patientId");
CREATE INDEX "dental_documents_organizationId_idx" ON "dental_documents"("organizationId");
CREATE INDEX "dental_documents_patientId_idx" ON "dental_documents"("patientId");
CREATE INDEX "dental_vendors_organizationId_idx" ON "dental_vendors"("organizationId");
CREATE INDEX "dental_lab_cases_organizationId_idx" ON "dental_lab_cases"("organizationId");
CREATE INDEX "dental_lab_cases_patientId_idx" ON "dental_lab_cases"("patientId");
CREATE INDEX "dental_lab_case_measurements_labCaseId_idx" ON "dental_lab_case_measurements"("labCaseId");
CREATE INDEX "dental_lab_pickups_organizationId_idx" ON "dental_lab_pickups"("organizationId");
CREATE INDEX "dental_lab_pickups_labCaseId_idx" ON "dental_lab_pickups"("labCaseId");
CREATE INDEX "dental_lab_receivings_organizationId_idx" ON "dental_lab_receivings"("organizationId");
CREATE INDEX "dental_lab_receivings_labCaseId_idx" ON "dental_lab_receivings"("labCaseId");
CREATE INDEX "dental_lab_case_timelines_labCaseId_idx" ON "dental_lab_case_timelines"("labCaseId");
CREATE INDEX "dental_recalls_organizationId_idx" ON "dental_recalls"("organizationId");
CREATE INDEX "dental_recalls_patientId_idx" ON "dental_recalls"("patientId");
CREATE INDEX "dental_recalls_dueDate_idx" ON "dental_recalls"("dueDate");
CREATE INDEX "dental_consent_forms_organizationId_idx" ON "dental_consent_forms"("organizationId");
CREATE INDEX "dental_consent_forms_patientId_idx" ON "dental_consent_forms"("patientId");

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Foreign keys
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "dental_patient_profiles" ADD CONSTRAINT "dental_patient_profiles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_patient_profiles" ADD CONSTRAINT "dental_patient_profiles_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dental_medical_histories" ADD CONSTRAINT "dental_medical_histories_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_medical_histories" ADD CONSTRAINT "dental_medical_histories_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_medical_histories" ADD CONSTRAINT "dental_medical_histories_profileId_fkey" FOREIGN KEY ("patientId") REFERENCES "dental_patient_profiles"("patientId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dental_safety_alerts" ADD CONSTRAINT "dental_safety_alerts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_safety_alerts" ADD CONSTRAINT "dental_safety_alerts_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_safety_alerts" ADD CONSTRAINT "dental_safety_alerts_profileId_fkey" FOREIGN KEY ("patientId") REFERENCES "dental_patient_profiles"("patientId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dental_histories" ADD CONSTRAINT "dental_histories_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_histories" ADD CONSTRAINT "dental_histories_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_histories" ADD CONSTRAINT "dental_histories_profileId_fkey" FOREIGN KEY ("patientId") REFERENCES "dental_patient_profiles"("patientId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dental_chairs" ADD CONSTRAINT "dental_chairs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dental_encounters" ADD CONSTRAINT "dental_encounters_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_encounters" ADD CONSTRAINT "dental_encounters_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_encounters" ADD CONSTRAINT "dental_encounters_chairId_fkey" FOREIGN KEY ("chairId") REFERENCES "dental_chairs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dental_clinical_notes" ADD CONSTRAINT "dental_clinical_notes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_clinical_notes" ADD CONSTRAINT "dental_clinical_notes_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "dental_encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_clinical_notes" ADD CONSTRAINT "dental_clinical_notes_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "odontograms" ADD CONSTRAINT "odontograms_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "odontograms" ADD CONSTRAINT "odontograms_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "odontograms" ADD CONSTRAINT "odontograms_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "dental_encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "odontogram_teeth" ADD CONSTRAINT "odontogram_teeth_odontogramId_fkey" FOREIGN KEY ("odontogramId") REFERENCES "odontograms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tooth_histories" ADD CONSTRAINT "tooth_histories_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dental_treatment_plans" ADD CONSTRAINT "dental_treatment_plans_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_treatment_plans" ADD CONSTRAINT "dental_treatment_plans_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "treatment_plan_options" ADD CONSTRAINT "treatment_plan_options_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "dental_treatment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "treatment_plan_items" ADD CONSTRAINT "treatment_plan_items_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "treatment_plan_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "treatment_acceptances" ADD CONSTRAINT "treatment_acceptances_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "treatment_plan_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "treatment_acceptances" ADD CONSTRAINT "treatment_acceptances_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dental_procedures" ADD CONSTRAINT "dental_procedures_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_procedures" ADD CONSTRAINT "dental_procedures_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_procedures" ADD CONSTRAINT "dental_procedures_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "dental_encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dental_imaging_records" ADD CONSTRAINT "dental_imaging_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_imaging_records" ADD CONSTRAINT "dental_imaging_records_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_imaging_records" ADD CONSTRAINT "dental_imaging_records_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "dental_encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dental_documents" ADD CONSTRAINT "dental_documents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_documents" ADD CONSTRAINT "dental_documents_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_documents" ADD CONSTRAINT "dental_documents_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "dental_encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dental_vendors" ADD CONSTRAINT "dental_vendors_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dental_lab_cases" ADD CONSTRAINT "dental_lab_cases_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_lab_cases" ADD CONSTRAINT "dental_lab_cases_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_lab_cases" ADD CONSTRAINT "dental_lab_cases_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "dental_procedures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "dental_lab_cases" ADD CONSTRAINT "dental_lab_cases_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "dental_vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dental_lab_case_measurements" ADD CONSTRAINT "dental_lab_case_measurements_labCaseId_fkey" FOREIGN KEY ("labCaseId") REFERENCES "dental_lab_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dental_lab_pickups" ADD CONSTRAINT "dental_lab_pickups_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_lab_pickups" ADD CONSTRAINT "dental_lab_pickups_labCaseId_fkey" FOREIGN KEY ("labCaseId") REFERENCES "dental_lab_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_lab_pickups" ADD CONSTRAINT "dental_lab_pickups_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "dental_vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_lab_pickups" ADD CONSTRAINT "dental_lab_pickups_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dental_lab_receivings" ADD CONSTRAINT "dental_lab_receivings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_lab_receivings" ADD CONSTRAINT "dental_lab_receivings_labCaseId_fkey" FOREIGN KEY ("labCaseId") REFERENCES "dental_lab_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_lab_receivings" ADD CONSTRAINT "dental_lab_receivings_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "dental_vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dental_lab_case_timelines" ADD CONSTRAINT "dental_lab_case_timelines_labCaseId_fkey" FOREIGN KEY ("labCaseId") REFERENCES "dental_lab_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dental_recalls" ADD CONSTRAINT "dental_recalls_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_recalls" ADD CONSTRAINT "dental_recalls_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dental_consent_forms" ADD CONSTRAINT "dental_consent_forms_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_consent_forms" ADD CONSTRAINT "dental_consent_forms_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
