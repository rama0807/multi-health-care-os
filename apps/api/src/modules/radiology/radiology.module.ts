import { Module } from '@nestjs/common'

import { MedicalRecordsModule } from '../medical-records/medical-records.module'
import { SchedulingModule } from '../scheduling/scheduling.module'

import { RadiologyCatalogController } from './radiology-catalog.controller'
import { RadiologyCatalogService } from './radiology-catalog.service'
import { RadiologyOrdersController } from './radiology-orders.controller'
import { RadiologyOrdersService } from './radiology-orders.service'

@Module({
  imports: [MedicalRecordsModule, SchedulingModule],
  controllers: [RadiologyOrdersController, RadiologyCatalogController],
  providers: [RadiologyOrdersService, RadiologyCatalogService],
  exports: [RadiologyOrdersService, RadiologyCatalogService],
})
export class RadiologyModule {}
