import { Module } from '@nestjs/common'

import { MedicalRecordsModule } from '../medical-records/medical-records.module'
import { SchedulingModule } from '../scheduling/scheduling.module'

import { PrescriptionsController } from './prescriptions.controller'
import { PrescriptionsService } from './prescriptions.service'

@Module({
  imports: [MedicalRecordsModule, SchedulingModule],
  controllers: [PrescriptionsController],
  providers: [PrescriptionsService],
  exports: [PrescriptionsService],
})
export class PrescriptionsModule {}
