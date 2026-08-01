/*
  Warnings:

  - The `status` column on the `prescriptions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `updatedAt` to the `prescriptions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'DISCONTINUED');

-- AlterTable
ALTER TABLE "prescriptions" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "PrescriptionStatus" NOT NULL DEFAULT 'ACTIVE';
