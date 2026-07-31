-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('HOSPITAL', 'CLINIC', 'DIAGNOSTIC_CENTER', 'NURSING_HOME');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "BloodGroup" AS ENUM ('A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE');

-- CreateEnum
CREATE TYPE "AppointmentType" AS ENUM ('OPD', 'IPD', 'EMERGENCY', 'PROCEDURE', 'FOLLOW_UP', 'TELECONSULTATION');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'ARRIVED', 'IN_CONSULTATION', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('OPD', 'IPD', 'LABORATORY', 'RADIOLOGY', 'PHARMACY', 'PROCEDURE', 'MISCELLANEOUS');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'CARD', 'UPI', 'NEFT', 'RTGS', 'CHEQUE', 'INSURANCE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "LabTestStatus" AS ENUM ('ORDERED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'COMPLETED', 'REPORTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RadiologyStatus" AS ENUM ('ORDERED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'REPORTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('ROUTINE', 'URGENT', 'STAT');

-- CreateEnum
CREATE TYPE "BedType" AS ENUM ('GENERAL', 'SEMI_PRIVATE', 'PRIVATE', 'ICU', 'NICU', 'HDU', 'ISOLATION');

-- CreateEnum
CREATE TYPE "BedStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'UNDER_MAINTENANCE');

-- CreateEnum
CREATE TYPE "AdmissionStatus" AS ENUM ('ADMITTED', 'DISCHARGED', 'TRANSFERRED', 'ABSCONDED');

-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('MORNING', 'AFTERNOON', 'NIGHT', 'ROTATING');

-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('SUPER_ADMIN', 'ORG_ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'LAB_TECHNICIAN', 'RADIOLOGY_TECHNICIAN', 'PHARMACIST', 'CASHIER', 'HR', 'INVENTORY_MANAGER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('AADHAAR', 'PAN', 'PASSPORT', 'DRIVING_LICENSE', 'INSURANCE_CARD', 'MEDICAL_REPORT', 'PRESCRIPTION', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('APPOINTMENT_REMINDER', 'APPOINTMENT_CONFIRMED', 'APPOINTMENT_CANCELLED', 'LAB_RESULT_READY', 'INVOICE_GENERATED', 'PAYMENT_RECEIVED', 'PRESCRIPTION_READY', 'DISCHARGE_SUMMARY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'PUSH', 'IN_APP', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'READ');

-- CreateEnum
CREATE TYPE "InsuranceClaimStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'SETTLED');

-- CreateEnum
CREATE TYPE "AbnormalType" AS ENUM ('HIGH', 'LOW', 'CRITICAL_HIGH', 'CRITICAL_LOW');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL DEFAULT 'HOSPITAL',
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "pincode" TEXT,
    "logo" TEXT,
    "website" TEXT,
    "licenseNumber" TEXT,
    "taxId" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
    "subscriptionExpiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "avatar" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "organizationId" TEXT NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "systemRole" "SystemRole",
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'all',
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "hospitalId" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "hospitals" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "pincode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "headDoctorId" TEXT,
    "hospitalId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctors" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "specialization" TEXT NOT NULL,
    "qualification" TEXT NOT NULL,
    "departmentId" TEXT,
    "organizationId" TEXT NOT NULL,
    "consultationFee" DECIMAL(10,2) NOT NULL,
    "availabilitySlots" JSONB NOT NULL DEFAULT '[]',
    "bio" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "departmentId" TEXT,
    "organizationId" TEXT NOT NULL,
    "shiftType" "ShiftType" NOT NULL DEFAULT 'MORNING',
    "joiningDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "uhid" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "bloodGroup" "BloodGroup",
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "pincode" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "organizationId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_documents" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "appointmentNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "departmentId" TEXT,
    "organizationId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 15,
    "type" "AppointmentType" NOT NULL DEFAULT 'OPD',
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "chiefComplaint" TEXT,
    "notes" TEXT,
    "roomNumber" TEXT,
    "referredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_records" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "organizationId" TEXT NOT NULL,
    "chiefComplaint" TEXT NOT NULL,
    "historyOfPresentIllness" TEXT,
    "pastMedicalHistory" TEXT,
    "examination" TEXT,
    "diagnosis" TEXT NOT NULL,
    "icdCode" TEXT,
    "plan" TEXT,
    "followUpInstructions" TEXT,
    "followUpDays" INTEGER,
    "vitalSigns" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medical_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" TEXT NOT NULL,
    "prescriptionNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "medicalRecordId" TEXT,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "prescribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_items" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "medicationName" TEXT NOT NULL,
    "genericName" TEXT,
    "strength" TEXT,
    "form" TEXT,
    "dosage" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "route" TEXT NOT NULL DEFAULT 'ORAL',
    "instructions" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_tests" (
    "id" TEXT NOT NULL,
    "labOrderNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "organizationId" TEXT NOT NULL,
    "status" "LabTestStatus" NOT NULL DEFAULT 'ORDERED',
    "priority" "Priority" NOT NULL DEFAULT 'ROUTINE',
    "sampleCollectedBy" TEXT,
    "sampleCollectedAt" TIMESTAMP(3),
    "reportedAt" TIMESTAMP(3),
    "reportFileUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_test_items" (
    "id" TEXT NOT NULL,
    "labTestId" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "testCode" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "result" TEXT,
    "unit" TEXT,
    "referenceRange" TEXT,
    "isAbnormal" BOOLEAN NOT NULL DEFAULT false,
    "abnormalType" "AbnormalType",
    "interpretation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_test_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radiology_orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "modality" TEXT NOT NULL,
    "bodyPart" TEXT NOT NULL,
    "clinicalIndication" TEXT,
    "status" "RadiologyStatus" NOT NULL DEFAULT 'ORDERED',
    "priority" "Priority" NOT NULL DEFAULT 'ROUTINE',
    "reportFileUrl" TEXT,
    "findings" TEXT,
    "impression" TEXT,
    "reportedBy" TEXT,
    "reportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "radiology_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "departmentId" TEXT,
    "organizationId" TEXT NOT NULL,
    "totalBeds" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beds" (
    "id" TEXT NOT NULL,
    "bedNumber" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "BedType" NOT NULL DEFAULT 'GENERAL',
    "status" "BedStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admissions" (
    "id" TEXT NOT NULL,
    "admissionNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT,
    "bedId" TEXT,
    "wardId" TEXT,
    "organizationId" TEXT NOT NULL,
    "status" "AdmissionStatus" NOT NULL DEFAULT 'ADMITTED',
    "admissionReason" TEXT NOT NULL,
    "diagnosis" TEXT,
    "admittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dischargedAt" TIMESTAMP(3),
    "dischargeNotes" TEXT,
    "dischargeCondition" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "organizationId" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "type" "InvoiceType" NOT NULL DEFAULT 'OPD',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balanceDue" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "notes" TEXT,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemCode" TEXT,
    "category" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentMode" "PaymentMode" NOT NULL,
    "transactionId" TEXT,
    "referenceNumber" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "collectedBy" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_claims" (
    "id" TEXT NOT NULL,
    "claimNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "insuranceProvider" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "membershipId" TEXT,
    "claimedAmount" DECIMAL(12,2) NOT NULL,
    "approvedAmount" DECIMAL(12,2),
    "rejectedAmount" DECIMAL(12,2),
    "status" "InsuranceClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medications" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "genericName" TEXT,
    "manufacturer" TEXT,
    "strength" TEXT,
    "form" TEXT,
    "category" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "unitPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "quantityInStock" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 10,
    "reorderQuantity" INTEGER NOT NULL DEFAULT 50,
    "unitCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "storageLocation" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "patientId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "readAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_slug_idx" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "roles_organizationId_idx" ON "roles"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_organizationId_key" ON "roles"("name", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_resource_action_scope_key" ON "permissions"("resource", "action", "scope");

-- CreateIndex
CREATE INDEX "user_roles_hospitalId_idx" ON "user_roles"("hospitalId");

-- CreateIndex
CREATE INDEX "hospitals_organizationId_idx" ON "hospitals"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "hospitals_code_organizationId_key" ON "hospitals"("code", "organizationId");

-- CreateIndex
CREATE INDEX "departments_organizationId_idx" ON "departments"("organizationId");

-- CreateIndex
CREATE INDEX "departments_hospitalId_idx" ON "departments"("hospitalId");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_hospitalId_key" ON "departments"("code", "hospitalId");

-- CreateIndex
CREATE UNIQUE INDEX "doctors_userId_key" ON "doctors"("userId");

-- CreateIndex
CREATE INDEX "doctors_organizationId_idx" ON "doctors"("organizationId");

-- CreateIndex
CREATE INDEX "doctors_departmentId_idx" ON "doctors"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "doctors_registrationNumber_organizationId_key" ON "doctors"("registrationNumber", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_userId_key" ON "staff"("userId");

-- CreateIndex
CREATE INDEX "staff_organizationId_idx" ON "staff"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_employeeId_organizationId_key" ON "staff"("employeeId", "organizationId");

-- CreateIndex
CREATE INDEX "patients_organizationId_idx" ON "patients"("organizationId");

-- CreateIndex
CREATE INDEX "patients_uhid_idx" ON "patients"("uhid");

-- CreateIndex
CREATE INDEX "patients_phone_idx" ON "patients"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "patients_uhid_organizationId_key" ON "patients"("uhid", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "patients_phone_organizationId_key" ON "patients"("phone", "organizationId");

-- CreateIndex
CREATE INDEX "patient_documents_patientId_idx" ON "patient_documents"("patientId");

-- CreateIndex
CREATE INDEX "appointments_organizationId_idx" ON "appointments"("organizationId");

-- CreateIndex
CREATE INDEX "appointments_doctorId_scheduledAt_idx" ON "appointments"("doctorId", "scheduledAt");

-- CreateIndex
CREATE INDEX "appointments_patientId_organizationId_idx" ON "appointments"("patientId", "organizationId");

-- CreateIndex
CREATE INDEX "appointments_status_organizationId_scheduledAt_idx" ON "appointments"("status", "organizationId", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_appointmentNumber_organizationId_key" ON "appointments"("appointmentNumber", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "medical_records_appointmentId_key" ON "medical_records"("appointmentId");

-- CreateIndex
CREATE INDEX "medical_records_patientId_organizationId_idx" ON "medical_records"("patientId", "organizationId");

-- CreateIndex
CREATE INDEX "medical_records_organizationId_idx" ON "medical_records"("organizationId");

-- CreateIndex
CREATE INDEX "prescriptions_patientId_organizationId_idx" ON "prescriptions"("patientId", "organizationId");

-- CreateIndex
CREATE INDEX "prescriptions_organizationId_idx" ON "prescriptions"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "prescriptions_prescriptionNumber_organizationId_key" ON "prescriptions"("prescriptionNumber", "organizationId");

-- CreateIndex
CREATE INDEX "prescription_items_prescriptionId_idx" ON "prescription_items"("prescriptionId");

-- CreateIndex
CREATE INDEX "lab_tests_patientId_organizationId_idx" ON "lab_tests"("patientId", "organizationId");

-- CreateIndex
CREATE INDEX "lab_tests_organizationId_idx" ON "lab_tests"("organizationId");

-- CreateIndex
CREATE INDEX "lab_tests_status_organizationId_idx" ON "lab_tests"("status", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "lab_tests_labOrderNumber_organizationId_key" ON "lab_tests"("labOrderNumber", "organizationId");

-- CreateIndex
CREATE INDEX "lab_test_items_labTestId_idx" ON "lab_test_items"("labTestId");

-- CreateIndex
CREATE INDEX "radiology_orders_patientId_organizationId_idx" ON "radiology_orders"("patientId", "organizationId");

-- CreateIndex
CREATE INDEX "radiology_orders_organizationId_idx" ON "radiology_orders"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "radiology_orders_orderNumber_organizationId_key" ON "radiology_orders"("orderNumber", "organizationId");

-- CreateIndex
CREATE INDEX "wards_organizationId_idx" ON "wards"("organizationId");

-- CreateIndex
CREATE INDEX "wards_departmentId_idx" ON "wards"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "wards_code_organizationId_key" ON "wards"("code", "organizationId");

-- CreateIndex
CREATE INDEX "beds_organizationId_idx" ON "beds"("organizationId");

-- CreateIndex
CREATE INDEX "beds_wardId_status_idx" ON "beds"("wardId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "beds_bedNumber_wardId_key" ON "beds"("bedNumber", "wardId");

-- CreateIndex
CREATE INDEX "admissions_patientId_organizationId_idx" ON "admissions"("patientId", "organizationId");

-- CreateIndex
CREATE INDEX "admissions_organizationId_idx" ON "admissions"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "admissions_admissionNumber_organizationId_key" ON "admissions"("admissionNumber", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_appointmentId_key" ON "invoices"("appointmentId");

-- CreateIndex
CREATE INDEX "invoices_patientId_organizationId_idx" ON "invoices"("patientId", "organizationId");

-- CreateIndex
CREATE INDEX "invoices_status_organizationId_idx" ON "invoices"("status", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_organizationId_key" ON "invoices"("invoiceNumber", "organizationId");

-- CreateIndex
CREATE INDEX "invoice_items_invoiceId_idx" ON "invoice_items"("invoiceId");

-- CreateIndex
CREATE INDEX "payments_invoiceId_idx" ON "payments"("invoiceId");

-- CreateIndex
CREATE INDEX "payments_patientId_organizationId_idx" ON "payments"("patientId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_paymentNumber_organizationId_key" ON "payments"("paymentNumber", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_claims_invoiceId_key" ON "insurance_claims"("invoiceId");

-- CreateIndex
CREATE INDEX "insurance_claims_patientId_organizationId_idx" ON "insurance_claims"("patientId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_claims_claimNumber_organizationId_key" ON "insurance_claims"("claimNumber", "organizationId");

-- CreateIndex
CREATE INDEX "medications_organizationId_idx" ON "medications"("organizationId");

-- CreateIndex
CREATE INDEX "inventory_items_organizationId_idx" ON "inventory_items"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_sku_organizationId_key" ON "inventory_items"("sku", "organizationId");

-- CreateIndex
CREATE INDEX "notifications_organizationId_idx" ON "notifications"("organizationId");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_createdAt_idx" ON "audit_logs"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_resource_resourceId_organizationId_idx" ON "audit_logs"("resource", "resourceId", "organizationId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_organizationId_idx" ON "audit_logs"("userId", "organizationId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospitals" ADD CONSTRAINT "hospitals_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_documents" ADD CONSTRAINT "patient_documents_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "medical_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_tests" ADD CONSTRAINT "lab_tests_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_tests" ADD CONSTRAINT "lab_tests_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_tests" ADD CONSTRAINT "lab_tests_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_tests" ADD CONSTRAINT "lab_tests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test_items" ADD CONSTRAINT "lab_test_items_labTestId_fkey" FOREIGN KEY ("labTestId") REFERENCES "lab_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiology_orders" ADD CONSTRAINT "radiology_orders_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiology_orders" ADD CONSTRAINT "radiology_orders_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiology_orders" ADD CONSTRAINT "radiology_orders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wards" ADD CONSTRAINT "wards_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wards" ADD CONSTRAINT "wards_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beds" ADD CONSTRAINT "beds_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beds" ADD CONSTRAINT "beds_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "beds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medications" ADD CONSTRAINT "medications_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
