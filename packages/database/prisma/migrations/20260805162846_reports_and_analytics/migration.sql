-- CreateTable
CREATE TABLE "saved_reports" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "reportKey" TEXT NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "scheduleEnabled" BOOLEAN NOT NULL DEFAULT false,
    "scheduleCron" TEXT,
    "scheduleRecipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_reports_organizationId_idx" ON "saved_reports"("organizationId");

-- CreateIndex
CREATE INDEX "saved_reports_organizationId_reportKey_idx" ON "saved_reports"("organizationId", "reportKey");

-- CreateIndex
CREATE UNIQUE INDEX "saved_reports_organizationId_name_key" ON "saved_reports"("organizationId", "name");

-- AddForeignKey
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
