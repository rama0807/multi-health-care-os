/*
  Warnings:

  - Added the required column `hospitalId` to the `doctors` table without a default value. This is not possible if the table is not empty.
  - Added the required column `joiningDate` to the `doctors` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DoctorAvailabilityStatus" AS ENUM ('AVAILABLE', 'ON_LEAVE', 'UNAVAILABLE');

-- AlterTable
ALTER TABLE "doctors" ADD COLUMN     "availabilityStatus" "DoctorAvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN     "experienceYears" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hospitalId" TEXT NOT NULL,
ADD COLUMN     "joiningDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "languagesSpoken" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "subSpecialization" TEXT;

-- CreateIndex
CREATE INDEX "doctors_hospitalId_idx" ON "doctors"("hospitalId");

-- AddForeignKey
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
