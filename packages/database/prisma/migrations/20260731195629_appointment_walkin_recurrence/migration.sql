-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "isWalkIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recurrenceGroupId" TEXT;

-- CreateIndex
CREATE INDEX "appointments_recurrenceGroupId_idx" ON "appointments"("recurrenceGroupId");
