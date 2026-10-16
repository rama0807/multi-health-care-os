import { Module } from '@nestjs/common'

import { StorageModule } from '../../common/storage/storage.module'
import { StaffModule } from '../staff/staff.module'

import { DentalBillingController } from './dental-billing.controller'
import { DentalBillingService } from './dental-billing.service'
import { DentalDashboardService } from './dental-dashboard.service'
import { DentalOrganizationController } from './dental-organization.controller'
import { DentalOrganizationService } from './dental-organization.service'
import { DentalController } from './dental.controller'
import { DentalService } from './dental.service'

@Module({
  imports: [StaffModule, StorageModule],
  controllers: [DentalController, DentalBillingController, DentalOrganizationController],
  providers: [DentalService, DentalBillingService, DentalOrganizationService, DentalDashboardService],
  exports: [DentalService],
})
export class DentalModule { }

