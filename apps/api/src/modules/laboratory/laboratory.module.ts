import { Module } from '@nestjs/common'

import { MedicalRecordsModule } from '../medical-records/medical-records.module'
import { SchedulingModule } from '../scheduling/scheduling.module'

import { LabCatalogController } from './lab-catalog.controller'
import { LabCatalogService } from './lab-catalog.service'
import { LabTestsController } from './lab-tests.controller'
import { LabTestsService } from './lab-tests.service'

@Module({
  imports: [MedicalRecordsModule, SchedulingModule],
  controllers: [LabTestsController, LabCatalogController],
  providers: [LabTestsService, LabCatalogService],
  exports: [LabTestsService, LabCatalogService],
})
export class LaboratoryModule {}
