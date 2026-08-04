-- CreateEnum
CREATE TYPE "InsuranceProviderType" AS ENUM ('INSURANCE_COMPANY', 'TPA', 'CORPORATE');

-- CreateEnum
CREATE TYPE "InsuranceNetworkType" AS ENUM ('CASHLESS', 'REIMBURSEMENT', 'BOTH');

-- CreateEnum
CREATE TYPE "PatientInsuranceType" AS ENUM ('PRIMARY', 'SECONDARY');

-- CreateEnum
CREATE TYPE "PatientInsuranceStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PreAuthorizationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ClaimDocumentType" AS ENUM ('INVOICE', 'PRESCRIPTION', 'LAB_REPORT', 'RADIOLOGY_REPORT', 'ENCOUNTER_SUMMARY', 'DISCHARGE_SUMMARY', 'MANUAL_UPLOAD');

-- CreateEnum
CREATE TYPE "ClaimPaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InsuranceClaimStatus" ADD VALUE 'PARTIALLY_SETTLED';
ALTER TYPE "InsuranceClaimStatus" ADD VALUE 'CLOSED';

-- AlterTable
ALTER TABLE "insurance_claims" ADD COLUMN     "adjustmentAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "encounterId" TEXT NOT NULL,
ADD COLUMN     "insuranceShare" DECIMAL(12,2),
ADD COLUMN     "outstandingAmount" DECIMAL(12,2),
ADD COLUMN     "patientInsuranceId" TEXT,
ADD COLUMN     "patientShare" DECIMAL(12,2),
ADD COLUMN     "paymentStatus" "ClaimPaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "planId" TEXT,
ADD COLUMN     "preAuthorizationId" TEXT,
ADD COLUMN     "providerId" TEXT,
ADD COLUMN     "writeOffAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "insurance_providers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "InsuranceProviderType" NOT NULL DEFAULT 'INSURANCE_COMPANY',
    "contactPerson" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_plans" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "coveragePercent" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "coPayPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "deductible" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "annualLimit" DECIMAL(12,2),
    "perVisitLimit" DECIMAL(12,2),
    "networkType" "InsuranceNetworkType" NOT NULL DEFAULT 'CASHLESS',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_insurances" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "type" "PatientInsuranceType" NOT NULL DEFAULT 'PRIMARY',
    "memberId" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "coveragePercent" DECIMAL(5,2),
    "status" "PatientInsuranceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_insurances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pre_authorizations" (
    "id" TEXT NOT NULL,
    "authNumber" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "patientInsuranceId" TEXT NOT NULL,
    "status" "PreAuthorizationStatus" NOT NULL DEFAULT 'DRAFT',
    "clinicalNotes" TEXT,
    "doctorNotes" TEXT,
    "requestedAmount" DECIMAL(12,2) NOT NULL,
    "approvedAmount" DECIMAL(12,2),
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "decidedByUserId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pre_authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pre_auth_attachments" (
    "id" TEXT NOT NULL,
    "preAuthorizationId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pre_auth_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_documents" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "ClaimDocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "autoAttached" BOOLEAN NOT NULL DEFAULT false,
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "insurance_providers_organizationId_idx" ON "insurance_providers"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_providers_organizationId_code_key" ON "insurance_providers"("organizationId", "code");

-- CreateIndex
CREATE INDEX "insurance_plans_organizationId_idx" ON "insurance_plans"("organizationId");

-- CreateIndex
CREATE INDEX "insurance_plans_providerId_idx" ON "insurance_plans"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_plans_organizationId_providerId_code_key" ON "insurance_plans"("organizationId", "providerId", "code");

-- CreateIndex
CREATE INDEX "patient_insurances_organizationId_patientId_idx" ON "patient_insurances"("organizationId", "patientId");

-- CreateIndex
CREATE INDEX "pre_authorizations_organizationId_patientId_idx" ON "pre_authorizations"("organizationId", "patientId");

-- CreateIndex
CREATE UNIQUE INDEX "pre_authorizations_authNumber_organizationId_key" ON "pre_authorizations"("authNumber", "organizationId");

-- CreateIndex
CREATE INDEX "pre_auth_attachments_preAuthorizationId_idx" ON "pre_auth_attachments"("preAuthorizationId");

-- CreateIndex
CREATE INDEX "claim_documents_claimId_idx" ON "claim_documents"("claimId");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_claims_preAuthorizationId_key" ON "insurance_claims"("preAuthorizationId");

-- CreateIndex
CREATE INDEX "insurance_claims_status_organizationId_idx" ON "insurance_claims"("status", "organizationId");

-- AddForeignKey
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "insurance_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_planId_fkey" FOREIGN KEY ("planId") REFERENCES "insurance_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_patientInsuranceId_fkey" FOREIGN KEY ("patientInsuranceId") REFERENCES "patient_insurances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_preAuthorizationId_fkey" FOREIGN KEY ("preAuthorizationId") REFERENCES "pre_authorizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_providers" ADD CONSTRAINT "insurance_providers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_plans" ADD CONSTRAINT "insurance_plans_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_plans" ADD CONSTRAINT "insurance_plans_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "insurance_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_insurances" ADD CONSTRAINT "patient_insurances_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_insurances" ADD CONSTRAINT "patient_insurances_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_insurances" ADD CONSTRAINT "patient_insurances_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "insurance_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_insurances" ADD CONSTRAINT "patient_insurances_planId_fkey" FOREIGN KEY ("planId") REFERENCES "insurance_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_authorizations" ADD CONSTRAINT "pre_authorizations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_authorizations" ADD CONSTRAINT "pre_authorizations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_authorizations" ADD CONSTRAINT "pre_authorizations_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_authorizations" ADD CONSTRAINT "pre_authorizations_patientInsuranceId_fkey" FOREIGN KEY ("patientInsuranceId") REFERENCES "patient_insurances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_auth_attachments" ADD CONSTRAINT "pre_auth_attachments_preAuthorizationId_fkey" FOREIGN KEY ("preAuthorizationId") REFERENCES "pre_authorizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_documents" ADD CONSTRAINT "claim_documents_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "insurance_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

