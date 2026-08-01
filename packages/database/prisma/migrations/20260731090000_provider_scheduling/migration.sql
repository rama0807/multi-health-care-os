-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('CASUAL', 'SICK', 'EARNED', 'CONFERENCE', 'TRAINING', 'EMERGENCY', 'HOLIDAY', 'OTHER');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "doctors" DROP COLUMN "availabilitySlots";

-- CreateTable
CREATE TABLE "doctor_schedules" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_schedule_days" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "dayOfWeek" "Weekday" NOT NULL,
    "isWorkingDay" BOOLEAN NOT NULL DEFAULT true,
    "shifts" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_schedule_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_leaves" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leaveType" "LeaveType" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "reason" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "appliedByUserId" TEXT NOT NULL,
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_leaves_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "doctor_schedules_doctorId_idx" ON "doctor_schedules"("doctorId");

-- CreateIndex
CREATE INDEX "doctor_schedules_organizationId_idx" ON "doctor_schedules"("organizationId");

-- CreateIndex
CREATE INDEX "doctor_schedules_doctorId_isActive_effectiveFrom_idx" ON "doctor_schedules"("doctorId", "isActive", "effectiveFrom");

-- CreateIndex
CREATE INDEX "doctor_schedule_days_scheduleId_idx" ON "doctor_schedule_days"("scheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_schedule_days_scheduleId_dayOfWeek_key" ON "doctor_schedule_days"("scheduleId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "doctor_leaves_doctorId_idx" ON "doctor_leaves"("doctorId");

-- CreateIndex
CREATE INDEX "doctor_leaves_organizationId_idx" ON "doctor_leaves"("organizationId");

-- CreateIndex
CREATE INDEX "doctor_leaves_status_organizationId_idx" ON "doctor_leaves"("status", "organizationId");

-- CreateIndex
CREATE INDEX "doctor_leaves_doctorId_startDate_endDate_idx" ON "doctor_leaves"("doctorId", "startDate", "endDate");

-- AddForeignKey
ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_schedule_days" ADD CONSTRAINT "doctor_schedule_days_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "doctor_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_leaves" ADD CONSTRAINT "doctor_leaves_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_leaves" ADD CONSTRAINT "doctor_leaves_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

