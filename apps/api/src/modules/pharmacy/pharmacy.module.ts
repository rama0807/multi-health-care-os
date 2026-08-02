import { Module } from '@nestjs/common'

import { PrescriptionsModule } from '../prescriptions/prescriptions.module'

import { DispenseController } from './dispense.controller'
import { DispenseService } from './dispense.service'
import { DrugCatalogController } from './drug-catalog.controller'
import { DrugCatalogService } from './drug-catalog.service'

@Module({
  imports: [PrescriptionsModule],
  controllers: [DrugCatalogController, DispenseController],
  providers: [DrugCatalogService, DispenseService],
  exports: [DrugCatalogService, DispenseService],
})
export class PharmacyModule {}
