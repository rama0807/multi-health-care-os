-- CreateIndex
CREATE UNIQUE INDEX "doctor_schedules_doctorId_effectiveFrom_key" ON "doctor_schedules"("doctorId", "effectiveFrom");
