-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('APPOINTMENT', 'CLINICAL', 'LABORATORY', 'RADIOLOGY', 'BILLING', 'INSURANCE', 'PHARMACY', 'INVENTORY', 'IPD', 'STAFF', 'REPORTS', 'PLATFORM', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('CRITICAL', 'HIGH', 'NORMAL', 'LOW', 'SILENT');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'SKIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmailDigestFrequency" AS ENUM ('IMMEDIATE', 'HOURLY', 'DAILY', 'WEEKLY', 'NEVER');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('WEB', 'ANDROID', 'IOS');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationStatus" ADD VALUE 'SCHEDULED';
ALTER TYPE "NotificationStatus" ADD VALUE 'QUEUED';
ALTER TYPE "NotificationStatus" ADD VALUE 'PARTIALLY_SENT';
ALTER TYPE "NotificationStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'APPOINTMENT_BOOKED';
ALTER TYPE "NotificationType" ADD VALUE 'ENCOUNTER_CREATED';
ALTER TYPE "NotificationType" ADD VALUE 'ENCOUNTER_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE 'LAB_SAMPLE_COLLECTED';
ALTER TYPE "NotificationType" ADD VALUE 'RADIOLOGY_REPORT_RELEASED';
ALTER TYPE "NotificationType" ADD VALUE 'PREAUTH_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'CLAIM_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'CLAIM_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'MEDICINE_DISPENSED';
ALTER TYPE "NotificationType" ADD VALUE 'INVENTORY_LOW_STOCK';
ALTER TYPE "NotificationType" ADD VALUE 'INVENTORY_REORDER_LEVEL';
ALTER TYPE "NotificationType" ADD VALUE 'IPD_ADMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'IPD_TRANSFERRED';
ALTER TYPE "NotificationType" ADD VALUE 'IPD_DISCHARGED';
ALTER TYPE "NotificationType" ADD VALUE 'STAFF_LEAVE_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'STAFF_SHIFT_ASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE 'SCHEDULED_REPORT_READY';
ALTER TYPE "NotificationType" ADD VALUE 'ORGANIZATION_ONBOARDED';
ALTER TYPE "NotificationType" ADD VALUE 'HOSPITAL_CREATED';

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_userId_fkey";

-- DropIndex
DROP INDEX "notifications_organizationId_idx";

-- DropIndex
DROP INDEX "notifications_userId_isRead_idx";

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "channel",
DROP COLUMN "data",
DROP COLUMN "status",
DROP COLUMN "userId",
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "category" "NotificationCategory" NOT NULL,
ADD COLUMN     "deepLink" TEXT,
ADD COLUMN     "deliveryStatus" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "eventKey" TEXT,
ADD COLUMN     "hospitalId" TEXT,
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "payload" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "pinnedAt" TIMESTAMP(3),
ADD COLUMN     "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "recipientId" TEXT,
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scheduleAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "destination" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "providerName" TEXT,
    "providerMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "NotificationCategory" NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "subjectTemplate" TEXT,
    "bodyTemplate" TEXT NOT NULL,
    "deepLinkTemplate" TEXT,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailFrequency" "EmailDigestFrequency" NOT NULL DEFAULT 'IMMEDIATE',
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "categoryPreferences" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_devices" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL DEFAULT 'WEB',
    "deviceName" TEXT,
    "browser" TEXT,
    "osName" TEXT,
    "userAgent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_deliveries_organizationId_status_idx" ON "notification_deliveries"("organizationId", "status");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_nextAttemptAt_idx" ON "notification_deliveries"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_notificationId_channel_key" ON "notification_deliveries"("notificationId", "channel");

-- CreateIndex
CREATE INDEX "notification_templates_organizationId_key_channel_idx" ON "notification_templates"("organizationId", "key", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_organizationId_key_channel_version_key" ON "notification_templates"("organizationId", "key", "channel", "version");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");

-- CreateIndex
CREATE INDEX "notification_preferences_organizationId_idx" ON "notification_preferences"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "user_devices_token_key" ON "user_devices"("token");

-- CreateIndex
CREATE INDEX "user_devices_userId_isActive_idx" ON "user_devices"("userId", "isActive");

-- CreateIndex
CREATE INDEX "user_devices_organizationId_idx" ON "user_devices"("organizationId");

-- CreateIndex
CREATE INDEX "notifications_organizationId_createdAt_idx" ON "notifications"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_recipientId_isRead_isArchived_idx" ON "notifications"("recipientId", "isRead", "isArchived");

-- CreateIndex
CREATE INDEX "notifications_organizationId_deliveryStatus_idx" ON "notifications"("organizationId", "deliveryStatus");

-- CreateIndex
CREATE INDEX "notifications_deliveryStatus_scheduleAt_idx" ON "notifications"("deliveryStatus", "scheduleAt");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_recipientId_eventKey_key" ON "notifications"("recipientId", "eventKey");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

