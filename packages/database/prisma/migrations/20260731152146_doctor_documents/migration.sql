-- CreateEnum
CREATE TYPE "DoctorDocumentType" AS ENUM ('MEDICAL_DEGREE', 'MEDICAL_LICENSE', 'EXPERIENCE_CERTIFICATE', 'ID_PROOF', 'OTHER');

-- CreateTable
CREATE TABLE "doctor_documents" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "documentType" "DoctorDocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "doctor_documents_doctorId_idx" ON "doctor_documents"("doctorId");

-- AddForeignKey
ALTER TABLE "doctor_documents" ADD CONSTRAINT "doctor_documents_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
