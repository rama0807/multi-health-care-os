-- CreateTable
CREATE TABLE "organization_email_configs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "apiKeyCiphertext" TEXT,
    "apiKeyIv" TEXT,
    "apiKeyAuthTag" TEXT,
    "apiKeyLast4" TEXT,
    "fromName" TEXT,
    "fromEmail" TEXT,
    "replyToEmail" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_email_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_email_configs_organizationId_key" ON "organization_email_configs"("organizationId");

-- AddForeignKey
ALTER TABLE "organization_email_configs" ADD CONSTRAINT "organization_email_configs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
