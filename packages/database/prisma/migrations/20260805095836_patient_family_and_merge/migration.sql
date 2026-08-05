-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "headOfFamilyId" TEXT,
ADD COLUMN     "mergedIntoId" TEXT;

-- CreateIndex
CREATE INDEX "patients_headOfFamilyId_idx" ON "patients"("headOfFamilyId");

-- CreateIndex
CREATE INDEX "patients_mergedIntoId_idx" ON "patients"("mergedIntoId");

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_headOfFamilyId_fkey" FOREIGN KEY ("headOfFamilyId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
