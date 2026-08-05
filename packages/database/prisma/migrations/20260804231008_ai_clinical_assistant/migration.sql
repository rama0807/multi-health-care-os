-- CreateEnum
CREATE TYPE "AiProviderType" AS ENUM ('OPENAI', 'ANTHROPIC', 'GEMINI', 'OLLAMA');

-- CreateEnum
CREATE TYPE "AiFeature" AS ENUM ('SOAP_NOTE', 'CLINICAL_NOTE_SUMMARY', 'LAB_RESULT_SUMMARY', 'RADIOLOGY_REPORT_SUMMARY', 'PRESCRIPTION_EXPLANATION', 'DISCHARGE_SUMMARY', 'REFERRAL_LETTER');

-- CreateEnum
CREATE TYPE "AiMessageRole" AS ENUM ('SYSTEM', 'USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "AiRequestStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "feature" "AiFeature" NOT NULL,
    "title" TEXT NOT NULL,
    "patientId" TEXT,
    "encounterId" TEXT,
    "labTestId" TEXT,
    "radiologyOrderId" TEXT,
    "prescriptionId" TEXT,
    "admissionId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "role" "AiMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "conversationId" TEXT,
    "userId" TEXT,
    "feature" "AiFeature" NOT NULL,
    "provider" "AiProviderType" NOT NULL,
    "model" TEXT NOT NULL,
    "status" "AiRequestStatus" NOT NULL DEFAULT 'PENDING',
    "streamed" BOOLEAN NOT NULL DEFAULT false,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "tokensEstimated" BOOLEAN NOT NULL DEFAULT false,
    "estimatedCostUsd" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_prompt_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "feature" "AiFeature" NOT NULL,
    "version" INTEGER NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "userPromptTemplate" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_prompt_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_conversations_organizationId_createdAt_idx" ON "ai_conversations"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ai_conversations_patientId_idx" ON "ai_conversations"("patientId");

-- CreateIndex
CREATE INDEX "ai_conversations_encounterId_idx" ON "ai_conversations"("encounterId");

-- CreateIndex
CREATE INDEX "ai_conversations_createdByUserId_idx" ON "ai_conversations"("createdByUserId");

-- CreateIndex
CREATE INDEX "ai_messages_conversationId_idx" ON "ai_messages"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_messages_conversationId_sequence_key" ON "ai_messages"("conversationId", "sequence");

-- CreateIndex
CREATE INDEX "ai_usage_logs_organizationId_createdAt_idx" ON "ai_usage_logs"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ai_usage_logs_organizationId_feature_idx" ON "ai_usage_logs"("organizationId", "feature");

-- CreateIndex
CREATE INDEX "ai_usage_logs_conversationId_idx" ON "ai_usage_logs"("conversationId");

-- CreateIndex
CREATE INDEX "ai_prompt_templates_organizationId_feature_idx" ON "ai_prompt_templates"("organizationId", "feature");

-- CreateIndex
CREATE UNIQUE INDEX "ai_prompt_templates_organizationId_feature_version_key" ON "ai_prompt_templates"("organizationId", "feature", "version");

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_prompt_templates" ADD CONSTRAINT "ai_prompt_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
